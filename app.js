/*!
 * InsightFlow — app.js
 * Application shell: icons, toasts and dialogs, KPI cards, Overview and Settings pages,
 * header (search, date range, notifications, theme, profile), router and data loading.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const A = IF.A, F = IF.fmt, h = IF.h;
  const $ = (id) => document.getElementById(id);
  IF.pages = IF.pages || {};
  IF.app = {};
  IF.ui = {};

  /* ------------------------------------------------------------------
   * Icons (inline SVG, Lucide-style outlines)
   * ------------------------------------------------------------------ */
  const ICONS = {
    overview: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    sales: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    products: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
    customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    geo: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    explorer: '<path d="M12 3v18"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/>',
    reports: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    settings: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
    up: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
    down: '<path d="m7 7 10 10"/><path d="M17 7v10H7"/>',
    flat: '<path d="M5 12h14"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    columns: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/>',
    entry: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/>',
    logo: '<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>'
  };
  IF.icon = function (name, size) {
    size = size || 18;
    const w = document.createElement('span');
    w.innerHTML = '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (ICONS[name] || '') + '</svg>';
    return w.firstChild;
  };
  IF.ui.hydrateIcons = function (scope) {
    (scope || document).querySelectorAll('[data-icon]').forEach((el) => { el.textContent = ''; el.append(IF.icon(el.dataset.icon, +el.dataset.size || 18)); });
  };

  /* ------------------------------------------------------------------
   * Toasts, busy overlay, confirm dialog
   * ------------------------------------------------------------------ */
  IF.ui.toast = function (type, message) {
    const box = $('toasts');
    if (!box) return;
    const t = h('div', { class: 'toast toast-' + type, role: type === 'error' ? 'alert' : 'status' },
      IF.icon(type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info', 18), h('span', { class: 'grow', text: message }),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Dismiss message', onclick: () => t.remove() }, IF.icon('x', 14)));
    box.append(t);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => t.remove(), type === 'error' ? 9000 : 5000);
  };
  IF.ui.busy = function (on, msg) {
    const el = $('busy');
    if (!el) return;
    el.hidden = !on;
    if (msg) $('busyMsg').textContent = msg;
    document.body.classList.toggle('is-busy', !!on);
  };
  IF.ui.confirm = function (o) {
    return new Promise((resolve) => {
      const d = $('confirmDialog');
      $('confirmTitle').textContent = o.title;
      $('confirmText').textContent = o.message;
      const ok = $('confirmOk');
      ok.textContent = o.confirmLabel || 'Confirm';
      ok.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary');
      d.returnValue = 'cancel';
      d.addEventListener('close', () => resolve(d.returnValue === 'ok'), { once: true });
      d.showModal();
      $('confirmCancel').focus();
    });
  };
  const tick = () => new Promise((r) => setTimeout(r, 30));

  /* ------------------------------------------------------------------
   * KPI definitions and calculation
   * ------------------------------------------------------------------ */
  IF.kpis = {
    defs: [
      { key: 'revenue', label: 'Total Revenue', tip: 'Sum of revenue from valid orders in the selected period. Rows with missing or negative revenue are left out.', fmt: (v) => F.cur(v) },
      { key: 'orders', label: 'Total Orders', tip: 'Number of unique Order IDs in the selected period. One order with several products counts once.', fmt: (v) => F.num(v), need: 'Map an Order ID column to calculate this.' },
      { key: 'units', label: 'Units Sold', tip: 'Sum of the Quantity column for the selected period.', fmt: (v) => F.num(v), need: 'Map a Quantity column to calculate this.' },
      { key: 'aov', label: 'Average Order Value', tip: 'Total Revenue divided by Total Orders. Shown as unavailable when there are no orders.', fmt: (v) => F.cur(v), need: 'Map an Order ID column to calculate this.' },
      { key: 'customers', label: 'Total Customers', tip: 'Number of unique customers (by Customer ID, or by name if there is no ID) who ordered in the selected period.', fmt: (v) => F.num(v), need: 'Map a Customer ID or Customer Name column to calculate this.' },
      { key: 'growth', label: 'Revenue Growth', tip: 'Growth % = (current revenue − previous revenue) ÷ previous revenue × 100. The previous period is the same number of days immediately before the selected range.', fmt: (v) => F.signedPct(v) }
    ],
    compute(view) {
      const caps = IF.state.caps;
      const cur = A.metrics(view.current, caps), prev = A.metrics(view.previous, caps);
      const hasPrev = view.previous.length > 0;
      return IF.kpis.defs.map((d) => {
        const k = { key: d.key, label: d.label, tip: d.tip };
        if (d.key === 'growth') {
          const g = A.pctChange(cur.revenue, hasPrev ? prev.revenue : null);
          Object.assign(k, { value: g, valueText: g === null ? 'N/A' : F.signedPct(g), change: g, changeText: g === null ? 'N/A' : F.signedPct(g), prevShort: hasPrev ? F.cur(prev.revenue) : 'No data',
            note: g === null ? (hasPrev ? 'Previous period revenue was zero, so growth cannot be calculated.' : 'No data in the previous period to compare with.') : 'Revenue ' + F.cur(cur.revenue) + ' vs ' + F.cur(prev.revenue) });
        } else {
          const v = cur[d.key], pv = hasPrev ? prev[d.key] : null;
          if (v === null) Object.assign(k, { value: null, valueText: '—', change: null, changeText: 'N/A', prevShort: '—', unavailable: d.need });
          else {
            const c = A.pctChange(v, pv);
            Object.assign(k, { value: v, valueText: d.fmt(v), prev: pv, prevShort: pv === null ? 'No data' : d.fmt(pv), change: c, changeText: F.signedPct(c),
              note: c === null ? (hasPrev ? 'Previous period value was zero, so no % change.' : 'No data in the previous period.') : 'vs ' + d.fmt(pv) + ' previous' });
          }
        }
        k.direction = k.change === null || k.change === undefined ? 'na' : k.change > 0 ? 'up' : k.change < 0 ? 'down' : 'flat';
        return k;
      });
    }
  };

  function renderKpis(view) {
    const grid = $('kpiGrid');
    grid.textContent = '';
    const kpis = IF.kpis.compute(view);
    const gran = A.autoGran(view.range);
    const series = view.current.length ? A.series(view.current, view.range, gran) : [];
    const pal = IF.charts.palette();
    const sparkVals = { revenue: series.map((s) => s.revenue), orders: series.map((s) => s.orders), units: series.map((s) => s.units), aov: series.map((s) => s.aov), customers: series.map((s) => s.customers) };
    kpis.forEach((k) => {
      const tipId = 'tip-' + k.key;
      const deltaIcon = k.direction === 'up' ? 'up' : k.direction === 'down' ? 'down' : 'flat';
      const card = h('article', { class: 'kpi', 'aria-label': k.label },
        h('div', { class: 'kpi-top' }, h('h3', { class: 'kpi-label', text: k.label }),
          h('span', { class: 'tip-wrap' }, h('button', { type: 'button', class: 'info-btn', 'aria-label': 'About ' + k.label, 'aria-describedby': tipId }, IF.icon('info', 15)), h('span', { role: 'tooltip', id: tipId, class: 'tooltip', text: k.tip }))),
        h('div', { class: 'kpi-value', text: k.valueText }),
        k.unavailable ? h('p', { class: 'kpi-delta muted small', text: k.unavailable }) :
          h('p', { class: 'kpi-delta ' + k.direction },
            k.direction !== 'na' ? IF.icon(deltaIcon, 14) : null,
            k.key === 'growth' ? null : h('strong', { text: k.changeText + ' ' }),
            h('span', { class: 'small', text: k.note || '' })),
        sparkVals[k.key] ? h('div', { class: 'kpi-spark chart-box' }, h('canvas', { id: 'spark-' + k.key, role: 'img', 'aria-label': 'Trend of ' + k.label + ' across the selected period' })) : null);
      grid.append(card);
      if (sparkVals[k.key] && sparkVals[k.key].length > 1 && !k.unavailable) IF.charts.make('spark-' + k.key, IF.charts.build.sparkline(sparkVals[k.key], k.direction === 'down' ? '#d64545' : pal.colors[0]));
    });
  }

  /* ------------------------------------------------------------------
   * Overview page
   * ------------------------------------------------------------------ */
  IF.pages.overview = {
    render() {
      const view = IF.view, p = IF.charts.palette();
      $('overviewSub').textContent = F.date(view.range.start) + ' to ' + F.date(view.range.end) + ', compared with the previous ' + view.rangeDays + ' day' + (view.rangeDays === 1 ? '' : 's') + '.';
      renderKpis(view);
      IF.charts.make('chRevenue', IF.charts.build.revenueTime(view, $('granSelect').value, p));
      IF.charts.make('chCategory', IF.charts.build.category(view, p));
      const sortSel = $('topSortSelect');
      sortSel.querySelector('option[value="units"]').disabled = !IF.state.caps.units;
      if (!IF.state.caps.units) sortSel.value = 'revenue';
      IF.charts.make('chTopProducts', IF.charts.build.topProducts(view, sortSel.value, p));
      const ul = $('insightsList'); ul.textContent = '';
      const items = A.insights(view, IF.state.caps);
      if (!items.length) ul.append(h('li', { class: 'muted', text: 'No findings yet. There are no sales in the selected range.' }));
      items.forEach((t) => ul.append(h('li', { text: t })));
    },
    init() {
      $('granSelect').addEventListener('change', () => IF.app.renderPage());
      $('topSortSelect').addEventListener('change', () => IF.app.renderPage());
    }
  };

  /* ------------------------------------------------------------------
   * Settings page
   * ------------------------------------------------------------------ */
  IF.pages.settings = {
    render() {
      const root_ = $('settingsRoot'), st = IF.state, S = IF.settings;
      root_.textContent = '';
      const select = (id, label, value, options, onchange, help) => {
        const sel = h('select', { id, class: 'input' }, options.map((o) => h('option', { value: o[0], text: o[1] })));
        sel.value = String(value);
        sel.addEventListener('change', () => onchange(sel.value));
        return h('div', { class: 'field' }, h('label', { for: id, text: label }), sel, help ? h('p', { class: 'small muted', text: help }) : null);
      };
      const card = (title, ...kids) => h('section', { class: 'card' }, h('h2', { class: 'card-title', text: title }), ...kids);

      root_.append(card('Appearance',
        select('setTheme', 'Theme', S.theme, [['light', 'Light'], ['dark', 'Dark']], (v) => IF.app.setSetting('theme', v))));

      root_.append(card('Formats',
        h('div', { class: 'form-grid' },
          select('setCurrency', 'Currency', S.currency, Object.keys(IF.CURRENCIES).map((k) => [k, IF.CURRENCIES[k]]), (v) => IF.app.setSetting('currency', v)),
          select('setNumFmt', 'Number format', S.numberFormat, [['indian', 'Indian grouping (12,34,567)'], ['international', 'International grouping (1,234,567)']], (v) => IF.app.setSetting('numberFormat', v)),
          select('setDateFmt', 'Date format', S.dateFormat, IF.DATE_FORMATS.map((d) => [d, d + '  (e.g. ' + F.date(Date.UTC(2026, 2, 5)).replace(/.*/, '') + ({ 'DD MMM YYYY': '05 Mar 2026', 'DD/MM/YYYY': '05/03/2026', 'MM/DD/YYYY': '03/05/2026', 'YYYY-MM-DD': '2026-03-05' }[d]) + ')']), (v) => IF.app.setSetting('dateFormat', v)),
          select('setPageSize', 'Default rows per page', S.pageSize, [10, 25, 50, 100].map((n) => [n, String(n)]), (v) => IF.app.setSetting('pageSize', +v))),
        h('p', { class: 'state state-info small' }, IF.icon('info', 16), ' Currency changes how amounts are displayed (symbol and digit grouping) only. No exchange-rate conversion is performed: a value of 1,000 stays 1,000 in whichever currency you choose.')));

      const cb = h('input', { type: 'checkbox', id: 'setExcl', checked: S.excludeCancelled });
      cb.addEventListener('change', () => IF.app.setSetting('excludeCancelled', cb.checked));
      root_.append(card('Calculations',
        h('label', { class: 'check', for: 'setExcl' }, cb, h('span', null, h('strong', { text: 'Do not count cancelled or returned orders' }), h('br'), h('span', { class: 'small muted', text: 'Applies when an Order Status column is mapped and no status filter is chosen. Turn off to count every valid row as revenue.' })))));

      const src = st.source.type === 'demo' ? 'Demo data (fictional)' : st.source.type === 'manual' ? 'My Entries (typed in)' : st.source.type === 'file' ? st.source.name + (st.source.sheet ? ' — ' + st.source.sheet : '') : 'No data loaded';
      const hasData = st.records.length > 0;
      root_.append(card('Data',
        h('p', null, h('strong', { text: 'Current data: ' }), src, hasData ? ' · ' + F.num(st.records.length) + ' usable rows' : ''),
        h('div', { class: 'btn-row' },
          h('button', { type: 'button', class: 'btn', onclick: () => IF.upload.open() }, IF.icon('upload', 16), ' Upload data'),
          h('button', { type: 'button', class: 'btn', onclick: () => IF.app.confirmDemoReset() }, IF.icon('refresh', 16), ' Reload demo data'),
          h('button', { type: 'button', class: 'btn', onclick: () => IF.app.downloadSample() }, IF.icon('download', 16), ' Download sample CSV'),
          h('button', { type: 'button', class: 'btn btn-danger', disabled: !hasData, onclick: () => IF.app.clearData() }, IF.icon('trash', 16), ' Clear data')),
        h('p', { class: 'small muted', text: 'Clear data removes the loaded dataset from this page. Your original file is not touched.' })));

      root_.append(card('Reset',
        h('p', { text: 'Reset the dashboard to its starting state: default preferences, no filters, and the demo dataset.' }),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn-danger', onclick: () => IF.app.resetDashboard() }, IF.icon('refresh', 16), ' Reset dashboard'))));

      root_.append(card('Privacy and browser storage',
        h('ul', { class: 'notes' },
          h('li', { text: 'Your files are read and analysed inside your browser. They are not uploaded to any server.' }),
          h('li', { text: 'Uploaded data is kept in memory only. It disappears when you reload or close this page. Nothing from an uploaded file is written to LocalStorage.' }),
          h('li', { text: 'LocalStorage is used for display preferences (theme, currency, formats, rows per page, date range, last page) and, only if “Save my entries in this browser” is on, for the orders you type into Data Entry. It is not encrypted, it stays on this browser and device, and the browser can clear it at any time. Download a backup regularly.' }),
          h('li', { text: 'LocalStorage is suitable for demo preferences, not for secure storage of sensitive business data.' }))));
    }
  };

  /* ------------------------------------------------------------------
   * Settings actions
   * ------------------------------------------------------------------ */
  let warnedStorage = false;
  IF.app.setSetting = function (key, value) {
    IF.settings[key] = value;
    if (['currency', 'numberFormat', 'dateFormat'].indexOf(key) >= 0) F.reset();
    if (!IF.prefs.save() && !warnedStorage) { warnedStorage = true; IF.ui.toast('info', 'Your browser blocked saving preferences, so they will reset when you reload.'); }
    if (key === 'theme') applyTheme();
    if (key === 'excludeCancelled') IF.F.recompute();
    IF.app.render();
  };
  IF.app.confirmDemoReset = async function () {
    const t = IF.state.source.type;
    if (t === 'file' || t === 'manual') {
      const ok = await IF.ui.confirm({ title: 'Replace your data with the demo dataset?', message: t === 'file' ? 'Your uploaded data is only stored in this page’s memory, so it will be lost. Your original file is not changed.' : 'The dashboard will show the fictional demo data instead. The orders you typed in are not deleted: use Data Entry → “Show my entries” to bring them back.', confirmLabel: 'Load demo data', danger: t === 'file' });
      if (!ok) return;
    }
    await IF.app.loadDemo();
  };
  IF.app.clearData = async function () {
    const manual = IF.state.source.type === 'manual';
    const ok = await IF.ui.confirm({ title: 'Clear the loaded data?', message: manual ? 'This permanently deletes every order you typed into Data Entry (including the saved copy in this browser). Download a backup first if you need one.' : 'This removes the current dataset from the dashboard. Your original file is not changed. You can load the demo data or upload a file again at any time.', confirmLabel: 'Clear data', danger: true });
    if (!ok) return;
    if (manual) IF.entry.clearAll(true);
    Object.assign(IF.state, { table: null, mapping: {}, records: [], quality: null, caps: {}, bounds: null, source: { type: 'none', name: '', sheet: '' }, colTypes: null });
    IF.F.reset(); IF.F.recompute(); buildSearchIndex();
    IF.app.notify('info', 'Data cleared', 'The dashboard is empty. Load demo data or upload a file.');
    IF.app.render();
    IF.ui.toast('success', 'Data cleared.');
  };
  IF.app.resetDashboard = async function () {
    const ok = await IF.ui.confirm({ title: 'Reset the dashboard?', message: 'This restores default preferences, clears all filters and reloads the demo data. Uploaded data will be lost. Orders you typed in are not deleted; bring them back with Data Entry → “Show my entries”.', confirmLabel: 'Reset dashboard', danger: true });
    if (!ok) return;
    IF.prefs.clear();
    IF.settings = Object.assign({}, IF.defaults);
    F.reset(); applyTheme();
    await IF.app.loadDemo();
    IF.app.go('overview');
    IF.ui.toast('success', 'Dashboard reset.');
  };
  IF.app.downloadSample = function () {
    IF.download('sample-sales.csv', IF.demoCSV());
    IF.ui.toast('success', 'Downloaded sample-sales.csv (fictional demo data).');
  };

  /* ------------------------------------------------------------------
   * Data loading
   * ------------------------------------------------------------------ */
  IF.app.loadDataset = async function (p) {
    if (!p.quiet) { IF.ui.busy(true, 'Preparing your dashboard…'); await tick(); }
    try {
      const st = IF.state;
      st.table = p.table; st.mapping = p.mapping; st.records = p.records; st.quality = p.quality;
      st.caps = IF.computeCaps(p.mapping); st.source = p.source; st.dateFormat = p.dateFormat; st.removeDuplicates = p.removeDuplicates; st.colTypes = null;
      st.bounds = p.records.length ? { min: p.records[0].t, max: p.records[p.records.length - 1].t } : null;
      if (!p.quiet) { IF.F.reset(); IF.F.applied.preset = IF.settings.preset; }
      IF.F.recompute(); buildSearchIndex();
      if (p.quiet) { /* silent refresh after a typed entry */ }
      else if (p.source.type === 'manual') IF.app.notify('info', 'My Entries loaded', F.num(p.records.length) + ' rows from the orders you typed in.');
      else if (p.source.type === 'demo') IF.app.notify('info', 'Demo data loaded', 'Fictional sales for 12 months. Upload your own file to analyse real data.');
      else IF.app.notify('success', 'Data imported', F.num(p.records.length) + ' rows ready from ' + p.source.name + (p.quality.excludedTotal ? '; ' + F.num(p.quality.excludedTotal) + ' left out.' : '.'));
      IF.app.render();
      if (p.source.type === 'file') IF.ui.toast('success', 'Imported ' + F.num(p.records.length) + ' rows from ' + p.source.name + '.');
    } catch (e) {
      console.error('Import error:', e && e.message);
      IF.ui.toast('error', 'Something went wrong while preparing the dashboard. Your data was not changed.');
    } finally { if (!p.quiet) IF.ui.busy(false); }
  };
  IF.app.loadDemo = async function () {
    const table = IF.generateDemo();
    const mapping = IF.detectMapping(table.headers);
    const res = IF.normalize(table, mapping, { dateFormat: 'DMY', removeDuplicates: true });
    await IF.app.loadDataset({ table, mapping, records: res.records, quality: res.quality, dateFormat: 'DMY', removeDuplicates: true, source: { type: 'demo', name: 'Demo sales data', sheet: '' } });
  };

  /* ------------------------------------------------------------------
   * Rendering and routing
   * ------------------------------------------------------------------ */
  let currentPage = 'overview';
  const TITLES = { overview: 'Overview', sales: 'Sales Analytics', products: 'Products', customers: 'Customers', geo: 'Geographic Analysis', entry: 'Data Entry', explorer: 'Data Explorer', reports: 'Reports', settings: 'Settings' };

  IF.app.refresh = function () { IF.F.recompute(); IF.app.render(); };

  IF.app.render = function () {
    const st = IF.state, has = st.records.length > 0;
    applyChrome();
    const free = (p) => p === 'settings' || p === 'entry'; // pages that work without data
    const showData = has && !free(currentPage);
    $('noData').hidden = has || free(currentPage);
    $('filterArea').hidden = !showData;
    $('demoBanner').hidden = !(st.source.type === 'demo');
    $('noResults').hidden = !(showData && IF.view.current.length === 0);
    IF.PAGES.forEach((p) => { $('page-' + p).hidden = p !== currentPage || (!has && !free(p)); });
    if (showData) IF.F.renderBar();
    IF.app.renderPage();
  };

  IF.app.renderPage = function () {
    IF.charts.destroyAll();
    const has = IF.state.records.length > 0;
    if (!has && currentPage !== 'settings' && currentPage !== 'entry') return;
    try { IF.pages[currentPage].render(); } catch (e) {
      console.error('Page error (' + currentPage + '):', e && e.message);
      IF.ui.toast('error', 'This page could not be displayed completely. Try another filter or reload the data.');
    }
  };

  IF.app.go = function (page) {
    if (IF.PAGES.indexOf(page) < 0) page = 'overview';
    if (('#' + page) === location.hash) route(); else location.hash = page;
  };
  function route() {
    let page = location.hash.replace('#', '');
    if (IF.PAGES.indexOf(page) < 0) page = IF.settings.lastPage || 'overview';
    const changed = page !== currentPage;
    currentPage = page;
    document.querySelectorAll('.nav-link').forEach((a) => { if (a.dataset.page === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    document.title = TITLES[page] + ' · InsightFlow — Jatnex Technologies';
    closeSidebar();
    IF.app.render();
    if (changed) {
      const hd = document.querySelector('#page-' + page + ' h1');
      if (hd) hd.focus({ preventScroll: true });
      root.scrollTo(0, 0);
      IF.settings.lastPage = page; IF.prefs.save();
    }
  }

  /* header state: demo pill, date presets, custom dates */
  function applyChrome() {
    const st = IF.state, has = st.records.length > 0, a = IF.F.applied;
    $('demoPill').hidden = st.source.type !== 'demo';
    const sel = $('presetSelect');
    sel.disabled = !has;
    sel.value = a.preset;
    const custom = has && a.preset === 'custom';
    $('customDates').hidden = !custom;
    if (custom && IF.view.range) {
      $('customStart').value = F.iso(IF.view.range.start); $('customEnd').value = F.iso(IF.view.range.end);
      $('customStart').min = $('customEnd').min = F.iso(st.bounds.min); $('customStart').max = $('customEnd').max = F.iso(st.bounds.max);
    }
    $('themeBtn').setAttribute('aria-pressed', String(IF.settings.theme === 'dark'));
    $('themeBtn').setAttribute('aria-label', IF.settings.theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    $('themeBtn').textContent = ''; $('themeBtn').append(IF.icon(IF.settings.theme === 'dark' ? 'sun' : 'moon', 18));
    const b = $('notifBadge'); b.textContent = String(st.unread); b.hidden = !st.unread;
  }

  function applyTheme() { document.documentElement.setAttribute('data-theme', IF.settings.theme); }

  /* ------------------------------------------------------------------
   * Notifications
   * ------------------------------------------------------------------ */
  IF.app.notify = function (type, title, detail) {
    const st = IF.state;
    st.notifications.unshift({ type, title, detail, time: new Date() });
    st.notifications.length = Math.min(st.notifications.length, 20);
    st.unread++;
    renderNotifs();
  };
  function renderNotifs() {
    const list = $('notifList'); list.textContent = '';
    const items = IF.state.notifications;
    if (!items.length) list.append(h('li', { class: 'muted small', text: 'No notifications yet.' }));
    items.forEach((n) => list.append(h('li', { class: 'notif' }, IF.icon(n.type === 'success' ? 'check' : n.type === 'error' ? 'alert' : 'info', 16),
      h('div', null, h('strong', { text: n.title }), h('p', { class: 'small muted', text: n.detail || '' }), h('p', { class: 'small muted', text: String(n.time.getHours()).padStart(2, '0') + ':' + String(n.time.getMinutes()).padStart(2, '0') })))));
    const q = IF.state.quality;
    if (q && (q.excludedTotal || q.warnings.length)) {
      list.append(h('li', { class: 'notif' }, IF.icon('alert', 16), h('div', null, h('strong', { text: 'Data-quality notes' }),
        h('p', { class: 'small muted', text: F.num(q.excludedTotal) + ' row(s) left out at import. ' + q.warnings.slice(0, 2).join(' ') }))));
    }
  }

  /* ------------------------------------------------------------------
   * Global search (products, customers, cities, pages)
   * ------------------------------------------------------------------ */
  let searchIndex = [];
  function buildSearchIndex() {
    searchIndex = [];
    const st = IF.state;
    IF.PAGES.forEach((p) => searchIndex.push({ type: 'Page', label: TITLES[p], page: p }));
    const prods = new Set(), custs = new Set(), cities = new Set();
    st.records.forEach((r) => { if (r.product) prods.add(r.product); if (r.customerName || r.customerId) custs.add(r.customerName || r.customerId); if (r.city) cities.add(r.city); });
    prods.forEach((x) => searchIndex.push({ type: 'Product', label: x }));
    cities.forEach((x) => searchIndex.push({ type: 'City', label: x }));
    custs.forEach((x) => searchIndex.push({ type: 'Customer', label: x }));
  }
  function initSearch() {
    const input = $('globalSearch'), list = $('searchResults');
    let items = [], active = -1, timer = null;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const choose = (it) => {
      close(); input.value = '';
      if (it.type === 'Page') IF.app.go(it.page);
      else if (it.type === 'Product') { IF.pageSearch.products = it.label; IF.app.go('products'); }
      else if (it.type === 'Customer') { IF.pageSearch.customers = it.label; IF.app.go('customers'); }
      else if (it.type === 'City') { IF.pageSearch.geo = it.label; IF.pages.geo.level = 'city'; IF.app.go('geo'); }
    };
    const paint = () => {
      list.textContent = '';
      items.forEach((it, i) => list.append(h('li', { role: 'option', id: 'sr-' + i, class: i === active ? 'is-active' : '', 'aria-selected': String(i === active), onmousedown: (e) => { e.preventDefault(); choose(it); } }, h('span', { class: 'sr-type', text: it.type }), h('span', { class: 'ellipsis', text: it.label }))));
      if (!items.length) list.append(h('li', { class: 'muted small sr-empty', role: 'option', 'aria-disabled': 'true', text: 'No matches in pages, products, customers or cities.' }));
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
      if (active >= 0) input.setAttribute('aria-activedescendant', 'sr-' + active); else input.removeAttribute('aria-activedescendant');
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const q = input.value.trim().toLowerCase();
        if (!q) { close(); return; }
        items = searchIndex.filter((x) => x.label.toLowerCase().indexOf(q) >= 0).slice(0, 40);
        const order = { Page: 0, Product: 1, Customer: 2, City: 3 }, seen = {};
        items = items.sort((a, b) => order[a.type] - order[b.type]).filter((x) => { seen[x.type] = (seen[x.type] || 0) + 1; return seen[x.type] <= 4; });
        active = items.length ? 0 : -1;
        paint();
      }, 120);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (list.hidden || !items.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; paint(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(items[active]); }
    });
    input.addEventListener('blur', () => setTimeout(close, 120));
  }

  /* ------------------------------------------------------------------
   * Popovers, sidebar, header wiring
   * ------------------------------------------------------------------ */
  const popovers = [];
  function popover(btnId, panelId, onOpen) {
    const btn = $(btnId), panel = $(panelId);
    const close = () => { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = panel.hidden;
      popovers.forEach((p) => p.close());
      if (open) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); if (onOpen) onOpen(); }
    });
    panel.addEventListener('click', (e) => e.stopPropagation());
    popovers.push({ close, btn, panel });
  }
  function closeSidebar() { $('sidebar').classList.remove('is-open'); $('scrim').hidden = true; $('menuBtn').setAttribute('aria-expanded', 'false'); }

  function initChrome() {
    // preset select
    const sel = $('presetSelect');
    IF.PRESETS.forEach((p) => sel.append(h('option', { value: p.id, text: p.label })));
    sel.addEventListener('change', () => {
      if (sel.value === 'custom' && IF.view.range) IF.F.setPreset('custom', IF.view.range.start, IF.view.range.end);
      else IF.F.setPreset(sel.value);
      if (sel.value !== 'custom') { IF.settings.preset = sel.value; IF.prefs.save(); }
      IF.app.refresh();
    });
    const onCustom = () => {
      let s = IF.parseDate($('customStart').value), e = IF.parseDate($('customEnd').value);
      if (s === null || e === null) { IF.ui.toast('error', 'Enter both a start date and an end date.'); return; }
      if (s > e) { const x = s; s = e; e = x; IF.ui.toast('info', 'The start date was after the end date, so the dates were swapped.'); }
      IF.F.setPreset('custom', s, e);
      IF.app.refresh();
    };
    $('customStart').addEventListener('change', onCustom);
    $('customEnd').addEventListener('change', onCustom);

    $('themeBtn').addEventListener('click', () => IF.app.setSetting('theme', IF.settings.theme === 'dark' ? 'light' : 'dark'));
    $('uploadBtn').addEventListener('click', () => IF.upload.open());
    $('menuBtn').addEventListener('click', () => {
      const open = !$('sidebar').classList.contains('is-open');
      $('sidebar').classList.toggle('is-open', open); $('scrim').hidden = !open; $('menuBtn').setAttribute('aria-expanded', String(open));
      if (open) $('sidebar').querySelector('.nav-link').focus();
    });
    $('scrim').addEventListener('click', closeSidebar);
    popover('notifBtn', 'notifPanel', () => { IF.state.unread = 0; applyChrome(); renderNotifs(); });
    popover('profileBtn', 'profileMenu');
    document.addEventListener('click', () => popovers.forEach((p) => p.close()));
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const open = popovers.find((p) => !p.panel.hidden);
      if (open) { open.close(); open.btn.focus(); } else closeSidebar();
    });
    $('profileSettings').addEventListener('click', () => { popovers.forEach((p) => p.close()); IF.app.go('settings'); });
    $('profileDemo').addEventListener('click', () => { popovers.forEach((p) => p.close()); IF.app.confirmDemoReset(); });
    $('profileTheme').addEventListener('click', () => { popovers.forEach((p) => p.close()); IF.app.setSetting('theme', IF.settings.theme === 'dark' ? 'light' : 'dark'); });

    // empty-state and banner buttons
    ['noDataDemo', 'bannerDemo'].forEach((id) => { const b = $(id); if (b) b.addEventListener('click', () => IF.app.confirmDemoReset()); });
    ['noDataUpload', 'bannerUpload'].forEach((id) => { const b = $(id); if (b) b.addEventListener('click', () => IF.upload.open()); });
    $('noResultsClear').addEventListener('click', () => { IF.F.reset(); IF.app.refresh(); });
    $('noResultsAll').addEventListener('click', () => { IF.F.setPreset('all'); IF.app.refresh(); });
    $('sampleLink').addEventListener('click', (e) => { e.preventDefault(); IF.app.downloadSample(); });
    document.querySelectorAll('.nav-link').forEach((a) => a.addEventListener('click', () => { if (('#' + a.dataset.page) === location.hash) { e_(); } function e_() { route(); } }));
    initSearch();
  }

  /* ------------------------------------------------------------------
   * Start-up
   * ------------------------------------------------------------------ */
  IF.app.init = async function () {
    IF.prefs.load();
    applyTheme();
    IF.ui.hydrateIcons();
    const missing = [];
    if (typeof root.Chart === 'undefined') missing.push('Chart.js (charts)');
    if (typeof root.Papa === 'undefined') missing.push('PapaParse (CSV upload)');
    if (typeof root.XLSX === 'undefined') missing.push('SheetJS (Excel upload)');
    if (missing.length) { const w = $('libWarn'); w.hidden = false; w.querySelector('span').textContent = 'Some libraries did not load: ' + missing.join(', ') + '. They come from a CDN, so check your internet connection and refresh. The rest of the dashboard still works.'; }
    const hasSaved = IF.entry.loadSaved(); // typed orders saved in this browser (if the user kept that option on)
    IF.F.init();
    IF.upload.init();
    ['overview', 'sales', 'geo', 'entry', 'explorer', 'reports'].forEach((p) => { if (IF.pages[p].init) IF.pages[p].init(); });
    initChrome();
    renderNotifs();
    root.addEventListener('hashchange', route);
    IF.F.applied.preset = IF.settings.preset;
    if (hasSaved) await IF.entry.commit(); else await IF.app.loadDemo();
    route();
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => IF.app.init());
    else IF.app.init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
