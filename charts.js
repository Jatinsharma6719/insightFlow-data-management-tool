/*!
 * InsightFlow — charts.js
 * Chart.js configuration builders (one per chart) plus the Sales Analytics page.
 * Every builder reads the filtered view (IF.view), so charts update whenever the
 * dataset, date range or any filter changes.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const A = IF.A, F = IF.fmt;
  const C = (IF.charts = { instances: {} });
  IF.pages = IF.pages || {};

  C.COLORS = ['#0e8fb0', '#3b5bdb', '#f59f00', '#12b886', '#e8590c', '#9c36b5', '#e64980', '#868e96'];
  C.LIGHT = { text: '#1b2540', muted: '#4f5b78', grid: '#e3e8f1', surface: '#ffffff', colors: C.COLORS, isStatic: true };

  /** Colours taken from the active theme (CSS variables). */
  C.palette = function () {
    const cs = getComputedStyle(document.documentElement);
    const g = (n) => cs.getPropertyValue(n).trim();
    return { text: g('--text') || '#1b2540', muted: g('--text-muted') || '#4f5b78', grid: g('--chart-grid') || '#e3e8f1', surface: g('--surface') || '#fff', colors: C.COLORS, isStatic: false };
  };

  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const money = (v) => F.cur(v);
  const trunc = (s, n) => (String(s).length > n ? String(s).slice(0, n - 1) + '…' : String(s));

  function baseOptions(p, extra) {
    return Object.assign({
      responsive: !p.isStatic, maintainAspectRatio: false,
      animation: p.isStatic || reducedMotion() ? false : { duration: 350 },
      plugins: {
        legend: { labels: { color: p.muted, usePointStyle: true, boxWidth: 8 } },
        tooltip: { backgroundColor: '#0f1b3d', titleColor: '#ffffff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8 }
      }
    }, extra);
  }
  const axis = (p, o) => Object.assign({ grid: { color: p.grid }, border: { color: p.grid }, ticks: { color: p.muted } }, o);
  const axisTitle = (p, text) => ({ display: true, text, color: p.muted });
  const NO_RESULTS = 'No sales match the current filters and date range.';
  const unavailable = (what, field) => what + ' is unavailable because no ' + field + ' column is mapped. Use “Edit column mapping” in Data Explorer to add one.';

  /** Draw (or clear) a chart inside its .chart-box. Never throws. */
  C.destroy = function (id) { if (C.instances[id]) { try { C.instances[id].destroy(); } catch (e) { /* ignore */ } delete C.instances[id]; } };
  C.destroyAll = function () { Object.keys(C.instances).forEach(C.destroy); };
  C.make = function (id, built, canvasEl) {
    const canvas = canvasEl || document.getElementById(id);
    if (!canvas) return null;
    C.destroy(id);
    const box = canvas.closest('.chart-box');
    const empty = box && box.querySelector('.chart-empty');
    if (!built || built.empty) {
      canvas.hidden = true;
      if (empty) { empty.textContent = (built && built.empty) || NO_RESULTS; empty.hidden = false; }
      return null;
    }
    canvas.hidden = false;
    if (empty) empty.hidden = true;
    if (typeof root.Chart === 'undefined') {
      canvas.hidden = true;
      if (empty) { empty.textContent = 'Charts could not load. Check your internet connection (Chart.js is loaded from a CDN) and refresh.'; empty.hidden = false; }
      return null;
    }
    try {
      if (built.label) canvas.setAttribute('aria-label', built.label);
      const inst = new root.Chart(canvas, built.config);
      if (!canvasEl) C.instances[id] = inst; else return inst;
      return inst;
    } catch (e) {
      console.error('Chart error (' + id + '):', e && e.message);
      canvas.hidden = true;
      if (empty) { empty.textContent = 'This chart could not be drawn.'; empty.hidden = false; }
      return null;
    }
  };

  /* ---------------- chart builders ---------------- */
  C.build = {};

  C.build.revenueTime = function (view, gran, p) {
    if (!view.current.length) return { empty: NO_RESULTS };
    const g = gran === 'auto' ? A.autoGran(view.range) : gran;
    const s = A.series(view.current, view.range, g);
    const dense = s.length > 60;
    return {
      label: 'Line chart of revenue by ' + g + ' from ' + F.date(view.range.start) + ' to ' + F.date(view.range.end) + '. Highest value ' + F.cur(Math.max.apply(null, s.map((x) => x.revenue))) + '.',
      config: {
        type: 'line',
        data: { labels: s.map((x) => A.bucketLabel(x.t, g)), datasets: [{ label: 'Revenue', data: s.map((x) => x.revenue), borderColor: p.colors[0], backgroundColor: 'rgba(14,143,176,0.12)', fill: true, tension: 0.3, borderWidth: 2, pointRadius: dense ? 0 : 3, pointHoverRadius: 5 }] },
        options: baseOptions(p, {
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { label: (c) => 'Revenue: ' + money(c.parsed.y) } } },
          scales: { x: axis(p, { ticks: { color: p.muted, maxTicksLimit: 9, autoSkip: true, maxRotation: 0 }, title: axisTitle(p, g === 'day' ? 'Day' : g === 'week' ? 'Week starting' : 'Month') }), y: axis(p, { beginAtZero: true, ticks: { color: p.muted, callback: (v) => F.curCompact(v) }, title: axisTitle(p, 'Revenue (' + IF.settings.currency + ')') }) }
        })
      }
    };
  };

  function doughnut(rows, p, what, valueLabel) {
    const max = 8;
    let slices = rows.slice();
    if (slices.length > max) {
      const rest = slices.slice(max - 1);
      slices = slices.slice(0, max - 1).concat([{ name: 'Other (' + rest.length + ')', revenue: rest.reduce((s, x) => s + x.revenue, 0) }]);
    }
    const total = slices.reduce((s, x) => s + x.revenue, 0);
    if (!total) return { empty: 'There is no revenue to show for the current filters.' };
    const gen = (root.Chart && ((root.Chart.overrides && root.Chart.overrides.doughnut && root.Chart.overrides.doughnut.plugins.legend.labels.generateLabels) || root.Chart.defaults.plugins.legend.labels.generateLabels));
    return {
      label: 'Doughnut chart of ' + what + '. Largest share: ' + slices[0].name + ' at ' + F.num((slices[0].revenue / total) * 100, 1) + '%.',
      config: {
        type: 'doughnut',
        data: { labels: slices.map((x) => x.name), datasets: [{ data: slices.map((x) => x.revenue), backgroundColor: slices.map((x, i) => (x.name === 'Unknown' || x.name === 'Not specified' ? '#98a2b8' : p.colors[i % p.colors.length])), borderColor: p.surface, borderWidth: 2 }] },
        options: baseOptions(p, {
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { color: p.muted, usePointStyle: true, boxWidth: 8, generateLabels: gen ? function (chart) {
              const items = gen(chart), data = chart.data.datasets[0].data, tot = data.reduce((a, b) => a + b, 0);
              items.forEach((it, i) => { it.text = chart.data.labels[i] + ' (' + F.num(tot ? (data[i] / tot) * 100 : 0, 1) + '%)'; });
              return items;
            } : undefined } },
            tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { label: (c) => c.label + ': ' + (valueLabel === 'count' ? F.num(c.parsed) : money(c.parsed)) + ' (' + F.num((c.parsed / total) * 100, 1) + '%)' } }
          }
        })
      }
    };
  }

  C.build.category = function (view, p) {
    if (!IF.state.caps.category) return { empty: unavailable('Sales by category', 'Category') };
    if (!view.current.length) return { empty: NO_RESULTS };
    return doughnut(A.groupBy(view.current, (r) => r.category).sort(A.byRevenueDesc), p, 'revenue by category');
  };
  C.build.payment = function (view, p) {
    if (!IF.state.caps.payment) return { empty: unavailable('Payment method distribution', 'Payment Method') };
    if (!view.current.length) return { empty: NO_RESULTS };
    return doughnut(A.groupBy(view.current, (r) => r.payment, 'Not specified').sort(A.byRevenueDesc), p, 'revenue by payment method');
  };

  function hbar(rows, p, o) { // horizontal bar helper
    return {
      label: o.label,
      config: {
        type: 'bar',
        data: { labels: rows.map((r) => trunc(r.name, 30)), datasets: [{ label: o.title, data: rows.map(o.value), backgroundColor: p.colors[o.color || 0], borderRadius: 4, maxBarThickness: 22 }] },
        options: baseOptions(p, {
          indexAxis: 'y',
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { title: (c) => rows[c[0].dataIndex].name, label: (c) => o.title + ': ' + o.format(c.parsed.x) } } },
          scales: { x: axis(p, { beginAtZero: true, ticks: { color: p.muted, callback: o.tick }, title: axisTitle(p, o.axisTitle) }), y: axis(p, { grid: { display: false }, ticks: { color: p.text } }) }
        })
      }
    };
  }

  C.build.topProducts = function (view, sortBy, p) {
    if (!IF.state.caps.product) return { empty: unavailable('Top products', 'Product Name') };
    if (!view.current.length) return { empty: NO_RESULTS };
    const byUnits = sortBy === 'units' && IF.state.caps.units;
    const rows = A.products(view.current, IF.state.caps).sort((a, b) => (byUnits ? b.units - a.units : b.revenue - a.revenue) || a.name.localeCompare(b.name)).slice(0, 10);
    return hbar(rows, p, byUnits
      ? { title: 'Units sold', value: (r) => r.units, format: (v) => F.num(v), tick: (v) => F.compactNum(v), axisTitle: 'Units sold', color: 1, label: 'Horizontal bar chart of the top 10 products by units sold. Top product: ' + rows[0].name + '.' }
      : { title: 'Revenue', value: (r) => r.revenue, format: money, tick: (v) => F.curCompact(v), axisTitle: 'Revenue (' + IF.settings.currency + ')', color: 0, label: 'Horizontal bar chart of the top 10 products by revenue. Top product: ' + rows[0].name + '.' });
  };

  C.build.geo = function (view, level, p) {
    const caps = IF.state.caps;
    if (!(level === 'state' ? caps.state : caps.city)) return { empty: unavailable('Geographic performance', level === 'state' ? 'State / Region' : 'City') };
    const g = A.geo(view.current, level);
    if (!g.rows.length) return { empty: view.current.length ? 'None of the rows in view have a ' + level + ' value.' : NO_RESULTS };
    const rows = g.rows.slice().sort(A.byRevenueDesc).slice(0, 10);
    return hbar(rows, p, { title: 'Revenue', value: (r) => r.revenue, format: money, tick: (v) => F.curCompact(v), axisTitle: 'Revenue (' + IF.settings.currency + ')', color: 3, label: 'Horizontal bar chart of revenue by ' + level + '. Top: ' + rows[0].name + '.' });
  };

  C.build.topCustomers = function (view, p) {
    if (!IF.state.caps.customers) return { empty: 'Customer analysis is unavailable because no customer column is mapped.' };
    const rows = A.customers(view.current, IF.state.caps).sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((c) => ({ name: c.name || c.id || c.key, revenue: c.revenue }));
    if (!rows.length) return { empty: view.current.length ? 'The rows in view have no customer values.' : NO_RESULTS };
    return hbar(rows, p, { title: 'Revenue', value: (r) => r.revenue, format: money, tick: (v) => F.curCompact(v), axisTitle: 'Revenue (' + IF.settings.currency + ')', color: 5, label: 'Horizontal bar chart of the top 10 customers by revenue.' });
  };

  C.build.newReturning = function (view, p) {
    if (!IF.state.caps.customers) return { empty: 'Customer analysis is unavailable because no customer column is mapped.' };
    const nr = A.newReturning(view);
    if (!nr.available) return { empty: nr.reason };
    if (!nr.newCount && !nr.returningCount) return { empty: view.current.length ? 'The rows in view have no customer values.' : NO_RESULTS };
    return {
      label: 'Doughnut chart: ' + nr.newCount + ' new customers and ' + nr.returningCount + ' returning customers.',
      config: {
        type: 'doughnut',
        data: { labels: ['New customers', 'Returning customers'], datasets: [{ data: [nr.newCount, nr.returningCount], backgroundColor: [p.colors[3], p.colors[1]], borderColor: p.surface, borderWidth: 2 }] },
        options: baseOptions(p, { cutout: '62%', plugins: { legend: { position: 'bottom', labels: { color: p.muted, usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { label: (c) => c.label + ': ' + F.num(c.parsed) + ' customers' } } } })
      }
    };
  };

  C.build.ordersRevenue = function (view, gran, p) {
    if (!IF.state.caps.orders) return { empty: unavailable('Orders vs revenue', 'Order ID') };
    if (!view.current.length) return { empty: NO_RESULTS };
    const g = gran === 'auto' ? A.autoGran(view.range) : gran;
    const s = A.series(view.current, view.range, g);
    const labels = s.map((x) => A.bucketLabel(x.t, g));
    return {
      label: 'Combination chart: revenue as bars and number of orders as a line, by ' + g + '.',
      config: {
        type: 'bar',
        data: { labels, datasets: [
          { type: 'bar', label: 'Revenue', data: s.map((x) => x.revenue), backgroundColor: 'rgba(14,143,176,0.75)', yAxisID: 'y', order: 2, borderRadius: 3 },
          { type: 'line', label: 'Orders', data: s.map((x) => x.orders), borderColor: p.colors[2], backgroundColor: p.colors[2], yAxisID: 'y1', order: 1, tension: 0.3, borderWidth: 2, pointRadius: s.length > 60 ? 0 : 3 }
        ] },
        options: baseOptions(p, {
          interaction: { mode: 'index', intersect: false },
          plugins: { legend: { labels: { color: p.muted, usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { label: (c) => c.dataset.label + ': ' + (c.dataset.yAxisID === 'y' ? money(c.parsed.y) : F.num(c.parsed.y)) } } },
          scales: {
            x: axis(p, { ticks: { color: p.muted, maxTicksLimit: 9, autoSkip: true, maxRotation: 0 } }),
            y: axis(p, { position: 'left', beginAtZero: true, ticks: { color: p.muted, callback: (v) => F.curCompact(v) }, title: axisTitle(p, 'Revenue (' + IF.settings.currency + ')') }),
            y1: axis(p, { position: 'right', beginAtZero: true, grid: { drawOnChartArea: false, color: p.grid }, ticks: { color: p.muted, precision: 0 }, title: axisTitle(p, 'Orders (unique order IDs)') })
          }
        })
      }
    };
  };

  C.build.monthly = function (view, p) {
    if (!view.current.length) return { empty: NO_RESULTS };
    const m = A.monthlyComparison(view);
    const hasPrev = m.some((x) => x.previous > 0);
    const datasets = [{ label: 'Selected period', data: m.map((x) => x.current), backgroundColor: p.colors[0], borderRadius: 4 }];
    if (hasPrev) datasets.push({ label: 'Previous period (shifted back ' + view.rangeDays + ' days)', data: m.map((x) => x.previous), backgroundColor: '#98a2b8', borderRadius: 4 });
    return {
      label: 'Grouped bar chart of monthly revenue for the selected period' + (hasPrev ? ' against the previous period' : '') + '.',
      config: {
        type: 'bar',
        data: { labels: m.map((x) => x.label + (x.partial ? ' (part)' : '')), datasets },
        options: baseOptions(p, {
          plugins: { legend: { labels: { color: p.muted, usePointStyle: true, boxWidth: 8 } }, tooltip: { backgroundColor: '#0f1b3d', titleColor: '#fff', bodyColor: '#e6ebf5', padding: 10, cornerRadius: 8, callbacks: { label: (c) => c.dataset.label + ': ' + money(c.parsed.y) } } },
          scales: { x: axis(p, { grid: { display: false }, ticks: { color: p.muted } }), y: axis(p, { beginAtZero: true, ticks: { color: p.muted, callback: (v) => F.curCompact(v) }, title: axisTitle(p, 'Revenue (' + IF.settings.currency + ')') }) }
        })
      },
      hasPrev
    };
  };

  /** Tiny trend line used inside KPI cards. */
  C.build.sparkline = function (values, color) {
    return {
      label: 'Trend line',
      config: {
        type: 'line',
        data: { labels: values.map((v, i) => i), datasets: [{ data: values, borderColor: color, borderWidth: 2, tension: 0.35, pointRadius: 0, fill: false }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, events: [], plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }
      }
    };
  };

  /** Render a chart to a PNG data URL off-screen (used by the report). */
  C.toImage = function (built, width, height) {
    if (!built || built.empty || typeof root.Chart === 'undefined') return null;
    const holder = document.createElement('div');
    holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + width + 'px;height:' + height + 'px;';
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    holder.appendChild(canvas);
    document.body.appendChild(holder);
    let url = null;
    try {
      const cfg = built.config;
      cfg.options.responsive = false;
      cfg.options.animation = false;
      const inst = new root.Chart(canvas, cfg);
      url = inst.toBase64Image('image/png', 1);
      inst.destroy();
    } catch (e) { console.error('Report chart error:', e && e.message); }
    holder.remove();
    return url;
  };

  /* ---------------- Sales Analytics page ---------------- */
  IF.pages.sales = {
    render() {
      const view = IF.view, p = C.palette();
      const gran = document.getElementById('salesGran').value;
      C.make('chOrdersRevenue', C.build.ordersRevenue(view, gran, p));
      const mc = C.build.monthly(view, p);
      C.make('chMonthly', mc);
      const note = document.getElementById('monthlyNote');
      note.textContent = mc.empty ? '' : 'Each month in the selected period is compared with the same dates shifted back by ' + view.rangeDays + ' days. Months at the edges of the range may be partial.' + (mc.hasPrev ? '' : ' No earlier data exists, so there is nothing to compare with.');
      C.make('chPayment', C.build.payment(view, p));

      // Monthly summary table
      const holder = document.getElementById('monthlyTable');
      const caps = IF.state.caps;
      const rows = view.current.length ? A.series(view.current, view.range, 'month').map((s, i, arr) => Object.assign({}, s, { label: F.month(s.t) + (s.partial ? ' (part)' : ''), mom: i > 0 ? A.pctChange(s.revenue, arr[i - 1].revenue) : null })) : [];
      IF.pages.sales.rows = rows;
      if (!IF.pages.sales.table) {
        IF.pages.sales.table = new IF.Table(holder, {
          id: 'monthly', search: false, pageSizes: [12, 24, 60], pageSize: 12, defaultSort: { key: 't', dir: 'asc' }, emptyMessage: NO_RESULTS,
          columns: [
            { key: 'label', label: 'Month', sortKey: 't' },
            { key: 'revenue', label: 'Revenue', num: true, format: (v) => F.cur(v) },
            { key: 'orders', label: 'Orders', num: true, format: (v, r) => (IF.state.caps.orders ? F.num(v) : 'Not available') },
            { key: 'units', label: 'Units', num: true, format: (v) => (IF.state.caps.units ? F.num(v) : 'Not available') },
            { key: 'aov', label: 'Avg order value', num: true, format: (v) => (IF.state.caps.orders ? F.cur(v) : 'Not available') },
            { key: 'mom', label: 'Change vs previous month', num: true, format: (v) => F.signedPct(v) }
          ]
        });
      }
      IF.pages.sales.table.setRows(rows);
    },
    init() {
      document.getElementById('salesGran').addEventListener('change', () => IF.pages.sales.render());
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
