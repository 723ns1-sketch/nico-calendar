const test = require('node:test');
const assert = require('node:assert/strict');
const model = require('../timecard-model.js');
const shift = { in: '08:00', out: '16:00', break: 0, diff: 0, notes: '' };
const settings = { rate: 15.5, differential: 1, threshold: 40, multiplier: 1.5, weekday: 4 };
const summary = data => model.summarize({ settings, today: '2026-11-22', selectedWeek: '2026-11-19', ...data });
const slots = () => model.weekDates('2026-11-19').slice(0, 5).map(date => ({ date, in: '', out: '', break: 0, diff: 0, notes: '' }));

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
  assert.ok(model.workweeks({ today: '2026-11-22', dates: ['2026-10-16'] }).includes('2026-10-15'));
  assert.equal(model.addMonths('2026-08-31', 6), '2027-02-28');
});

test('chooses five slots around saved dates and regular days off', () => {
  assert.deepEqual(model.slotDates({ start: '2026-11-19', rows: [], off: [0, 6] }), ['2026-11-19', '2026-11-20', '2026-11-23', '2026-11-24', '2026-11-25']);
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

test('cumulative totals begin November 11 and exclude future dates', () => {
  const result = summary({ timecards: { '2026-11-10': shift, '2026-11-11': shift, '2026-11-23': shift } });
  assert.equal(result.cumulative.hours, 8);
  assert.equal(result.cumulative.gross, 124);
});

test('retains overtime earned before the cumulative start within that workweek', () => {
  const timecards = Object.fromEntries(['2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-11'].map(date => [date, shift]));
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

test('saving five slots updates only entered dates and preserves other weeks', () => {
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

test('requires five slots without deleting existing entries for blank slots', () => {
  const existing = { '2026-11-20': shift };
  assert.deepEqual(model.saveWorkweek({ timecards: existing, slots: slots(), start: '2026-11-19' }).cards, existing);
  assert.throws(() => model.saveWorkweek({ timecards: existing, slots: slots().slice(0, 4), start: '2026-11-19' }), /five workday slots/);
});

test('preserves and counts more than five saved days without adding extra slots', () => {
  const timecards = Object.fromEntries(model.weekDates('2026-11-19').slice(0, 6).map(date => [date, shift]));
  const result = summary({ timecards });
  assert.equal(result.weekly.hours, 48);
  assert.equal(model.slotDates({ start: '2026-11-19', rows: result.rows }).length, 5);
  assert.equal(Object.keys(timecards).length, 6);
});
