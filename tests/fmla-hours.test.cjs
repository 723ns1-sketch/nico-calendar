const test = require('node:test');
const assert = require('node:assert/strict');
const { timecardHours, summarizeActualWork } = require('../fmla-hours.js');

const period = { start: '2026-11-10', end: '2026-11-22' };
const day = '2026-11-20';
const shift = { in: '08:00', out: '16:30', break: 30, diff: 0 };
const summarize = data => summarizeActualWork({ ...period, ...data });

test('counts worked time after the entered unpaid break', () => {
  assert.equal(timecardHours(shift), 8);
  assert.equal(timecardHours({ ...shift, break: 0 }), 8.5);
});

test('counts an overnight shift against its recorded start date', () => {
  assert.equal(summarize({ timecards: { [day]: { in: '22:00', out: '06:00', break: 30 } } }).hours, 7.5);
});

test('adds a newly saved timecard to existing actual hours', () => {
  const cards = { [day]: shift };
  assert.equal(summarize({ timecards: cards }).hours, 8);
  cards['2026-11-21'] = { in: '09:00', out: '17:00', break: 30 };
  assert.equal(summarize({ timecards: cards }).hours, 15.5);
});

test('editing replaces a day instead of adding that day twice', () => {
  const cards = { [day]: shift };
  cards[day] = { ...shift, out: '17:30' };
  assert.equal(summarize({ timecards: cards }).hours, 9);
});

test('deleting a saved timecard removes those hours from the total', () => {
  const cards = { [day]: shift, '2026-11-21': shift };
  delete cards[day];
  assert.equal(summarize({ timecards: cards }).hours, 8);
});

test('retains older manual actual-hour entries without double-counting a timecard date', () => {
  assert.deepEqual(summarize({ timecards: { [day]: shift }, manualHours: { [day]: 7.5, '2026-11-21': 7.25 } }), { hours: 15.25, days: 2 });
});

test('scheduled shifts and PTO cannot increase worked-hour progress', () => {
  assert.equal(summarize({ events: [
    { date: day, category: 'Work Schedule', start: '08:00', end: '16:00' },
    { date: day, category: 'PTO Taken', leaveHours: 8 }
  ] }).hours, 0);
});

test('excludes entries before the chosen start and future dates', () => {
  assert.equal(summarize({ timecards: { '2026-11-09': shift, [day]: shift, '2026-11-23': shift } }).hours, 8);
});

test('overtime and shift differential never multiply hours worked', () => {
  assert.equal(summarize({ timecards: { [day]: { in: '08:00', out: '18:00', break: 0, diff: 10 } } }).hours, 10);
});

test('invalid dates, times, or totals do not poison valid progress', () => {
  assert.equal(summarize({ timecards: { [day]: shift, '2026-11-21': { in: '25:00', out: '17:00' }, '2026-11-31': shift }, manualHours: { '2026-11-11': 'bad', '2026-11-12': -8, '2026-11-13': 25, '2026-11-14': Infinity } }).hours, 8);
  assert.equal(timecardHours({ ...shift, break: -30 }), 0);
  assert.equal(timecardHours({ ...shift, break: 999 }), 0);
});

test('handles empty or invalid restored data without changing it', () => {
  assert.deepEqual(summarize({ timecards: null, manualHours: [] }), { hours: 0, days: 0 });
  const cards = { [day]: { ...shift } };
  const original = JSON.stringify(cards);
  summarize({ timecards: cards });
  assert.equal(JSON.stringify(cards), original);
  assert.equal(summarize({ timecards: cards, start: 'invalid' }).hours, 0);
});

test('day-off and leave statuses override stale clock times and manual worked hours', () => {
  for (const status of ['off', 'pto', 'vacation', 'sick', 'other']) {
    const cards = { [day]: { ...shift, status }, '2026-11-21': shift };
    assert.equal(timecardHours(cards[day]), 0);
    assert.deepEqual(summarize({ timecards: cards, manualHours: { [day]: 8 } }), { hours: 8, days: 1 });
  }
  assert.equal(timecardHours({ ...shift, status: 'worked' }), 8);
});
