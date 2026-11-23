/* Actual worked hours for the personal FMLA planning goal. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.LifeHubWorkHours = api;
})(function () {
  'use strict';

  function validDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(value + 'T12:00:00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function timecardMinutes(card) {
    const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!card || (card.status && card.status !== 'worked') || !time.test(card.in) || !time.test(card.out)) return null;
    const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    const span = (minutes(card.out) - minutes(card.in) + 1440) % 1440;
    const unpaid = Number(card.break || 0);
    if (!Number.isFinite(unpaid) || unpaid < 0 || unpaid > span) return null;
    return span - unpaid;
  }

  function timecardHours(card) {
    return (timecardMinutes(card) ?? 0) / 60;
  }

  function actualWorkDays({ timecards, manualHours, start, end }) {
    if (!validDate(start) || !validDate(end) || start > end) return [];
    const records = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const inPeriod = date => validDate(date) && date >= start && date <= end;
    const byDate = new Map();

    for (const [date, value] of Object.entries(records(manualHours))) {
      if (!inPeriod(date) || !['number', 'string'].includes(typeof value) || String(value).trim() === '') continue;
      const hours = Number(value);
      if (Number.isFinite(hours) && hours >= 0 && hours <= 24) byDate.set(date, { date, minutes: hours * 60, hours, source: 'manual' });
    }
    for (const [date, card] of Object.entries(records(timecards))) {
      if (!inPeriod(date)) continue;
      // An explicitly marked day off replaces an older manual worked-hour total.
      if (card && ['off', 'pto', 'vacation', 'sick', 'other'].includes(card.status)) { byDate.delete(date); continue; }
      const minutes = timecardMinutes(card);
      // One daily record: a detailed timecard replaces the manual total for its date.
      if (minutes !== null) byDate.set(date, { date, minutes, hours: minutes / 60, source: 'timecard', card });
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }

  function summarizeActualWork(data) {
    const days = actualWorkDays(data);
    return { hours: days.reduce((sum, day) => sum + day.minutes, 0) / 60, days: days.length };
  }

  return { validDate, timecardHours, actualWorkDays, summarizeActualWork };
});
