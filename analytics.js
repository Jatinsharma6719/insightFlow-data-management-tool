/*!
 * InsightFlow — analytics.js
 * Pure calculation functions. Nothing here touches the page, so every number
 * on the dashboard is computed from the currently filtered records.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const A = (IF.A = {});
  const DAY = 864e5;

  /** Growth % = (current - previous) / previous x 100. Returns null when it cannot be calculated. */
  A.pctChange = (cur, prev) => (cur === null || cur === undefined || prev === null || prev === undefined || prev === 0 ? null : ((cur - prev) / prev) * 100);

  /** KPI values for a list of records. A value is null when the dataset cannot support it. */
  A.metrics = function (records, caps) {
    let revenue = 0, units = 0;
    const orders = new Set(), custs = new Set();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      revenue += r.revenue;
      if (r.qty !== null) units += r.qty;
      if (r.id) orders.add(r.id);
      if (r.cust) custs.add(r.cust);
    }
    const o = caps.orders ? orders.size : null;
    return {
      revenue, rows: records.length,
      orders: o,
      units: caps.units ? units : null,
      aov: o ? revenue / o : null, // zero orders -> null (no division by zero)
      customers: caps.customers ? custs.size : null
    };
  };

  /* ---------- time buckets ---------- */
  A.bucketStart = function (t, gran) {
    if (gran === 'day') return t;
    const d = new Date(t);
    if (gran === 'week') return t - ((d.getUTCDay() + 6) % 7) * DAY; // weeks start on Monday
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  };
  A.nextBucket = function (t, gran) {
    if (gran === 'day') return t + DAY;
    if (gran === 'week') return t + 7 * DAY;
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  };
  A.autoGran = function (range) {
    const days = (range.end - range.start) / DAY + 1;
    return days <= 62 ? 'day' : days <= 270 ? 'week' : 'month';
  };
  A.bucketLabel = function (t, gran) {
    if (gran === 'month') return IF.fmt.month(t);
    if (gran === 'week') return 'Week of ' + IF.fmt.date(t);
    return IF.fmt.date(t);
  };

  /** Continuous series (empty buckets are filled with zeros) between range.start and range.end. */
  A.series = function (records, range, gran) {
    const map = new Map();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const k = A.bucketStart(r.t, gran);
      let b = map.get(k);
      if (!b) { b = { t: k, revenue: 0, units: 0, orders: new Set(), custs: new Set() }; map.set(k, b); }
      b.revenue += r.revenue;
      if (r.qty !== null) b.units += r.qty;
      if (r.id) b.orders.add(r.id);
      if (r.cust) b.custs.add(r.cust);
    }
    const out = [];
    for (let t = A.bucketStart(range.start, gran); t <= range.end; t = A.nextBucket(t, gran)) {
      const b = map.get(t) || { t, revenue: 0, units: 0, orders: new Set(), custs: new Set() };
      out.push({ t, revenue: b.revenue, units: b.units, orders: b.orders.size, customers: b.custs.size,
        aov: b.orders.size ? b.revenue / b.orders.size : 0,
        partial: t < range.start || A.nextBucket(t, gran) - DAY > range.end });
    }
    return out;
  };

  /** Generic grouping. Missing values are grouped under unknownLabel. */
  A.groupBy = function (records, keyFn, unknownLabel) {
    const m = new Map();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      let k = keyFn(r);
      if (k === null || k === undefined || k === '') k = unknownLabel || 'Unknown';
      let g = m.get(k);
      if (!g) { g = { name: k, revenue: 0, units: 0, rows: 0, orders: new Set(), custs: new Set() }; m.set(k, g); }
      g.revenue += r.revenue;
      if (r.qty !== null) g.units += r.qty;
      g.rows++;
      if (r.id) g.orders.add(r.id);
      if (r.cust) g.custs.add(r.cust);
    }
    return Array.from(m.values()).map((g) => ({ name: g.name, revenue: g.revenue, units: g.units, rows: g.rows, orders: g.orders.size, customers: g.custs.size }));
  };

  A.byRevenueDesc = (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name);

  /** Product table rows. */
  A.products = function (records, caps) {
    let total = 0;
    const m = new Map();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      total += r.revenue;
      const name = r.product || 'Unknown';
      let p = m.get(name);
      if (!p) { p = { name, category: null, revenue: 0, units: 0, orders: new Set() }; m.set(name, p); }
      if (!p.category && r.category) p.category = r.category;
      p.revenue += r.revenue;
      if (r.qty !== null) p.units += r.qty;
      if (r.id) p.orders.add(r.id);
    }
    return Array.from(m.values()).map((p) => {
      const units = caps.units ? p.units : null;
      return {
        name: p.name, category: p.category || (caps.category ? 'Unknown' : null),
        units, revenue: p.revenue,
        avgPrice: units ? p.revenue / units : null,
        orders: caps.orders ? p.orders.size : null,
        share: total > 0 ? (p.revenue / total) * 100 : null
      };
    });
  };

  /** Customer table rows (identified customers only). */
  A.customers = function (records, caps) {
    const m = new Map();
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.cust) continue;
      let c = m.get(r.cust);
      if (!c) { c = { key: r.cust, id: r.customerId, name: r.customerName, city: null, revenue: 0, units: 0, orders: new Set(), first: r.t, last: r.t }; m.set(r.cust, c); }
      c.revenue += r.revenue;
      if (r.qty !== null) c.units += r.qty;
      if (r.id) c.orders.add(r.id);
      if (r.city) c.city = r.city;
      if (r.t < c.first) c.first = r.t;
      if (r.t > c.last) c.last = r.t;
    }
    return Array.from(m.values()).map((c) => {
      const o = caps.orders ? c.orders.size : null;
      return { key: c.key, id: c.id, name: c.name, city: c.city, orders: o, revenue: c.revenue, units: caps.units ? c.units : null, aov: o ? c.revenue / o : null, first: c.first, last: c.last };
    });
  };

  /** Revenue/orders by city or state. Rows without a location are reported, not invented. */
  A.geo = function (records, level) {
    const key = level === 'state' ? (r) => r.state : (r) => r.city;
    const located = [], missing = { rows: 0, revenue: 0 };
    let total = 0;
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (key(r)) { located.push(r); total += r.revenue; } else { missing.rows++; missing.revenue += r.revenue; }
    }
    const rows = A.groupBy(located, key).map((g) => Object.assign(g, { share: total > 0 ? (g.revenue / total) * 100 : null }));
    return { rows, missing, total };
  };

  /**
   * New vs returning customers inside the selected range.
   * "New" = the customer's first order anywhere in the imported data falls inside the range.
   * Not determinable when the range starts at the first date in the data.
   */
  A.newReturning = function (view) {
    if (!view.bounds || view.range.start <= view.bounds.min) {
      return { available: false, reason: 'The selected range starts at the first date in the data, so earlier purchases cannot be checked. Choose a later start date to compare new and returning customers.' };
    }
    const first = new Map();
    for (let i = 0; i < view.all.length; i++) {
      const r = view.all[i];
      if (!r.cust) continue;
      const f = first.get(r.cust);
      if (f === undefined || r.t < f) first.set(r.cust, r.t);
    }
    const seen = new Map(); // cust -> {isNew, revenue}
    for (let i = 0; i < view.current.length; i++) {
      const r = view.current[i];
      if (!r.cust) continue;
      let s = seen.get(r.cust);
      if (!s) { s = { isNew: first.get(r.cust) >= view.range.start, revenue: 0 }; seen.set(r.cust, s); }
      s.revenue += r.revenue;
    }
    const out = { available: true, newCount: 0, returningCount: 0, newRevenue: 0, returningRevenue: 0 };
    seen.forEach((s) => {
      if (s.isNew) { out.newCount++; out.newRevenue += s.revenue; } else { out.returningCount++; out.returningRevenue += s.revenue; }
    });
    return out;
  };

  /**
   * Monthly revenue for the selected range versus the same-length stretch
   * immediately before it (each month is shifted back by the range length).
   */
  A.monthlyComparison = function (view) {
    const { range, nonDate } = view;
    const len = (range.end - range.start) / DAY + 1;
    const sumRange = (a, b) => {
      let s = 0;
      for (let i = 0; i < nonDate.length; i++) { const t = nonDate[i].t; if (t >= a && t <= b) s += nonDate[i].revenue; }
      return s;
    };
    const out = [];
    for (let ms = A.bucketStart(range.start, 'month'); ms <= range.end; ms = A.nextBucket(ms, 'month')) {
      const me = A.nextBucket(ms, 'month') - DAY;
      const a = Math.max(range.start, ms), b = Math.min(range.end, me);
      out.push({ t: ms, label: IF.fmt.month(ms), current: sumRange(a, b), previous: sumRange(a - len * DAY, b - len * DAY), partial: a > ms || b < me });
    }
    return out;
  };

  /** Plain-language observations. These describe patterns; they never claim a cause. */
  A.insights = function (view, caps) {
    const out = [], F = IF.fmt, cur = view.current;
    if (!cur.length) return out;
    const m = A.metrics(cur, caps), p = A.metrics(view.previous, caps);
    const g = A.pctChange(m.revenue, p.revenue);
    if (g !== null) out.push('Revenue was ' + F.cur(m.revenue) + ', ' + (g >= 0 ? 'up ' : 'down ') + F.num(Math.abs(g), 1) + '% compared with the previous period (' + F.cur(p.revenue) + ').');
    else out.push('Revenue was ' + F.cur(m.revenue) + '. There are no sales in the previous equivalent period, so no comparison is shown.');
    if (caps.category) {
      const c = A.groupBy(cur, (r) => r.category).sort(A.byRevenueDesc);
      if (c.length > 1 && m.revenue > 0) out.push(c[0].name + ' was the largest category with ' + F.num((c[0].revenue / m.revenue) * 100, 1) + '% of revenue.');
    }
    if (caps.product) {
      const pr = A.products(cur, caps).sort(A.byRevenueDesc);
      if (pr.length > 1) out.push(pr[0].name + ' was the top product by revenue (' + F.cur(pr[0].revenue) + ').');
      if (pr.length >= 6 && m.revenue > 0) {
        const top3 = pr.slice(0, 3).reduce((s, x) => s + x.revenue, 0);
        out.push('The top 3 products made up ' + F.num((top3 / m.revenue) * 100, 1) + '% of revenue.');
      }
    }
    const months = A.series(cur, view.range, 'month').filter((x) => !x.partial);
    if (months.length >= 2) {
      const best = months.slice().sort((a, b) => b.revenue - a.revenue)[0];
      out.push('The highest full month was ' + F.month(best.t) + ' with ' + F.cur(best.revenue) + '.');
    }
    if (m.aov !== null && p.aov !== null) {
      const ag = A.pctChange(m.aov, p.aov);
      if (ag !== null) out.push('Average order value was ' + F.cur(m.aov) + ', ' + (ag >= 0 ? 'up ' : 'down ') + F.num(Math.abs(ag), 1) + '% from ' + F.cur(p.aov) + '.');
    }
    if (caps.city || caps.state) {
      const level = caps.city ? 'city' : 'state';
      const geo = A.geo(cur, level);
      if (geo.rows.length > 1) {
        const top = geo.rows.slice().sort(A.byRevenueDesc)[0];
        out.push(top.name + ' was the top ' + level + ' by revenue (' + F.num(top.share, 1) + '% of revenue with a known location).');
      }
    }
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
