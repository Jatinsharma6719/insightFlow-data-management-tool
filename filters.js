/*!
 * InsightFlow — filters.js
 * One filtered dataset (IF.view) is calculated here and used by every page,
 * so KPIs, charts, tables and reports always agree with each other.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const DAY = 864e5;
  const F = (IF.F = {});

  const FILTER_FIELDS = [
    { key: 'category', id: 'fCategory', label: 'Category', cap: 'category', get: (r) => r.category },
    { key: 'product', id: 'fProduct', label: 'Product', cap: 'product', get: (r) => r.product },
    { key: 'city', id: 'fCity', label: 'City', cap: 'city', get: (r) => r.city },
    { key: 'state', id: 'fState', label: 'State / Region', cap: 'state', get: (r) => r.state },
    { key: 'payment', id: 'fPayment', label: 'Payment method', cap: 'payment', get: (r) => r.payment },
    { key: 'status', id: 'fStatus', label: 'Order status', cap: 'status', get: (r) => r.status }
  ];
  F.FIELDS = FILTER_FIELDS;
  /** Statuses treated as "not a completed sale" when the setting is on. */
  F.EXCLUDED_STATUS = /cancel|return|refund|fail|void|reject/i;

  const emptyFilters = () => ({ category: '', product: '', city: '', state: '', payment: '', status: '' });
  F.applied = Object.assign({ preset: '90d', start: null, end: null }, emptyFilters());
  F.pending = emptyFilters();

  IF.view = { range: null, prevRange: null, rangeDays: 0, nonDate: [], current: [], previous: [], all: [], bounds: null, excludingStatuses: false };

  /* ---------- date range ---------- */
  F.computeRange = function (bounds) {
    const a = F.applied;
    if (a.preset === 'all') return { start: bounds.min, end: bounds.max };
    if (a.preset === 'custom') {
      let s = a.start === null ? bounds.min : a.start, e = a.end === null ? bounds.max : a.end;
      if (s > e) { const x = s; s = e; e = x; }
      return { start: s, end: e };
    }
    const p = IF.PRESETS.find((x) => x.id === a.preset) || IF.PRESETS[1];
    return { start: Math.max(bounds.min, bounds.max - (p.days - 1) * DAY), end: bounds.max };
  };

  function lowerBound(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t < t) lo = mid + 1; else hi = mid; } return lo; }
  function upperBound(arr, t) { let lo = 0, hi = arr.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (arr[mid].t <= t) lo = mid + 1; else hi = mid; } return lo; }
  const slice = (arr, a, b) => arr.slice(lowerBound(arr, a), upperBound(arr, b));
  F.slice = slice;

  /** Recalculate IF.view from the records, applied filters and settings. */
  F.recompute = function () {
    const recs = IF.state.records, bounds = IF.state.bounds;
    if (!recs.length || !bounds) {
      IF.view = { range: null, prevRange: null, rangeDays: 0, nonDate: [], current: [], previous: [], all: [], bounds: null, excludingStatuses: false };
      return IF.view;
    }
    const range = F.computeRange(bounds);
    const len = Math.round((range.end - range.start) / DAY) + 1;
    const prevRange = { start: range.start - len * DAY, end: range.start - DAY };
    const a = F.applied;
    const excl = IF.settings.excludeCancelled && !a.status && IF.state.caps.status;
    const nonDate = recs.filter((r) => {
      if (a.category && (r.category || 'Unknown') !== a.category) return false;
      if (a.product && (r.product || 'Unknown') !== a.product) return false;
      if (a.city && (r.city || 'Unknown') !== a.city) return false;
      if (a.state && (r.state || 'Unknown') !== a.state) return false;
      if (a.payment && (r.payment || 'Unknown') !== a.payment) return false;
      if (a.status) return (r.status || 'Unknown') === a.status;
      return !(excl && r.status && F.EXCLUDED_STATUS.test(r.status));
    });
    IF.view = { range, prevRange, rangeDays: len, nonDate, current: slice(nonDate, range.start, range.end), previous: slice(nonDate, prevRange.start, prevRange.end), all: recs, bounds, excludingStatuses: !!excl };
    return IF.view;
  };

  F.hasActiveFilters = () => FILTER_FIELDS.some((f) => F.applied[f.key]);

  F.presetLabel = () => (IF.PRESETS.find((p) => p.id === F.applied.preset) || {}).label || '';

  F.setPreset = function (id, start, end) {
    F.applied.preset = id;
    if (id === 'custom') { if (start !== undefined) F.applied.start = start; if (end !== undefined) F.applied.end = end; }
  };

  F.reset = function () {
    F.pending = emptyFilters();
    Object.assign(F.applied, emptyFilters(), { preset: IF.settings.preset, start: null, end: null });
  };

  /** Distinct values for a filter field, with "Unknown" for blanks. */
  function distinct(records, getter) {
    const set = new Set();
    for (let i = 0; i < records.length; i++) set.add(getter(records[i]) || 'Unknown');
    return Array.from(set).sort((a, b) => (a === 'Unknown') - (b === 'Unknown') || a.localeCompare(b));
  }

  /* ---------- filter bar UI ---------- */
  F.renderBar = function () {
    const h = IF.h, caps = IF.state.caps, recs = IF.state.records;
    FILTER_FIELDS.forEach((f) => {
      const sel = document.getElementById(f.id);
      if (!sel) return;
      sel.textContent = '';
      const available = caps[f.cap] && recs.length;
      sel.disabled = !available;
      const wrap = sel.closest('.field');
      if (wrap) wrap.classList.toggle('is-disabled', !available);
      if (!available) { sel.append(h('option', { value: '', text: recs.length ? 'Not in your data' : 'No data loaded' })); return; }
      let pool = recs;
      if (f.key === 'product' && F.pending.category) pool = recs.filter((r) => (r.category || 'Unknown') === F.pending.category);
      const values = distinct(pool, f.get);
      if (F.pending[f.key] && values.indexOf(F.pending[f.key]) < 0) F.pending[f.key] = '';
      sel.append(h('option', { value: '', text: 'All' }));
      values.forEach((v) => sel.append(h('option', { value: v, text: v })));
      sel.value = F.pending[f.key];
    });
    F.renderChips();
    F.renderSummary();
  };

  F.renderSummary = function () {
    const el = document.getElementById('rangeSummary');
    if (!el) return;
    const v = IF.view;
    if (!v.range) { el.textContent = 'No data loaded.'; return; }
    el.textContent = 'Showing ' + IF.fmt.date(v.range.start) + ' to ' + IF.fmt.date(v.range.end) + ' (' + v.rangeDays + ' day' + (v.rangeDays === 1 ? '' : 's') + '), compared with ' + IF.fmt.date(v.prevRange.start) + ' to ' + IF.fmt.date(v.prevRange.end) + '. ' + IF.fmt.num(v.current.length) + ' row' + (v.current.length === 1 ? '' : 's') + ' in view.';
  };

  F.renderChips = function () {
    const box = document.getElementById('filterChips');
    if (!box) return;
    const h = IF.h;
    box.textContent = '';
    const chips = [];
    FILTER_FIELDS.forEach((f) => {
      if (F.applied[f.key]) chips.push(h('span', { class: 'chip' }, h('span', { text: f.label + ': ' + F.applied[f.key] }),
        h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Remove ' + f.label + ' filter', onclick: () => { F.pending[f.key] = ''; F.applied[f.key] = ''; IF.app.refresh(); } }, IF.icon('x', 12))));
    });
    if (IF.view.excludingStatuses) chips.push(h('span', { class: 'chip chip-note', title: 'Change this in Settings, or pick a status in the filter to see those orders.' }, 'Cancelled and returned orders are not counted'));
    if (chips.length > 1 || F.hasActiveFilters()) {
      if (F.hasActiveFilters()) chips.push(h('button', { type: 'button', class: 'link-btn', onclick: () => { F.reset(); IF.app.refresh(); } }, 'Clear all filters'));
    }
    if (!chips.length) { box.append(h('span', { class: 'muted small', text: 'No filters applied.' })); return; }
    chips.forEach((c) => box.append(c));
  };

  F.init = function () {
    FILTER_FIELDS.forEach((f) => {
      const sel = document.getElementById(f.id);
      if (!sel) return;
      sel.addEventListener('change', () => {
        F.pending[f.key] = sel.value;
        if (f.key === 'category') F.renderBar(); // product list depends on category
      });
    });
    document.getElementById('applyFilters').addEventListener('click', () => {
      FILTER_FIELDS.forEach((f) => { F.applied[f.key] = F.pending[f.key]; });
      IF.app.refresh();
      IF.ui.toast('success', 'Filters applied.');
    });
    document.getElementById('resetFilters').addEventListener('click', () => { F.reset(); IF.app.refresh(); IF.ui.toast('info', 'Filters reset.'); });
  };
})(typeof window !== 'undefined' ? window : globalThis);
