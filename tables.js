/*!
 * InsightFlow — tables.js
 * A reusable searchable / sortable / paginated table, plus the Products,
 * Customers, Geographic Analysis and Data Explorer pages built on it.
 * Cells are always written as text (never HTML), so imported values cannot inject markup.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const A = IF.A, F = IF.fmt, h = IF.h;
  IF.pages = IF.pages || {};
  IF.pageSearch = { products: '', customers: '', geo: '' };
  let uid = 0;

  /* ------------------------------------------------------------------
   * Table component
   * columns: [{ key, label, get?, format?(v,row), num?, sortKey?, sortValue?, badge?, exportValue? }]
   * ------------------------------------------------------------------ */
  IF.Table = function (container, opts) {
    const id = 'tbl' + ++uid;
    const self = this;
    const st = { rows: [], view: [], page: 1, pageSize: opts.pageSize || IF.settings.pageSize, sort: opts.defaultSort || null, search: '', filter: null, columns: opts.columns.slice(), hidden: new Set() };
    const sizes = opts.pageSizes || [10, 25, 50, 100];
    if (sizes.indexOf(st.pageSize) < 0) st.pageSize = sizes[0];
    let debounce = null;

    container.textContent = '';
    container.classList.add('table-card');
    const tools = h('div', { class: 'table-tools' });
    let searchInput = null;
    if (opts.search !== false) {
      searchInput = h('input', { type: 'search', id: id + '-q', class: 'input', placeholder: opts.searchPlaceholder || 'Search…', autocomplete: 'off' });
      searchInput.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(() => { st.search = searchInput.value.trim().toLowerCase(); st.page = 1; recompute(); render(); }, 180); });
      tools.append(h('div', { class: 'field field-inline' }, h('label', { for: id + '-q', class: 'visually-hidden', text: 'Search table' }), searchInput));
    }
    (opts.toolbarStart || []).forEach((el) => tools.append(el));
    const spacer = h('span', { class: 'grow' });
    tools.append(spacer);
    const menuHost = h('span');
    tools.append(menuHost);
    (opts.toolbarEnd || []).forEach((el) => tools.append(el));
    const sizeSel = h('select', { id: id + '-ps', class: 'input input-sm' }, sizes.map((n) => h('option', { value: n, text: n + ' rows' })));
    sizeSel.value = String(st.pageSize);
    sizeSel.addEventListener('change', () => { st.pageSize = +sizeSel.value; st.page = 1; render(); });
    tools.append(h('div', { class: 'field field-inline' }, h('label', { for: id + '-ps', class: 'visually-hidden', text: 'Rows per page' }), sizeSel));

    const table = h('table', { class: 'data' });
    const scroller = h('div', { class: 'table-scroll', tabindex: '0', role: 'region', 'aria-label': (opts.label || 'Data table') + ' (scrolls sideways on small screens)' }, table);
    const info = h('p', { class: 'small muted', 'aria-live': 'polite' });
    const pager = h('div', { class: 'pager' });
    container.append(tools, scroller, h('div', { class: 'table-foot' }, info, pager));

    const visibleCols = () => st.columns.filter((c) => !st.hidden.has(c.key));
    const val = (c, row) => (c.get ? c.get(row) : row[c.key]);
    const sortVal = (c, row) => (c.sortValue ? c.sortValue(row) : c.sortKey ? row[c.sortKey] : val(c, row));

    function recompute() {
      let rows = st.rows;
      if (st.filter) rows = rows.filter(st.filter);
      if (st.search) {
        const cols = visibleCols();
        rows = rows.filter((r) => {
          if (opts.searchText && !opts.columnMenu) return opts.searchText(r).indexOf(st.search) >= 0;
          for (let i = 0; i < cols.length; i++) { const v = val(cols[i], r); if (v !== null && v !== undefined && String(v).toLowerCase().indexOf(st.search) >= 0) return true; }
          return false;
        });
      }
      if (st.sort) {
        const c = st.columns.find((x) => x.key === st.sort.key);
        if (c) {
          const dir = st.sort.dir === 'asc' ? 1 : -1;
          rows = rows.slice().sort((a, b) => {
            const x = sortVal(c, a), y = sortVal(c, b);
            const nx = x === null || x === undefined || x === '', ny = y === null || y === undefined || y === '';
            if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1; // empty values always last
            if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
            const nxn = parseFloat(x), nyn = parseFloat(y);
            if (!isNaN(nxn) && !isNaN(nyn) && String(nxn) === String(x).trim() && String(nyn) === String(y).trim()) return (nxn - nyn) * dir;
            return String(x).localeCompare(String(y), undefined, { numeric: true }) * dir;
          });
        }
      }
      st.view = rows;
    }

    function render() {
      const cols = visibleCols();
      const pages = Math.max(1, Math.ceil(st.view.length / st.pageSize));
      if (st.page > pages) st.page = pages;
      const startIdx = (st.page - 1) * st.pageSize;
      const slice = st.view.slice(startIdx, startIdx + st.pageSize);

      table.textContent = '';
      const tr = h('tr');
      cols.forEach((c) => {
        const active = st.sort && st.sort.key === c.key;
        const th = h('th', { scope: 'col', class: c.num ? 'num' : '', 'aria-sort': active ? (st.sort.dir === 'asc' ? 'ascending' : 'descending') : 'none' });
        if (c.noSort) { th.removeAttribute('aria-sort'); th.append(c.label); tr.append(th); return; }
        th.append(h('button', { type: 'button', class: 'th-btn', 'aria-label': 'Sort by ' + c.label, onclick: () => {
          st.sort = { key: c.key, dir: active && st.sort.dir === 'desc' ? 'asc' : active ? 'desc' : (c.num ? 'desc' : 'asc') };
          st.page = 1; recompute(); render();
        } }, h('span', { text: c.label }), h('span', { class: 'sort-ind', 'aria-hidden': 'true', text: active ? (st.sort.dir === 'asc' ? '▲' : '▼') : '↕' })));
        if (c.badge) th.append(h('span', { class: 'type-tag', text: c.badge }));
        tr.append(th);
      });
      table.append(h('thead', null, tr));
      const tb = h('tbody');
      if (!slice.length) tb.append(h('tr', null, h('td', { colspan: Math.max(1, cols.length), class: 'empty-cell', text: (st.search || st.filter) ? 'No rows match your search or filter.' : (opts.emptyMessage || 'No data to show.') })));
      slice.forEach((row) => {
        const r = h('tr');
        cols.forEach((c) => {
          if (c.render) { const td = h('td', { class: c.num ? 'num' : '' }); c.render(row, td); r.append(td); return; }
          const v = val(c, row);
          const text = c.format ? c.format(v, row) : (v === null || v === undefined || v === '' ? '—' : String(v));
          r.append(h('td', { class: c.num ? 'num' : '', text }));
        });
        tb.append(r);
      });
      table.append(tb);

      const from = st.view.length ? startIdx + 1 : 0, to = Math.min(st.view.length, startIdx + st.pageSize);
      info.textContent = 'Showing ' + F.num(from) + '–' + F.num(to) + ' of ' + F.num(st.view.length) + ' row' + (st.view.length === 1 ? '' : 's') + (st.view.length !== st.rows.length ? ' (filtered from ' + F.num(st.rows.length) + ')' : '');
      pager.textContent = '';
      const btn = (label, page, disabled, aria) => h('button', { type: 'button', class: 'btn btn-sm', disabled, 'aria-label': aria, onclick: () => { st.page = page; render(); } }, label);
      pager.append(btn('« First', 1, st.page === 1, 'First page'), btn('‹ Previous', st.page - 1, st.page === 1, 'Previous page'),
        h('span', { class: 'small', text: 'Page ' + st.page + ' of ' + pages }),
        btn('Next ›', st.page + 1, st.page === pages, 'Next page'), btn('Last »', pages, st.page === pages, 'Last page'));
    }

    function buildColumnMenu() {
      menuHost.textContent = '';
      if (!opts.columnMenu) return;
      const panel = h('div', { class: 'menu-panel' });
      st.columns.forEach((c, i) => {
        const cb = h('input', { type: 'checkbox', id: id + '-col' + i, checked: !st.hidden.has(c.key) });
        cb.addEventListener('change', () => {
          if (cb.checked) st.hidden.delete(c.key); else st.hidden.add(c.key);
          if (st.hidden.size >= st.columns.length) { st.hidden.delete(c.key); cb.checked = true; IF.ui.toast('info', 'At least one column must stay visible.'); return; }
          recompute(); render();
        });
        panel.append(h('label', { class: 'check', for: id + '-col' + i }, cb, h('span', { text: c.label })));
      });
      menuHost.append(h('details', { class: 'menu' }, h('summary', { class: 'btn btn-sm' }, IF.icon('columns', 16), ' Columns'), panel));
    }

    /* public API */
    self.setRows = function (rows) { st.rows = rows; st.page = 1; recompute(); render(); };
    self.setColumns = function (cols) { st.columns = cols.slice(); st.hidden = new Set(); if (st.sort && !cols.some((c) => c.key === st.sort.key)) st.sort = opts.defaultSort && cols.some((c) => c.key === opts.defaultSort.key) ? opts.defaultSort : null; buildColumnMenu(); recompute(); render(); };
    self.setFilter = function (fn) { st.filter = fn; st.page = 1; recompute(); render(); };
    self.setSearch = function (term) { if (!searchInput) return; searchInput.value = term || ''; st.search = (term || '').trim().toLowerCase(); st.page = 1; recompute(); render(); };
    self.refresh = function () { recompute(); render(); };
    self.getViewRows = () => st.view;
    self.getColumns = () => visibleCols();
    self.cellText = (c, row) => { const v = c.exportValue ? c.exportValue(row) : val(c, row); return v === undefined ? null : v; };
    self.getSearch = () => st.search;
    buildColumnMenu();
    render();
  };

  /** Export a table's current rows (after search/filter/sort) as CSV. */
  IF.exportTable = function (tbl, filename) {
    const cols = tbl.getColumns();
    const rows = tbl.getViewRows().map((r) => cols.map((c) => tbl.cellText(c, r)));
    IF.download(filename, IF.toCSV(cols.map((c) => c.label), rows));
    IF.ui.toast('success', 'Downloaded ' + filename + ' (' + F.num(rows.length) + ' rows).');
  };

  const unavailableBox = (title, text) => h('div', { class: 'state state-info', role: 'status' }, h('strong', { text: title }), h('p', { text }),
    h('button', { type: 'button', class: 'btn btn-sm', onclick: () => IF.upload.open({ fromCurrent: true }) }, 'Edit column mapping'));

  /* ------------------------------------------------------------------
   * Products page
   * ------------------------------------------------------------------ */
  IF.pages.products = {
    table: null, catSel: null,
    render() {
      const caps = IF.state.caps, view = IF.view, P = IF.pages.products;
      const content = document.getElementById('prodContent'), un = document.getElementById('prodUnavailable');
      un.textContent = '';
      if (!caps.product) { content.hidden = true; un.hidden = false; un.append(unavailableBox('Product analysis is unavailable', 'No Product Name column is mapped, so products cannot be ranked. Map a product column to see this page.')); return; }
      content.hidden = false; un.hidden = true;
      const rows = A.products(view.current, caps);
      const ranked = rows.slice().sort(A.byRevenueDesc);

      const fill = (id, list, empty) => {
        const ul = document.getElementById(id); ul.textContent = '';
        if (!list.length) { ul.append(h('li', { class: 'muted', text: empty })); return; }
        list.forEach((p, i) => ul.append(h('li', null, h('span', { class: 'rank', text: String(i + 1) }), h('span', { class: 'grow ellipsis', text: p.name, title: p.name }), h('strong', { text: F.cur(p.revenue) }))));
      };
      fill('prodTop', ranked.slice(0, 5), 'No products in view.');
      const lowTitle = document.getElementById('prodLowNote');
      if (ranked.length >= 10) {
        fill('prodLow', ranked.slice(-5).reverse(), '');
        lowTitle.textContent = 'Ranked by revenue only, bottom 5 of ' + ranked.length + ' products. This does not account for price, margin or stock, so it is not a verdict on performance.';
      } else {
        fill('prodLow', [], 'Needs at least 10 products in view to rank the lowest.');
        lowTitle.textContent = ranked.length ? 'Only ' + ranked.length + ' product(s) in view, which is too few to call any of them lowest-revenue.' : '';
      }

      if (!P.table) {
        P.catSel = h('select', { id: 'prodCat', class: 'input input-sm', 'aria-label': 'Filter products by category' });
        P.catSel.addEventListener('change', () => P.table.setFilter(P.catSel.value ? (r) => (r.category || 'Unknown') === P.catSel.value : null));
        const exp = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => IF.exportTable(P.table, 'insightflow-products.csv') }, IF.icon('download', 16), ' Export to CSV');
        P.table = new IF.Table(document.getElementById('productsTable'), {
          id: 'products', label: 'Product analytics', searchPlaceholder: 'Search products or categories', defaultSort: { key: 'revenue', dir: 'desc' },
          toolbarStart: [h('div', { class: 'field field-inline' }, P.catSel)], toolbarEnd: [exp], emptyMessage: 'No products match the current filters.',
          columns: [
            { key: 'name', label: 'Product' },
            { key: 'category', label: 'Category', format: (v) => (caps.category ? v || 'Unknown' : 'Not available') },
            { key: 'units', label: 'Units sold', num: true, format: (v) => (v === null ? 'Not available' : F.num(v)), exportValue: (r) => r.units },
            { key: 'revenue', label: 'Total revenue', num: true, format: (v) => F.cur(v), exportValue: (r) => Math.round(r.revenue * 100) / 100 },
            { key: 'avgPrice', label: 'Avg selling price', num: true, format: (v) => (v === null ? 'Not available' : F.cur(v, 2)), exportValue: (r) => (r.avgPrice === null ? null : Math.round(r.avgPrice * 100) / 100) },
            { key: 'orders', label: 'Orders', num: true, format: (v) => (v === null ? 'Not available' : F.num(v)), exportValue: (r) => r.orders },
            { key: 'share', label: 'Revenue share', num: true, format: (v) => F.pct(v), exportValue: (r) => (r.share === null ? null : Math.round(r.share * 100) / 100) }
          ]
        });
      }
      const cur = P.catSel.value;
      P.catSel.textContent = '';
      P.catSel.append(h('option', { value: '', text: 'All categories' }));
      if (caps.category) Array.from(new Set(rows.map((r) => r.category || 'Unknown'))).sort().forEach((c) => P.catSel.append(h('option', { value: c, text: c })));
      P.catSel.disabled = !caps.category;
      P.catSel.value = Array.from(P.catSel.options).some((o) => o.value === cur) ? cur : '';
      P.table.setFilter(P.catSel.value ? (r) => (r.category || 'Unknown') === P.catSel.value : null);
      P.table.setRows(rows);
      if (IF.pageSearch.products) { P.table.setSearch(IF.pageSearch.products); IF.pageSearch.products = ''; }
    }
  };

  /* ------------------------------------------------------------------
   * Customers page
   * ------------------------------------------------------------------ */
  IF.pages.customers = {
    table: null,
    render() {
      const caps = IF.state.caps, view = IF.view, P = IF.pages.customers;
      const content = document.getElementById('custContent'), un = document.getElementById('custUnavailable');
      un.textContent = '';
      if (!caps.customers) { content.hidden = true; un.hidden = false; un.append(unavailableBox('Customer analysis is unavailable', 'No Customer ID or Customer Name column is mapped, so customers cannot be identified. Nothing has been guessed. Map a customer column to see this page.')); return; }
      content.hidden = false; un.hidden = true;
      const rows = A.customers(view.current, caps);
      const m = A.metrics(view.current.filter((r) => r.cust), caps);
      const kp = document.getElementById('custKpis'); kp.textContent = '';
      const items = [
        ['Unique customers', rows.length ? F.num(rows.length) : '0'],
        ['Avg revenue per customer', rows.length ? F.cur(m.revenue / rows.length) : '—'],
        ['Avg orders per customer', caps.orders && rows.length ? F.num(m.orders / rows.length, 1) : (caps.orders ? '—' : 'Not available')]
      ];
      const nr = A.newReturning(view);
      items.push(['Returning customers', nr.available && (nr.newCount + nr.returningCount) ? F.pct((nr.returningCount / (nr.newCount + nr.returningCount)) * 100) : 'Not determinable']);
      items.forEach((it) => kp.append(h('div', { class: 'mini-kpi' }, h('span', { class: 'small muted', text: it[0] }), h('strong', { text: it[1] }))));
      const missing = view.current.length - view.current.filter((r) => r.cust).length;
      document.getElementById('custNote').textContent = (missing ? missing + ' row(s) have no customer value and are left out of this page. ' : '') + 'Customers are identified by ' + (IF.state.mapping.customerId >= 0 ? 'Customer ID' : 'name') + '. “Returning” means the customer’s first order in the imported data is before the selected range.';

      const p = IF.charts.palette();
      IF.charts.make('chNewReturning', IF.charts.build.newReturning(view, p));
      IF.charts.make('chTopCustomers', IF.charts.build.topCustomers(view, p));

      if (!P.table) {
        const exp = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => IF.exportTable(P.table, 'insightflow-customers.csv') }, IF.icon('download', 16), ' Export to CSV');
        P.table = new IF.Table(document.getElementById('customersTable'), {
          id: 'customers', label: 'Customer summary', searchPlaceholder: 'Search customers', defaultSort: { key: 'revenue', dir: 'desc' }, toolbarEnd: [exp], emptyMessage: 'No customers in view.',
          columns: [
            { key: 'name', label: 'Customer', get: (r) => r.name || r.id || r.key },
            { key: 'id', label: 'Customer ID', format: (v) => v || '—' },
            { key: 'city', label: 'City', format: (v) => v || '—' },
            { key: 'orders', label: 'Orders', num: true, format: (v) => (v === null ? 'Not available' : F.num(v)), exportValue: (r) => r.orders },
            { key: 'revenue', label: 'Revenue', num: true, format: (v) => F.cur(v), exportValue: (r) => Math.round(r.revenue * 100) / 100 },
            { key: 'aov', label: 'Avg order value', num: true, format: (v) => (v === null ? 'Not available' : F.cur(v)), exportValue: (r) => (r.aov === null ? null : Math.round(r.aov * 100) / 100) },
            { key: 'units', label: 'Units', num: true, format: (v) => (v === null ? 'Not available' : F.num(v)), exportValue: (r) => r.units },
            { key: 'first', label: 'First order', format: (v) => F.date(v), exportValue: (r) => F.iso(r.first) },
            { key: 'last', label: 'Latest order', format: (v) => F.date(v), exportValue: (r) => F.iso(r.last) }
          ]
        });
      }
      P.table.setRows(rows);
      if (IF.pageSearch.customers) { P.table.setSearch(IF.pageSearch.customers); IF.pageSearch.customers = ''; }
    }
  };

  /* ------------------------------------------------------------------
   * Geographic analysis page
   * ------------------------------------------------------------------ */
  IF.pages.geo = {
    table: null, level: 'city',
    render() {
      const caps = IF.state.caps, view = IF.view, P = IF.pages.geo;
      const content = document.getElementById('geoContent'), un = document.getElementById('geoUnavailable');
      un.textContent = '';
      if (!caps.city && !caps.state) { content.hidden = true; un.hidden = false; un.append(unavailableBox('Geographic analysis is unavailable', 'No City or State / Region column is mapped, so sales cannot be placed by location. No locations have been guessed.')); return; }
      content.hidden = false; un.hidden = true;
      if (P.level === 'city' && !caps.city) P.level = 'state';
      if (P.level === 'state' && !caps.state) P.level = 'city';
      document.querySelectorAll('#geoLevel button').forEach((b) => {
        const lvl = b.dataset.level;
        b.disabled = !caps[lvl];
        b.setAttribute('aria-pressed', String(lvl === P.level));
        b.classList.toggle('is-active', lvl === P.level);
      });
      const g = A.geo(view.current, P.level);
      const label = P.level === 'state' ? 'State / Region' : 'City';
      const ranked = g.rows.slice().sort(A.byRevenueDesc).map((r, i) => Object.assign({ rank: i + 1 }, r));
      const top = document.getElementById('geoTop'); top.textContent = '';
      if (!ranked.length) top.append(h('li', { class: 'muted', text: view.current.length ? 'No rows in view have a ' + label.toLowerCase() + ' value.' : 'No sales match the current filters.' }));
      ranked.slice(0, 5).forEach((r) => top.append(h('li', null, h('span', { class: 'rank', text: String(r.rank) }), h('span', { class: 'grow ellipsis', text: r.name }), h('strong', { text: F.cur(r.revenue) }))));
      document.getElementById('geoNote').textContent = (g.missing.rows ? g.missing.rows + ' row(s) (' + F.cur(g.missing.revenue) + ') have no ' + label.toLowerCase() + ' and are left out of the ranking. ' : '') + 'A map is not included: place names alone are not reliable coordinates and none are invented.';
      IF.charts.make('chGeo', IF.charts.build.geo(view, P.level, IF.charts.palette()));
      document.getElementById('geoTableTitle').textContent = 'Ranking by ' + label.toLowerCase();

      const cols = [
        { key: 'rank', label: 'Rank', num: true },
        { key: 'name', label: label },
        { key: 'revenue', label: 'Revenue', num: true, format: (v) => F.cur(v), exportValue: (r) => Math.round(r.revenue * 100) / 100 },
        { key: 'orders', label: 'Orders', num: true, format: (v) => (caps.orders ? F.num(v) : 'Not available'), exportValue: (r) => (caps.orders ? r.orders : null) },
        { key: 'units', label: 'Units', num: true, format: (v) => (caps.units ? F.num(v) : 'Not available'), exportValue: (r) => (caps.units ? r.units : null) },
        { key: 'share', label: 'Revenue share', num: true, format: (v) => F.pct(v), exportValue: (r) => (r.share === null ? null : Math.round(r.share * 100) / 100) }
      ];
      if (!P.table) {
        const exp = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => IF.exportTable(P.table, 'insightflow-locations.csv') }, IF.icon('download', 16), ' Export to CSV');
        P.table = new IF.Table(document.getElementById('geoTable'), { id: 'geo', label: 'Location ranking', searchPlaceholder: 'Search locations', defaultSort: { key: 'rank', dir: 'asc' }, toolbarEnd: [exp], emptyMessage: 'No locations in view.', columns: cols });
      }
      P.table.setColumns(cols);
      P.table.setRows(ranked);
      if (IF.pageSearch.geo) { P.table.setSearch(IF.pageSearch.geo); IF.pageSearch.geo = ''; }
    },
    init() {
      document.querySelectorAll('#geoLevel button').forEach((b) => b.addEventListener('click', () => { IF.pages.geo.level = b.dataset.level; IF.pages.geo.render(); }));
    }
  };

  /* ------------------------------------------------------------------
   * Data Explorer page (shows the imported columns for the rows in view)
   * ------------------------------------------------------------------ */
  IF.pages.explorer = {
    table: null, tableKey: null,
    render() {
      const st = IF.state, view = IF.view, P = IF.pages.explorer;
      const t = st.table;
      const host = document.getElementById('exContent');
      if (!t) { host.hidden = true; return; }
      host.hidden = false;
      const rows = view.current.map((r) => ({ i: r.i, cells: t.rows[r.i] }));
      const types = st.colTypes || (st.colTypes = IF.inferColumnTypes(t.headers, t.rows, st.mapping.date));
      const stats = explorerStats(t.headers, rows);

      const sum = document.getElementById('exSummary'); sum.textContent = '';
      [['Rows in view', F.num(rows.length)], ['Columns', F.num(t.headers.length)], ['Missing cells', F.num(stats.missingTotal)], ['Duplicate rows', F.num(stats.duplicates)], ['Rows imported', F.num(t.rows.length)]]
        .forEach((x) => sum.append(h('div', { class: 'mini-kpi' }, h('span', { class: 'small muted', text: x[0] }), h('strong', { text: x[1] }))));

      const miss = document.getElementById('exMissing'); miss.textContent = '';
      const body = h('tbody');
      t.headers.forEach((hd, c) => body.append(h('tr', null, h('th', { scope: 'row', text: hd }), h('td', { text: types[c] }), h('td', { class: 'num', text: F.num(stats.missing[c]) }), h('td', { class: 'num', text: rows.length ? F.pct((stats.missing[c] / rows.length) * 100) : '—' }))));
      miss.append(h('table', { class: 'data compact' }, h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Column' }), h('th', { scope: 'col', text: 'Detected type' }), h('th', { scope: 'col', class: 'num', text: 'Missing' }), h('th', { scope: 'col', class: 'num', text: 'Missing %' }))), body));

      document.getElementById('exNote').textContent = 'This table shows the rows currently in view (date range and filters applied) with your original columns. ' + (st.quality && st.quality.excludedTotal ? F.num(st.quality.excludedTotal) + ' row(s) were left out during import (see the data-quality summary when you import). ' : '') + 'Search and sorting apply only to the visible columns.';

      const cols = t.headers.map((hd, c) => ({ key: 'c' + c, label: hd, badge: types[c], get: (r) => r.cells[c], num: types[c] === 'Number' }));
      const key = t.headers.join('\u0001') + '|' + (st.source.name || '');
      if (!P.table) {
        const exp = h('button', { type: 'button', class: 'btn btn-sm', onclick: () => IF.exportTable(P.table, 'insightflow-filtered-data.csv') }, IF.icon('download', 16), ' Export to CSV');
        P.table = new IF.Table(document.getElementById('exTable'), { id: 'explorer', label: 'Imported data', searchPlaceholder: 'Search all visible columns', columnMenu: true, toolbarEnd: [exp], emptyMessage: 'No rows match the current filters.', columns: cols });
        P.tableKey = key;
      } else if (P.tableKey !== key) { P.table.setColumns(cols); P.tableKey = key; }
      P.table.setRows(rows);
    },
    init() {
      document.getElementById('exReset').addEventListener('click', () => IF.app.confirmDemoReset());
      document.getElementById('exMapping').addEventListener('click', () => IF.upload.open({ fromCurrent: true }));
      document.getElementById('exUpload').addEventListener('click', () => IF.upload.open());
    }
  };

  /** Missing-value and duplicate-row summary for the rows in view. */
  function explorerStats(headers, rows) {
    const missing = headers.map(() => 0);
    const seen = new Set();
    let dup = 0, missingTotal = 0;
    for (let i = 0; i < rows.length; i++) {
      const cells = rows[i].cells;
      for (let c = 0; c < headers.length; c++) if (IF.isBlank(cells[c])) { missing[c]++; missingTotal++; }
      const k = cells.join('\u0001');
      if (seen.has(k)) dup++; else seen.add(k);
    }
    return { missing, missingTotal, duplicates: dup };
  }
})(typeof window !== 'undefined' ? window : globalThis);
