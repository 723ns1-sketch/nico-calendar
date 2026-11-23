(function (factory) {
  const work = typeof module === 'object' && module.exports ? require('./fmla-hours.js') : window.LifeHubWorkHours;
  const api = factory(work);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LifeHubTimecard = api;
})(function (work) {
  'use strict';
  const CUMULATIVE_START = '2026-11-11';
  const iso = date => date.toISOString().slice(0, 10);
  const dateObject = date => new Date(date + 'T12:00:00Z');
  const addDays = (date, days) => { const d = dateObject(date); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
  function addMonths(date, months) {
    const d = dateObject(date), day = d.getUTCDate();
    d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + months);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
    return iso(d);
  }
  function paySettings(value = {}) {
    const number = (key, fallback, min, max = Infinity) => {
      const n = Number(value[key]);
      return value[key] !== null && value[key] !== '' && Number.isFinite(n) && n >= min && n <= max ? n : fallback;
    };
    const weekday = number('weekday', 4, 0, 6);
    return { rate: number('rate', 15.5, 0), differential: number('differential', 1, 0), threshold: number('threshold', 40, 1, 168), multiplier: number('multiplier', 1.5, 1), weekday: Number.isInteger(weekday) ? weekday : 4 };
  }
  function weekStart(date, weekday = 4) {
    const d = dateObject(date);
    return addDays(date, -(d.getUTCDay() - weekday + 7) % 7);
  }
  const weekDates = start => Array.from({ length: 7 }, (_, i) => addDays(start, i));
  function ledger(timecards, manualHours, settings) {
    const pay = paySettings(settings), running = new Map();
    return work.actualWorkDays({ timecards, manualHours, start: '1900-01-01', end: '9999-12-31' }).map(day => {
      const week = weekStart(day.date, pay.weekday), before = running.get(week) || 0;
      const regular = Math.min(day.hours, Math.max(0, pay.threshold - before)), overtime = day.hours - regular;
      const differential = day.source === 'timecard' ? Math.min(day.hours, Math.max(0, Number(day.card.diff) || 0)) : 0;
      const gross = regular * pay.rate + overtime * pay.rate * pay.multiplier + differential * pay.differential;
      running.set(week, before + day.hours);
      return { ...day, week, regular, overtime, differential, gross };
    });
  }
  const total = rows => rows.reduce((sum, day) => ({ hours: sum.hours + day.hours, overtime: sum.overtime + day.overtime, differential: sum.differential + day.differential, gross: sum.gross + day.gross, days: sum.days + 1 }), { hours: 0, overtime: 0, differential: 0, gross: 0, days: 0 });
  function summarize({ timecards, manualHours, settings, selectedWeek, today }) {
    const rows = ledger(timecards, manualHours, settings);
    return { rows, weekly: total(rows.filter(day => day.week === selectedWeek)), cumulative: total(rows.filter(day => day.date >= CUMULATIVE_START && day.date <= today)) };
  }
  function workweeks({ today, weekday = 4, dates = [] }) {
    const result = new Set(), last = weekStart(addMonths(today, 6), weekday);
    for (let date = weekStart(CUMULATIVE_START, weekday); date <= last; date = addDays(date, 7)) result.add(date);
    result.add(weekStart(today, weekday));
    for (const date of dates) if (work.validDate(date)) result.add(weekStart(date, weekday));
    return [...result].sort();
  }
  function slotDates({ start, rows, off = [] }) {
    const dates = weekDates(start), saved = rows.filter(day => day.week === start).map(day => day.date);
    const preferred = dates.filter(date => !off.includes(dateObject(date).getUTCDay()));
    return [...new Set([...saved, ...preferred, ...dates])].slice(0, 5).sort();
  }
  function saveWorkweek({ timecards, slots, start }) {
    if (!Array.isArray(slots) || slots.length !== 5) throw Error('Use the five workday slots for this week.');
    const allowed = new Set(weekDates(start)), used = new Set(), updates = [];
    for (const slot of slots) {
      if (!allowed.has(slot.date) || used.has(slot.date)) throw Error('Choose a different work date within this week for each slot.');
      used.add(slot.date);
      const card = { in: slot.in, out: slot.out, break: Number(slot.break || 0), diff: Number(slot.diff || 0), notes: String(slot.notes || '').trim() };
      if (!card.in && !card.out && !card.break && !card.diff && !card.notes) continue;
      const hours = work.timecardHours(card);
      if (!card.in || !card.out || hours <= 0 || !Number.isFinite(card.diff) || card.diff < 0 || card.diff > hours) throw Error('Check the times, unpaid break, and differential hours for ' + slot.date + '.');
      updates.push([slot.date, card]);
    }
    const cards = { ...timecards };
    for (const [date, card] of updates) cards[date] = { ...cards[date], ...card };
    return { cards, saved: updates.length };
  }
  return { CUMULATIVE_START, addDays, addMonths, paySettings, weekStart, weekDates, ledger, summarize, workweeks, slotDates, saveWorkweek };
});
