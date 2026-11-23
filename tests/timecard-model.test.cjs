const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../timecard-model.js');
const shift = { in: '08:00', out: '16:00', break: 0, diff: 0, notes: '' };
const settings = { rate: 15.5, differential: 1, threshold: 40, multiplier: 1.5, weekday: 4 };
const summary = data => model.summarize({ settings, today: '2026-11-22', selectedWeek: '2026-11-19', ...data });
const slots = () => model.weekDates('2026-11-19').map(date => ({ date, in: '', out: '', break: 0, diff: 0, notes: '' }));

test('uses the configured workweek, including weekends', () => {
  assert.equal(model.weekStart('2026-11-22', 4), '2026-11-19');
  assert.equal(model.weekStart('2026-11-22', 0), '2026-11-22');
  assert.equal(model.weekStart('2026-12-01', 4), '2026-11-26');
});

test('builds workweek choices through six calendar months and keeps recorded history', () => {
  const weeks = model.workweeks({ today: '2026-11-22', weekday: 4 });
  assert.equal(weeks[0], '2026-11-05');
  assert.equal(weeks.at(-1), '2027-05-20');
  assert.ok(weeks.includes('2026-11-19'));
  assert.ok(model.workweeks({ today: '2026-11-22', dates: ['2026-10-16'] }).includes('2026-10-16'));
  assert.equal(model.addMonths('2026-08-31', 6), '2027-02-28');
});

test('shows all seven dates in order, including regular days off', () => {
  assert.deepEqual(model.slotDates({ start: '2026-11-19', rows: [], off: [0, 6] }), ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);
});

test('shows hours and pay only from the selected week', () => {
  const result = summary({ timecards: { '2026-11-12': shift, '2026-11-20': shift } });
  assert.equal(result.weekly.hours, 8);
  assert.equal(result.weekly.gross, 124);
  assert.equal(result.cumulative.hours, 16);
  assert.equal(result.cumulative.gross, 248);
});

test('calculates weekly overtime and differential at the configured rates', () => {
  const timecards = Object.fromEntries(['2026-11-19','2026-11-20','2026-11-21','2026-11-22','2026-11-23'].map(date => [date, { ...shift, out: '17:00', diff: 2 }]));
  const result = summary({ timecards });
  assert.equal(result.weekly.hours, 45);
  assert.equal(result.weekly.overtime, 5);
  assert.equal(result.weekly.gross, 746.25);
});

test('cumulative totals begin on the first workday, November 10 and exclude future dates', () => {
  const result = summary({ timecards: { '2026-11-09': shift, '2026-11-10': shift, '2026-11-23': shift } });
  assert.equal(result.cumulative.hours, 8);
  assert.equal(result.cumulative.gross, 124);
});

test('retains overtime earned before the cumulative start within that workweek', () => {
  const timecards = Object.fromEntries(['2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10'].map(date => [date, shift]));
  const result = summary({ timecards });
  assert.equal(result.cumulative.hours, 8);
  assert.equal(result.cumulative.gross, 186);
});

test('includes manual worked hours once, with detailed timecards taking precedence', () => {
  const result = summary({ timecards: { '2026-11-20': { ...shift, out: '17:00' } }, manualHours: { '2026-11-20': 8, '2026-11-21': 4 } });
  assert.equal(result.weekly.hours, 13);
  assert.equal(result.weekly.gross, 201.5);
  assert.equal(result.cumulative.hours, 13);
});

test('saving seven days updates only entered dates and preserves other weeks', () => {
  const existing = { '2026-11-12': shift, '2026-11-20': shift };
  const entries = slots(); entries[1] = { ...entries[1], ...shift, out: '17:00' };
  const result = model.saveWorkweek({ timecards: existing, slots: entries, start: '2026-11-19' });
  assert.equal(result.saved, 1);
  assert.equal(result.cards['2026-11-20'].out, '17:00');
  assert.deepEqual(result.cards['2026-11-12'], shift);
  assert.equal(existing['2026-11-20'].out, '16:00');
});

test('rejects duplicate dates, partial timecards, and dates outside the week before saving', () => {
  const entries = slots(); entries[0] = { ...entries[0], ...shift }; entries[1].date = entries[0].date;
  assert.throws(() => model.saveWorkweek({ timecards: {}, slots: entries, start: '2026-11-19' }), /different work date/);
  const partial = slots(); partial[0].in = '08:00';
  assert.throws(() => model.saveWorkweek({ timecards: {}, slots: partial, start: '2026-11-19' }), /Check the times/);
  const outside = slots(); outside[0].date = '2026-11-18';
  assert.throws(() => model.saveWorkweek({ timecards: {}, slots: outside, start: '2026-11-19' }), /within this week/);
});

test('requires seven days without deleting existing entries for blank slots', () => {
  const existing = { '2026-11-20': shift };
  assert.deepEqual(model.saveWorkweek({ timecards: existing, slots: slots(), start: '2026-11-19' }).cards, existing);
  assert.throws(() => model.saveWorkweek({ timecards: existing, slots: slots().slice(0, 4), start: '2026-11-19' }), /seven days/);
});

