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
  const blankSlot = date => ({ date, status: 'worked', in: '', out: '', break: '0', diff: '0', notes: '' });
  const drafts = new Map();
  let selectedWeek = '', followCurrent = true, dirty = false, settings = model.paySettings(read(PAY)), displayed = [];

  function militaryTime(value) {
    const time = String(value).trim();
    return /^(?:[01]\d|2[0-3])[0-5]\d$/.test(time) ? time.slice(0, 2) + ':' + time.slice(2) : time;
  }
  function slotValues(row) {
    return Object.fromEntries([...row.querySelectorAll('[data-field]')].map(input => [input.dataset.field, ['in', 'out'].includes(input.dataset.field) ? militaryTime(input.value) : input.value]));
  }
  function snapshot() {
    return [...$('tcSlots').querySelectorAll('.tc-slot')].map(slotValues);
  }
  function remember() { if (dirty && selectedWeek && $('tcSlots').children.length) drafts.set(selectedWeek, snapshot()); }
  function savedSlot(date, cards) {
    const card = cards[date];
    return card ? { date, status: Object.hasOwn(model.DAY_STATUSES, card.status) ? card.status : 'worked', in: card.in || '', out: card.out || '', break: String(card.break ?? 0), diff: String(card.diff ?? 0), notes: card.notes || '' } : blankSlot(date);
  }
  function write(cards) {
    localStorage.setItem(KEY, JSON.stringify(cards));
    window.dispatchEvent(new Event('lifehub:hours-changed'));
  }
  function stat(value, label) { return '<div class="stat"><strong>' + value + '</strong><span>' + label + '</span></div>'; }

  function rowHTML(slot, index, rows, cards) {
    const record = rows.find(day => day.date === slot.date), worked = slot.status === 'worked';
    const statuses = Object.entries(model.DAY_STATUSES).map(([value, label]) => '<option value="' + value + '"' + (value === slot.status ? ' selected' : '') + '>' + label + '</option>').join('');
    const hidden = worked ? '' : ' hidden', disabled = worked ? '' : ' disabled';
    return '<fieldset class="tc-slot" data-slot="' + index + '" data-status="' + slot.status + '"><legend>' + safe(dateLabel(slot.date)) + '</legend>' +
      '<input type="hidden" data-field="date" value="' + slot.date + '">' +
      '<label class="tc-status">Day status<select data-field="status" aria-label="Day status for ' + safe(dateLabel(slot.date)) + '">' + statuses + '</select></label>' +
      '<label data-work-field' + hidden + '>Clock in (24h)<input data-field="in" type="text" inputmode="numeric" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):?[0-5][0-9]" placeholder="HH:MM" title="24-hour time, from 00:00 to 23:59. Enter 17:30 or 1730." value="' + safe(slot.in) + '"' + disabled + '></label>' +
      '<label data-work-field' + hidden + '>Clock out (24h)<input data-field="out" type="text" inputmode="numeric" maxlength="5" pattern="(?:[01][0-9]|2[0-3]):?[0-5][0-9]" placeholder="HH:MM" title="24-hour time, from 00:00 to 23:59. Enter 17:30 or 1730." value="' + safe(slot.out) + '"' + disabled + '></label>' +
      '<label data-work-field' + hidden + '>Unpaid break (min)<input data-field="break" type="number" min="0" max="1439" step="1" value="' + safe(slot.break) + '"' + disabled + '></label>' +
      '<label data-work-field' + hidden + '>Differential hours<input data-field="diff" type="number" min="0" max="24" step="any" value="' + safe(slot.diff) + '"' + disabled + '></label>' +
      '<label class="tc-notes">Notes<input data-field="notes" type="text" maxlength="250" placeholder="Optional" value="' + safe(slot.notes) + '"></label>' +
      '<div class="tc-slot-total"><strong data-slot-hours>' + (worked ? (slot.in || slot.out ? work.timecardHours(slot) : record?.hours || 0).toFixed(2) + ' hrs' : model.DAY_STATUSES[slot.status]) + '</strong>' +
      (Object.hasOwn(cards, slot.date) ? '<button type="button" data-remove="' + index + '">Remove entry</button>' : '<span class="note">' + (record?.source === 'manual' ? 'Logged in Reminders' : 'No saved timecard') + '</span>') + '</div></fieldset>';
  }
  function updateRow(row) {
    const values = slotValues(row), worked = values.status === 'worked';
    row.dataset.status = values.status;
    row.querySelectorAll('[data-work-field]').forEach(label => { label.hidden = !worked; label.querySelector('input').disabled = !worked; });
    row.querySelector('[data-slot-hours]').textContent = worked ? work.timecardHours(values).toFixed(2) + ' hrs' : model.DAY_STATUSES[values.status];
  }
  function render() {
    settings = model.paySettings(read(PAY));
    const cards = read(KEY), manualHours = read(TRACK).hours || {}, now = today(), current = model.weekStart(now, settings.weekday);
    if (followCurrent || !selectedWeek) selectedWeek = current;
    const result = model.summarize({ timecards: cards, manualHours, settings, selectedWeek, today: now });
    const weeks = model.workweeks({ today: now, weekday: settings.weekday, dates: [...Object.keys(cards), ...result.rows.map(day => day.date)] });
    if (!weeks.includes(selectedWeek)) weeks.push(selectedWeek);
    $('tcWeek').innerHTML = weeks.sort().map(start => '<option value="' + start + '"' + (start === selectedWeek ? ' selected' : '') + '>' + (start === current ? 'Current · ' : '') + 'Period ending ' + safe(dateLabel(model.addDays(start, 6))) + '</option>').join('');
    $('tcWeekLabel').textContent = 'Selected workweek: ' + rangeLabel(selectedWeek) + ' · Base rate ' + money(settings.rate) + '/hr';
    displayed = drafts.get(selectedWeek) || model.slotDates({ start: selectedWeek }).map(date => savedSlot(date, cards));
    dirty = drafts.has(selectedWeek);
    $('tcSlots').innerHTML = displayed.map((slot, index) => rowHTML(slot, index, result.rows, cards)).join('');
    $('tcSummary').innerHTML = stat(result.weekly.hours.toFixed(2) + ' hrs', 'Hours worked this week') + stat(money(result.weekly.gross), 'Estimated gross for worked hours') + stat(result.weekly.overtime.toFixed(2) + ' hrs', 'Overtime for this week');
    $('tcCumulative').innerHTML = stat(result.cumulative.hours.toFixed(2) + ' hrs', 'Cumulative hours worked') + stat(money(result.cumulative.gross), 'Cumulative estimated gross');
    $('tcCumulativePeriod').textContent = 'Since your first workday, ' + dateLabel(model.CUMULATIVE_START) + ', through ' + dateLabel(now) + '. Includes saved timecards and manual worked hours, counted once per date.';
    const marked = displayed.filter(slot => Object.hasOwn(cards, slot.date) && cards[slot.date].status && cards[slot.date].status !== 'worked');
    $('tcEntries').textContent = marked.length ? marked.length + ' day' + (marked.length === 1 ? '' : 's') + ' marked Off, PTO, Sick, or Other in this week.' : '';
    window.refreshLifeHubFmla?.();
  }

  $('tcWeek').addEventListener('change', () => {
    remember(); selectedWeek = $('tcWeek').value;
    followCurrent = selectedWeek === model.weekStart(today(), settings.weekday);
    $('tcFeedback').textContent = ''; render();
  });
  $('tcCurrentWeek').addEventListener('click', () => { remember(); followCurrent = true; $('tcFeedback').textContent = ''; render(); });
  $('tcSlots').addEventListener('change', event => {
    if (['in', 'out'].includes(event.target.dataset.field)) event.target.value = militaryTime(event.target.value);
    const row = event.target.closest('.tc-slot'); if (!row) return;
    updateRow(row); dirty = true;
    $('tcFeedback').textContent = 'Unsaved changes. Choose Save workweek to update your totals.';
  });
  $('tcSlots').addEventListener('input', event => {
    const row = event.target.closest('.tc-slot'); if (!row || event.target.dataset.field === 'date') return;
    updateRow(row);
    dirty = true;
    $('tcFeedback').textContent = 'Unsaved changes. Choose Save workweek to update your totals.';
  });
  $('hertzTimecardForm').addEventListener('submit', event => {
    event.preventDefault();
    try {
      const result = model.saveWorkweek({ timecards: read(KEY), slots: snapshot(), start: selectedWeek });
      if (!result.saved) { $('tcFeedback').textContent = 'Enter worked times or mark a day Off, PTO, Sick, or Other, then save.'; return; }
      write(result.cards); drafts.delete(selectedWeek); render();
      $('tcFeedback').textContent = 'Saved ' + result.saved + ' day' + (result.saved === 1 ? '' : 's') + '. Weekly, cumulative, and FMLA totals updated.';
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
