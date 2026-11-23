(() => {
  'use strict';
  const model = window.LifeHubTimecard, work = window.LifeHubWorkHours;
  const $ = id => document.getElementById(id);
  const KEY = 'nico-hertz-timecards-v1', PAY = 'nico-hertz-pay-v1', TRACK = 'nico-planning-tools-v1';
  const read = (key, fallback = {}) => { try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback; } catch { return fallback; } };
  const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-'); };
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = value => value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  const dateLabel = date => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const rangeLabel = start => dateLabel(start) + ' – ' + dateLabel(model.addDays(start, 6));
  const blankSlot = date => ({ date, in: '', out: '', break: '0', diff: '0', notes: '' });
  const drafts = new Map();
  let selectedWeek = '', followCurrent = true, dirty = false, settings = model.paySettings(read(PAY)), displayed = [];

  function snapshot() {
    return [...$('tcSlots').querySelectorAll('.tc-slot')].map(row => Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value])));
  }
  function remember() { if (dirty && selectedWeek && $('tcSlots').children.length) drafts.set(selectedWeek, snapshot()); }
  function savedSlot(date, cards) {
    const card = cards[date];
    return card ? { date, in: card.in || '', out: card.out || '', break: String(card.break ?? 0), diff: String(card.diff ?? 0), notes: card.notes || '' } : blankSlot(date);
  }
  function write(cards) {
    localStorage.setItem(KEY, JSON.stringify(cards));
    window.dispatchEvent(new Event('lifehub:hours-changed'));
  }
  function stat(value, label) { return '<div class="stat"><strong>' + value + '</strong><span>' + label + '</span></div>'; }

  function rowHTML(slot, index, rows, cards) {
    const record = rows.find(day => day.date === slot.date), used = new Set(displayed.filter((_, i) => i !== index).map(day => day.date));
    const dates = model.weekDates(selectedWeek).map(date => '<option value="' + date + '"' + (date === slot.date ? ' selected' : used.has(date) ? ' disabled' : '') + '>' + safe(dateLabel(date)) + '</option>').join('');
    return '<fieldset class="tc-slot" data-slot="' + index + '"><legend>Workday ' + (index + 1) + '</legend>' +
      '<label class="tc-date">Work date<select data-field="date" aria-label="Workday ' + (index + 1) + ' date">' + dates + '</select></label>' +
      '<label>Clock in<input data-field="in" type="time" value="' + safe(slot.in) + '"></label>' +
      '<label>Clock out<input data-field="out" type="time" value="' + safe(slot.out) + '"></label>' +
      '<label>Unpaid break (min)<input data-field="break" type="number" min="0" max="1439" step="1" value="' + safe(slot.break) + '"></label>' +
      '<label>Differential hours<input data-field="diff" type="number" min="0" max="24" step="any" value="' + safe(slot.diff) + '"></label>' +
      '<label class="tc-notes">Notes<input data-field="notes" type="text" maxlength="250" placeholder="Optional" value="' + safe(slot.notes) + '"></label>' +
      '<div class="tc-slot-total"><strong data-slot-hours>' + (slot.in || slot.out ? work.timecardHours(slot) : record?.hours || 0).toFixed(2) + ' hrs</strong>' +
      (Object.hasOwn(cards, slot.date) ? '<button type="button" data-remove="' + index + '">Remove entry</button>' : '<span class="note">' + (record?.source === 'manual' ? 'Logged in Reminders' : 'No saved timecard') + '</span>') + '</div></fieldset>';
  }
  function render() {
    settings = model.paySettings(read(PAY));
    const cards = read(KEY), manualHours = read(TRACK).hours || {}, now = today(), current = model.weekStart(now, settings.weekday);
    if (followCurrent || !selectedWeek) selectedWeek = current;
    const result = model.summarize({ timecards: cards, manualHours, settings, selectedWeek, today: now });
    const weeks = model.workweeks({ today: now, weekday: settings.weekday, dates: result.rows.map(day => day.date) });
    if (!weeks.includes(selectedWeek)) weeks.push(selectedWeek);
    $('tcWeek').innerHTML = weeks.sort().map(start => '<option value="' + start + '"' + (start === selectedWeek ? ' selected' : '') + '>' + (start === current ? 'Current week · ' : '') + safe(rangeLabel(start)) + '</option>').join('');
    $('tcWeekLabel').textContent = 'Selected workweek: ' + rangeLabel(selectedWeek) + ' · Base rate ' + money(settings.rate) + '/hr';
    const regularShift = read('nico-calendar-regular-shift-v1');
    displayed = drafts.get(selectedWeek) || model.slotDates({ start: selectedWeek, rows: result.rows, off: Array.isArray(regularShift.off) ? regularShift.off : [] }).map(date => savedSlot(date, cards));
    dirty = drafts.has(selectedWeek);
    $('tcSlots').innerHTML = displayed.map((slot, index) => rowHTML(slot, index, result.rows, cards)).join('');
    $('tcSummary').innerHTML = stat(result.weekly.hours.toFixed(2) + ' hrs', 'Hours saved for this week') + stat(money(result.weekly.gross), 'Estimated gross for this week') + stat(result.weekly.overtime.toFixed(2) + ' hrs', 'Overtime for this week');
    $('tcCumulative').innerHTML = stat(result.cumulative.hours.toFixed(2) + ' hrs', 'Cumulative hours worked') + stat(money(result.cumulative.gross), 'Cumulative estimated gross');
    $('tcCumulativePeriod').textContent = 'November 11, 2026 through ' + dateLabel(now) + '. Includes saved timecards and manual worked hours, counted once per date.';
    const visibleDates = new Set(displayed.map(slot => slot.date)), extra = result.rows.filter(day => day.week === selectedWeek && !visibleDates.has(day.date));
    $('tcEntries').innerHTML = extra.length ? '<details class="tc-extra"><summary>' + extra.length + ' additional saved workday' + (extra.length === 1 ? '' : 's') + ' included in this week’s totals</summary>' + extra.map(day => '<p>' + safe(dateLabel(day.date)) + ' · ' + day.hours.toFixed(2) + ' hrs</p>').join('') + '<p class="note">Choose one of these dates in a workday slot to view or edit it.</p></details>' : '';
    window.refreshLifeHubFmla?.();
  }

  $('tcWeek').addEventListener('change', () => {
    remember(); selectedWeek = $('tcWeek').value;
    followCurrent = selectedWeek === model.weekStart(today(), settings.weekday);
    $('tcFeedback').textContent = ''; render();
  });
  $('tcCurrentWeek').addEventListener('click', () => { remember(); followCurrent = true; $('tcFeedback').textContent = ''; render(); });
  $('tcSlots').addEventListener('change', event => {
    if (event.target.dataset.field !== 'date') return;
    const index = Number(event.target.closest('.tc-slot').dataset.slot), slots = snapshot(), date = slots[index].date;
    if (slots.some((slot, i) => i !== index && slot.date === date)) { $('tcFeedback').textContent = 'That date already has a slot. Choose a different day.'; render(); return; }
    slots[index] = savedSlot(date, read(KEY));
    drafts.set(selectedWeek, slots); render();
  });
  $('tcSlots').addEventListener('input', event => {
    const row = event.target.closest('.tc-slot'); if (!row || event.target.dataset.field === 'date') return;
    const values = Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, input.value]));
    row.querySelector('[data-slot-hours]').textContent = work.timecardHours(values).toFixed(2) + ' hrs';
    dirty = true;
    $('tcFeedback').textContent = 'Unsaved changes. Choose Save workweek to update your totals.';
  });
  $('hertzTimecardForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = model.saveWorkweek({ timecards: read(KEY), slots: snapshot(), start: selectedWeek });
      if (!result.saved) { $('tcFeedback').textContent = 'Enter clock times in a workday slot, then save.'; return; }
      write(result.cards); drafts.delete(selectedWeek); render();
      $('tcFeedback').textContent = 'Saved ' + result.saved + ' workday' + (result.saved === 1 ? '' : 's') + '. Weekly, cumulative, and FMLA totals updated.';
    } catch (error) { $('tcFeedback').textContent = error.message || 'Unable to save this workweek. Check your entries and try again.'; }
  });
  $('tcSlots').addEventListener('click', event => {
    const button = event.target.closest('[data-remove]'); if (!button) return;
    const slots = snapshot(), index = Number(button.dataset.remove), date = slots[index].date;
    if (!confirm('Remove the saved timecard for ' + dateLabel(date) + '? Your totals will be recalculated.')) return;
    try {
      const cards = read(KEY); delete cards[date]; write(cards);
      slots[index] = blankSlot(date); drafts.set(selectedWeek, slots); render();
      $('tcFeedback').textContent = 'Timecard removed. Weekly, cumulative, and FMLA totals updated.';
    } catch { $('tcFeedback').textContent = 'Unable to remove this timecard. Try again.'; }
  });
  $('tcReset').addEventListener('click', () => { drafts.delete(selectedWeek); render(); $('tcFeedback').textContent = 'Showing the saved entries for this workweek.'; });
  const open = () => {
    remember(); render(); $('hertzPanel').classList.remove('hidden');
    $('hertzBtn').setAttribute('aria-expanded', 'true');
    $('hertzTimecard').scrollIntoView({ behavior: 'smooth', block: 'start' });
    $('tcWeek').focus({ preventScroll: true });
  };
  $('timecardShortcut').addEventListener('click', open);
  $('hertzBtn').addEventListener('click', () => { remember(); render(); });
  $('paySettingsForm').addEventListener('submit', () => {
    remember(); const next = model.paySettings(read(PAY));
    if (next.weekday !== settings.weekday) { followCurrent = true; drafts.clear(); }
    render();
  });
  window.addEventListener('storage', event => { if (event.key === null || [KEY, PAY, TRACK].includes(event.key)) { remember(); render(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { remember(); render(); } });
  render();
})();