test('preserves six saved shifts while showing every day of the week', () => {
  const timecards = Object.fromEntries(model.weekDates('2026-11-19').slice(0, 6).map(date => [date, shift]));
  const result = summary({ timecards });
  assert.equal(result.weekly.hours, 48);
  assert.equal(model.slotDates({ start: '2026-11-19', rows: result.rows }).length, 7);
  assert.equal(Object.keys(timecards).length, 6);
});

test('anchors default pay periods to the first Thursday ending November 12', () => {
  assert.equal(model.weekStart('2026-11-12'), '2026-11-06');
  assert.equal(model.weekStart('2026-11-13'), '2026-11-13');
  assert.equal(model.weekStart('2026-11-19'), '2026-11-13');
  assert.equal(model.weekStart('2026-11-20'), '2026-11-20');
  assert.equal(model.weekStart('2026-11-26'), '2026-11-20');
  const weeks = model.workweeks({ today: '2026-11-22' });
  assert.deepEqual(weeks.slice(0, 3), ['2026-11-06', '2026-11-13', '2026-11-20']);
  assert.equal(weeks.at(-1), '2027-05-21');
});

test('aligns existing payroll settings once while preserving wages and other settings', () => {
  const saved = { ...settings, rate: 18.75, differential: 2, differentialWeeks: { '2026-11-19': 6 }, time: '00:00' };
  const aligned = model.alignPayPeriod(saved);
  assert.equal(aligned.weekday, 5);
  assert.equal(aligned.periodEndingAnchor, '2026-11-12');
  assert.equal(aligned.rate, 18.75);
  assert.deepEqual(aligned.differentialWeeks, saved.differentialWeeks);
  assert.equal(saved.weekday, 4);
  assert.deepEqual(model.alignPayPeriod({ ...aligned, weekday: 1 }), { ...aligned, weekday: 1 });
  assert.equal(model.alignPayPeriod(null).weekday, 5);
});

test('keeps Thursday hours in the previous period without losing cumulative hours', () => {
  const result = summary({ settings: model.paySettings(), selectedWeek: '2026-11-20', timecards: { '2026-11-19': shift, '2026-11-20': shift } });
  assert.equal(result.weekly.hours, 8);
  assert.equal(result.weekly.gross, 124);
  assert.equal(result.cumulative.hours, 16);
  assert.equal(result.cumulative.gross, 248);
});

test('saves and pays all seven worked days, with overtime across the full week', () => {
  const entries = slots().map(day => ({ ...day, ...shift, status: 'worked' }));
  const saved = model.saveWorkweek({ timecards: {}, slots: entries, start: '2026-11-19' });
  assert.equal(saved.saved, 7);
  const result = summary({ timecards: saved.cards, today: '2026-11-25' });
  assert.equal(result.weekly.hours, 56);
  assert.equal(result.weekly.overtime, 16);
  assert.equal(result.weekly.gross, 992);
  assert.equal(result.cumulative.hours, 56);
});

test('saves Off, PTO, Sick, and Other without work times and excludes them from hours and pay', () => {
  const entries = slots();
  entries[0] = { ...entries[0], ...shift };
  ['off', 'pto', 'sick', 'other'].forEach((status, index) => {
    entries[index + 1] = { ...entries[index + 1], ...shift, status, notes: 'Saved ' + status };
  });
  const original = { '2026-11-20': { ...shift }, '2026-11-12': shift };
  const saved = model.saveWorkweek({ timecards: original, slots: entries, start: '2026-11-19' });
  const restored = JSON.parse(JSON.stringify(saved.cards));
  assert.equal(saved.saved, 5);
  ['off', 'pto', 'sick', 'other'].forEach((status, index) => {
    const card = restored[entries[index + 1].date];
    assert.equal(card.status, status);
    assert.equal(card.in, '');
    assert.equal(card.out, '');
    assert.equal(card.diff, 0);
    assert.equal(card.notes, 'Saved ' + status);
  });
  const result = summary({ timecards: restored, manualHours: { '2026-11-20': 8 } });
  assert.equal(result.weekly.hours, 8);
  assert.equal(result.weekly.gross, 124);
  assert.equal(original['2026-11-20'].in, '08:00');
  assert.deepEqual(restored['2026-11-12'], shift);
});

test('changing a leave day back to Worked requires clock times and rejects invalid statuses', () => {
  const entries = slots();
  entries[0].status = 'worked';
  const existing = { [entries[0].date]: { status: 'off', in: '', out: '', break: 0, diff: 0, notes: '' } };
  assert.throws(() => model.saveWorkweek({ timecards: existing, slots: entries, start: '2026-11-19' }), /Check the times/);
  entries[0] = { ...entries[0], ...shift };
  assert.equal(model.saveWorkweek({ timecards: existing, slots: entries, start: '2026-11-19' }).cards[entries[0].date].status, 'worked');
  entries[6].status = 'invalid';
  assert.throws(() => model.saveWorkweek({ timecards: existing, slots: entries, start: '2026-11-19' }), /valid day status/);
  assert.equal(existing[entries[0].date].status, 'off');
});
