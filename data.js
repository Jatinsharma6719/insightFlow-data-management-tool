/*!
 * InsightFlow by Jatnex Technologies — data.js
 * Shared namespace, settings, formatting, column detection, parsing,
 * data cleaning/normalisation, demo-data generator and CSV helpers.
 *
 * All scripts are plain (non-module) files that share one global object: IF.
 * This keeps the project runnable by double-clicking index.html.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const DAY = 864e5; // one day in milliseconds
  IF.DAY = DAY;
  IF.VERSION = '1.0.0';

  /** Upload limits. Keep the browser responsive on ordinary laptops/phones. */
  IF.LIMITS = { maxFileBytes: 10 * 1024 * 1024, maxRows: 100000, maxCols: 200, previewRows: 8 };

  /* ------------------------------------------------------------------
   * 1. Standard fields the dashboard understands
   *    exact   = header must equal one of these (after lower-casing and
   *              stripping punctuation)
   *    partial = header may start/end with / contain these
   * ------------------------------------------------------------------ */
  IF.FIELDS = [
    { key: 'orderId', label: 'Order ID', exact: ['orderid', 'ordernumber', 'orderno', 'ordernum', 'invoiceid', 'invoiceno', 'invoicenumber', 'transactionid', 'order'], partial: ['orderid', 'ordernumber', 'invoicenumber', 'transactionid'] },
    { key: 'date', label: 'Order Date', required: true, exact: ['orderdate', 'date', 'purchasedate', 'saledate', 'transactiondate', 'invoicedate', 'orderdatetime', 'createdat', 'datetime'], partial: ['orderdate', 'purchasedate', 'saledate', 'transactiondate', 'invoicedate'] },
    { key: 'product', label: 'Product Name', exact: ['productname', 'product', 'item', 'itemname', 'producttitle'], partial: ['productname', 'itemname', 'producttitle'] },
    { key: 'category', label: 'Category', exact: ['category', 'productcategory', 'producttype', 'department', 'itemcategory'], partial: ['productcategory', 'itemcategory'] },
    { key: 'quantity', label: 'Quantity', exact: ['quantity', 'qty', 'units', 'unitssold', 'quantityordered', 'orderquantity'], partial: ['quantity', 'qtysold', 'unitssold'] },
    { key: 'unitPrice', label: 'Unit Price', exact: ['unitprice', 'price', 'priceperunit', 'sellingprice', 'itemprice', 'rate', 'mrp'], partial: ['unitprice', 'priceperunit', 'sellingprice', 'itemprice'] },
    { key: 'revenue', label: 'Revenue', exact: ['revenue', 'sales', 'totalsales', 'amount', 'totalamount', 'ordertotal', 'total', 'grandtotal', 'salesamount', 'netsales', 'linetotal', 'totalrevenue', 'ordervalue', 'gmv'], partial: ['totalrevenue', 'totalsales', 'salesamount', 'totalamount', 'netsales', 'ordervalue', 'linetotal'] },
    { key: 'customerId', label: 'Customer ID', exact: ['customerid', 'custid', 'customerno', 'customernumber', 'clientid', 'userid', 'buyerid', 'customercode'], partial: ['customerid', 'customernumber', 'clientid', 'buyerid'] },
    { key: 'customerName', label: 'Customer Name', exact: ['customername', 'customer', 'clientname', 'buyername', 'name', 'fullname'], partial: ['customername', 'clientname', 'buyername'] },
    { key: 'city', label: 'City', exact: ['city', 'town', 'shippingcity', 'billingcity', 'customercity'], partial: ['shippingcity', 'billingcity', 'customercity'] },
    { key: 'state', label: 'State / Region', exact: ['state', 'province', 'region', 'statename', 'shippingstate', 'billingstate', 'zone'], partial: ['statename', 'shippingstate', 'billingstate'] },
    { key: 'payment', label: 'Payment Method', exact: ['paymentmethod', 'payment', 'paymenttype', 'paymentmode', 'modeofpayment'], partial: ['paymentmethod', 'paymenttype', 'paymentmode'] },
    { key: 'status', label: 'Order Status', exact: ['orderstatus', 'status', 'fulfillmentstatus', 'deliverystatus'], partial: ['orderstatus', 'deliverystatus', 'fulfillmentstatus'] }
  ];
  IF.fieldLabel = (key) => (IF.FIELDS.find((f) => f.key === key) || { label: key }).label;

  /* ------------------------------------------------------------------
   * 2. Small utilities
   * ------------------------------------------------------------------ */
  IF.normHeader = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');
  IF.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';
  IF.isBlank = isBlank;

  /** Tiny DOM builder. Text children are always inserted as text (never HTML). */
  IF.h = function (tag, props) {
    const el = document.createElement(tag);
    if (props) {
      for (const k of Object.keys(props)) {
        const v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v; // only used with trusted static strings
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      [].concat(arguments[i]).forEach((c) => {
        if (c === null || c === undefined || c === false) return;
        el.append(c.nodeType ? c : document.createTextNode(String(c)));
      });
    }
    return el;
  };

  /* ------------------------------------------------------------------
   * 3. Settings and preferences (LocalStorage — preferences ONLY)
   *    Uploaded business data is never written to LocalStorage.
   * ------------------------------------------------------------------ */
  IF.PAGES = ['overview', 'sales', 'products', 'customers', 'geo', 'entry', 'explorer', 'reports', 'settings'];
  IF.PRESETS = [
    { id: '30d', label: 'Last 30 days', days: 30 },
    { id: '90d', label: 'Last 90 days', days: 90 },
    { id: '180d', label: 'Last 6 months', days: 180 },
    { id: '365d', label: 'Last 12 months', days: 365 },
    { id: 'all', label: 'All time' },
    { id: 'custom', label: 'Custom range' }
  ];
  IF.DATE_FORMATS = ['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];
  IF.CURRENCIES = { INR: 'Indian Rupee (INR)', USD: 'US Dollar (USD)', EUR: 'Euro (EUR)', GBP: 'British Pound (GBP)' };
  IF.defaults = { theme: 'light', currency: 'INR', numberFormat: 'indian', dateFormat: 'DD MMM YYYY', pageSize: 25, preset: '90d', excludeCancelled: true, saveEntries: true, lastPage: 'overview' };
  IF.settings = Object.assign({}, IF.defaults);

  const PREF_KEY = 'insightflow.prefs.v1';
  const validators = {
    theme: (v) => v === 'light' || v === 'dark',
    currency: (v) => Object.prototype.hasOwnProperty.call(IF.CURRENCIES, v),
    numberFormat: (v) => v === 'indian' || v === 'international',
    dateFormat: (v) => IF.DATE_FORMATS.indexOf(v) >= 0,
    pageSize: (v) => [10, 25, 50, 100].indexOf(v) >= 0,
    preset: (v) => IF.PRESETS.some((p) => p.id === v && p.id !== 'custom'),
    excludeCancelled: (v) => typeof v === 'boolean',
    saveEntries: (v) => typeof v === 'boolean',
    lastPage: (v) => IF.PAGES.indexOf(v) >= 0
  };
  IF.prefs = {
    load() {
      try {
        const saved = JSON.parse(root.localStorage.getItem(PREF_KEY) || '{}');
        Object.keys(validators).forEach((k) => { if (k in saved && validators[k](saved[k])) IF.settings[k] = saved[k]; });
      } catch (e) { /* storage unavailable or corrupt: keep defaults */ }
    },
    save() {
      try { root.localStorage.setItem(PREF_KEY, JSON.stringify(IF.settings)); return true; } catch (e) { return false; }
    },
    clear() { try { root.localStorage.removeItem(PREF_KEY); } catch (e) { /* ignore */ } }
  };

  /* ------------------------------------------------------------------
   * 4. Formatting (display only — no currency conversion happens)
   * ------------------------------------------------------------------ */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  IF.fmt = (function () {
    let cache = {};
    const locale = () => (IF.settings.numberFormat === 'indian' ? 'en-IN' : 'en-US');
    const nf = (id, opts) => {
      const k = id + '|' + locale() + '|' + IF.settings.currency;
      if (!cache[k]) cache[k] = new Intl.NumberFormat(locale(), opts);
      return cache[k];
    };
    const ok = (n) => typeof n === 'number' && isFinite(n);
    const pad = (n) => String(n).padStart(2, '0');
    const trim1 = (x) => String(Math.round(x * 10) / 10);
    const api = {
      reset() { cache = {}; },
      num(n, dec) { dec = dec || 0; return ok(n) ? nf('n' + dec, { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n) : '—'; },
      cur(n, dec) { dec = dec || 0; return ok(n) ? nf('c' + dec, { style: 'currency', currency: IF.settings.currency, minimumFractionDigits: dec, maximumFractionDigits: dec }).format(n) : '—'; },
      pct(n, dec) { dec = dec === undefined ? 1 : dec; return ok(n) ? api.num(n, dec) + '%' : '—'; },
      signedPct(n, dec) { dec = dec === undefined ? 1 : dec; return ok(n) ? (n > 0 ? '+' : n < 0 ? '−' : '') + api.num(Math.abs(n), dec) + '%' : 'N/A'; },
      symbol() {
        const p = nf('sym', { style: 'currency', currency: IF.settings.currency, maximumFractionDigits: 0 }).formatToParts(0).find((x) => x.type === 'currency');
        return p ? p.value : IF.settings.currency;
      },
      compactNum(n) {
        if (!ok(n)) return '';
        const a = Math.abs(n), s = n < 0 ? '-' : '';
        if (IF.settings.numberFormat === 'indian') {
          if (a >= 1e7) return s + trim1(a / 1e7) + ' Cr';
          if (a >= 1e5) return s + trim1(a / 1e5) + ' L';
          if (a >= 1e3) return s + trim1(a / 1e3) + 'K';
        } else {
          if (a >= 1e9) return s + trim1(a / 1e9) + 'B';
          if (a >= 1e6) return s + trim1(a / 1e6) + 'M';
          if (a >= 1e3) return s + trim1(a / 1e3) + 'K';
        }
        return s + trim1(a);
      },
      curCompact(n) { return ok(n) ? api.symbol() + api.compactNum(n) : ''; },
      /** t = UTC-midnight milliseconds */
      date(t) {
        if (!ok(t)) return '—';
        const d = new Date(t), y = d.getUTCFullYear(), m = d.getUTCMonth(), day = d.getUTCDate();
        switch (IF.settings.dateFormat) {
          case 'DD/MM/YYYY': return pad(day) + '/' + pad(m + 1) + '/' + y;
          case 'MM/DD/YYYY': return pad(m + 1) + '/' + pad(day) + '/' + y;
          case 'YYYY-MM-DD': return y + '-' + pad(m + 1) + '-' + pad(day);
          default: return pad(day) + ' ' + MONTHS[m] + ' ' + y;
        }
      },
      month(t) { const d = new Date(t); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); },
      iso(t) { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); },
      bytes(n) { return n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB'; }
    };
    return api;
  })();

  /* ------------------------------------------------------------------
   * 5. Parsing helpers
   * ------------------------------------------------------------------ */
  /** Parse numbers such as "₹1,23,456.50", "(120)" or "12". Returns null if not numeric. */
  function parseNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) ? v : null;
    let s = String(v).trim();
    if (!s) return null;
    let neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    s = s.replace(/[\s,₹$€£]|rs\.?|inr|usd|eur|gbp/gi, '');
    if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
    const n = parseFloat(s);
    if (!isFinite(n)) return null;
    return neg ? -n : n;
  }
  IF.parseNumber = parseNumber;

  function ymd(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
    const t = Date.UTC(y, m - 1, d);
    return new Date(t).getUTCMonth() === m - 1 ? t : null; // rejects 31 Feb etc.
  }
  /**
   * Parse a date into UTC-midnight milliseconds. Handles ISO strings,
   * D/M/Y or M/D/Y strings (see fmt), Excel serial numbers and Date objects.
   * Returns null when the value is not a recognisable date.
   */
  function parseDate(v, fmt) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return isNaN(v) ? null : ymd(v.getFullYear(), v.getMonth() + 1, v.getDate());
    if (typeof v === 'number') {
      if (v >= 20000 && v < 80000) { // Excel serial date (about 1954–2119)
        const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(v) * DAY);
        return ymd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
      }
      return null;
    }
    const s = String(v).trim();
    if (!s) return null;
    if (/^\d{5}(\.\d+)?$/.test(s)) return parseDate(parseFloat(s));
    let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/);
    if (m) return ymd(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[T\s].*)?$/);
    if (m) {
      const a = +m[1], b = +m[2];
      let y = +m[3];
      if (y < 100) y += 2000;
      return fmt === 'MDY' ? ymd(y, a, b) : ymd(y, b, a);
    }
    if (/[a-z]/i.test(s) && /\d/.test(s)) { // e.g. "12 Jan 2026" or "Jan 12, 2026"
      const t = Date.parse(s);
      if (!isNaN(t)) { const d = new Date(t); return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
    }
    return null;
  }
  IF.parseDate = parseDate;

  /** Decide whether slash-style dates are day-first or month-first. */
  IF.detectDateFormat = function (values) {
    let dmy = 0, mdy = 0, ambiguous = 0;
    for (let i = 0; i < values.length; i++) {
      const v = values[i];
      if (typeof v !== 'string') continue;
      const m = v.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
      if (!m) continue;
      const a = +m[1], b = +m[2];
      if (a > 12 && b <= 12) dmy++;
      else if (b > 12 && a <= 12) mdy++;
      else if (a <= 12 && b <= 12) ambiguous++;
    }
    if (dmy && !mdy) return { format: 'DMY', certain: true };
    if (mdy && !dmy) return { format: 'MDY', certain: true };
    if (dmy && mdy) return { format: 'DMY', certain: false, conflict: true };
    if (ambiguous) return { format: 'DMY', certain: false };
    return { format: 'DMY', certain: true, none: true };
  };

  /** Guess which column holds which standard field. Each column is used once. */
  IF.detectMapping = function (headers) {
    const cands = [];
    headers.forEach((h, ci) => {
      const n = IF.normHeader(h);
      if (!n) return;
      IF.FIELDS.forEach((f) => {
        let score = 0;
        if (f.exact.indexOf(n) >= 0) score = 3;
        else if (f.partial.some((s) => n.indexOf(s) >= 0)) score = 2;
        if (score) cands.push({ key: f.key, ci, score, len: n.length });
      });
    });
    cands.sort((a, b) => b.score - a.score || a.len - b.len || a.ci - b.ci);
    const mapping = {}, usedCols = new Set();
    IF.FIELDS.forEach((f) => { mapping[f.key] = -1; });
    cands.forEach((c) => {
      if (mapping[c.key] === -1 && !usedCols.has(c.ci)) { mapping[c.key] = c.ci; usedCols.add(c.ci); }
    });
    return mapping;
  };

  /** What can the dashboard calculate with this mapping? */
  IF.computeCaps = function (mapping) {
    const has = (k) => mapping[k] !== undefined && mapping[k] >= 0;
    return {
      orders: has('orderId'), units: has('quantity'), customers: has('customerId') || has('customerName'),
      category: has('category'), product: has('product'), city: has('city'), state: has('state'),
      payment: has('payment'), status: has('status')
    };
  };

  /** Validate a mapping. Returns an array of error messages (empty = OK). */
  IF.validateMapping = function (mapping) {
    const errs = [];
    const has = (k) => mapping[k] !== undefined && mapping[k] >= 0;
    if (!has('date')) errs.push('Order Date is required. Choose the column that holds the order date.');
    if (!has('revenue') && !(has('quantity') && has('unitPrice'))) errs.push('Revenue is required. Choose a Revenue column, or map both Quantity and Unit Price so revenue can be calculated.');
    const byCol = {};
    IF.FIELDS.forEach((f) => { if (has(f.key)) (byCol[mapping[f.key]] = byCol[mapping[f.key]] || []).push(f.label); });
    Object.keys(byCol).forEach((c) => { if (byCol[c].length > 1) errs.push('One column is mapped to several fields (' + byCol[c].join(', ') + '). Map each column to one field only.'); });
    return errs;
  };

  /* ------------------------------------------------------------------
   * 6. Normalise raw rows into clean records + data-quality report
   * ------------------------------------------------------------------ */
  /**
   * @param {{headers:string[], rows:any[][], firstDataRow?:number}} table
   * @param {Object<string,number>} mapping  field key -> column index (or -1)
   * @param {{dateFormat?:'DMY'|'MDY', removeDuplicates?:boolean}} opts
   */
  IF.normalize = function (table, mapping, opts) {
    opts = Object.assign({ dateFormat: 'DMY', removeDuplicates: true }, opts);
    const rows = table.rows;
    const first = table.firstDataRow || 2;
    const ci = {};
    IF.FIELDS.forEach((f) => { ci[f.key] = mapping[f.key] === undefined ? -1 : mapping[f.key]; });
    const q = {
      totalRows: rows.length, blankRows: 0, usedRows: 0, excluded: {}, excludedTotal: 0,
      derivedRevenue: 0, zeroRevenue: 0, missing: {}, duplicateRows: 0, duplicatesRemoved: 0,
      multiLineOrders: 0, dateMin: null, dateMax: null, dateFormat: opts.dateFormat,
      assumptions: [], warnings: []
    };
    IF.FIELDS.forEach((f) => { if (ci[f.key] >= 0) q.missing[f.key] = 0; });
    const exclude = (reason, rowNo) => {
      const e = q.excluded[reason] || (q.excluded[reason] = { count: 0, rows: [] });
      e.count++;
      if (e.rows.length < 5) e.rows.push(rowNo);
      q.excludedTotal++;
    };
    const cell = (row, k) => (ci[k] >= 0 ? row[ci[k]] : undefined);
    const text = (row, k) => { const v = cell(row, k); return v === undefined || v === null ? '' : String(v).trim(); };
    const seen = new Set();
    const orderRowCount = new Map();
    const records = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let blank = true;
      for (let j = 0; j < row.length; j++) { if (!isBlank(row[j])) { blank = false; break; } }
      if (blank) { q.blankRows++; continue; }
      const rowNo = first + i;

      const key = row.map((v) => (v === null || v === undefined ? '' : String(v).trim())).join('\u0001');
      if (seen.has(key)) {
        q.duplicateRows++;
        if (opts.removeDuplicates) { q.duplicatesRemoved++; exclude('Exact duplicate of an earlier row (removed)', rowNo); continue; }
      } else seen.add(key);

      const rawDate = cell(row, 'date');
      const t = parseDate(rawDate, opts.dateFormat);
      if (t === null) { exclude(isBlank(rawDate) ? 'Missing order date' : 'Date could not be read', rowNo); continue; }

      let qty = null;
      if (ci.quantity >= 0) {
        qty = parseNumber(cell(row, 'quantity'));
        if (qty !== null && qty <= 0) { exclude('Quantity is zero or negative', rowNo); continue; }
      }
      const price = ci.unitPrice >= 0 ? parseNumber(cell(row, 'unitPrice')) : null;
      let revenue = ci.revenue >= 0 ? parseNumber(cell(row, 'revenue')) : null;
      let derived = false;
      if (revenue === null && isBlank(cell(row, 'revenue')) && qty !== null && price !== null) { revenue = Math.round(qty * price * 100) / 100; derived = true; }
      if (revenue === null) { exclude('Revenue is missing or not a number', rowNo); continue; }
      if (revenue < 0) { exclude('Revenue is negative', rowNo); continue; }

      const rec = {
        i, t, qty, price, revenue, derived,
        id: text(row, 'orderId') || null,
        product: text(row, 'product') || null,
        category: text(row, 'category') || null,
        customerId: text(row, 'customerId') || null,
        customerName: text(row, 'customerName') || null,
        city: text(row, 'city') || null,
        state: text(row, 'state') || null,
        payment: text(row, 'payment') || null,
        status: text(row, 'status') || null
      };
      rec.cust = rec.customerId || rec.customerName || null;
      if (derived) q.derivedRevenue++;
      if (revenue === 0) q.zeroRevenue++;
      ['orderId:id', 'product:product', 'category:category', 'customerId:customerId', 'customerName:customerName', 'city:city', 'state:state', 'payment:payment', 'status:status'].forEach((p) => {
        const kv = p.split(':');
        if (ci[kv[0]] >= 0 && rec[kv[1]] === null) q.missing[kv[0]]++;
      });
      if (ci.quantity >= 0 && qty === null) q.missing.quantity++;
      if (ci.unitPrice >= 0 && price === null) q.missing.unitPrice++;
      if (ci.revenue >= 0 && isBlank(cell(row, 'revenue'))) q.missing.revenue++;
      if (rec.id) orderRowCount.set(rec.id, (orderRowCount.get(rec.id) || 0) + 1);
      records.push(rec);
    }
    q.usedRows = records.length;
    orderRowCount.forEach((c) => { if (c > 1) q.multiLineOrders++; });
    records.sort((a, b) => a.t - b.t || a.i - b.i);
    if (records.length) { q.dateMin = records[0].t; q.dateMax = records[records.length - 1].t; }

    // Visible assumptions
    if (!records.length) q.warnings.push('No rows could be used. Check the column mapping and the date format.');
    if (opts.dateFormat === 'MDY') q.assumptions.push('Dates written like 03/04/2026 were read as month/day/year.');
    else q.assumptions.push('Dates written like 03/04/2026 were read as day/month/year.');
    if (q.derivedRevenue) q.assumptions.push('Revenue was calculated as Quantity × Unit Price for ' + q.derivedRevenue + ' row(s) where the Revenue cell was empty.');
    if (ci.orderId < 0) q.assumptions.push('No Order ID column is mapped, so Total Orders and Average Order Value cannot be calculated.');
    else q.assumptions.push('Total Orders counts unique Order IDs. One order can span several rows (one per product).');
    if (ci.quantity < 0) q.assumptions.push('No Quantity column is mapped, so Units Sold and average selling price cannot be calculated.');
    if (ci.customerId < 0 && ci.customerName >= 0) q.assumptions.push('No Customer ID column is mapped. Customers are identified by name, so two different people with the same name would be counted as one.');
    if (ci.customerId < 0 && ci.customerName < 0) q.assumptions.push('No customer column is mapped, so customer analysis is unavailable.');
    q.assumptions.push('Rows with a negative revenue are excluded rather than treated as refunds.');
    if (q.multiLineOrders) q.warnings.push(q.multiLineOrders + ' order ID(s) appear on more than one row. They are treated as multi-product orders, not duplicates.');
    if (q.zeroRevenue) q.warnings.push(q.zeroRevenue + ' row(s) have zero revenue. They are kept in the data.');
    return { records, quality: q };
  };

  /** Infer a display type for each raw column (sampled for speed). */
  IF.inferColumnTypes = function (headers, rows, dateColIndex) {
    const limit = Math.min(rows.length, 2000);
    return headers.map((h, c) => {
      if (c === dateColIndex) return 'Date';
      let n = 0, num = 0, date = 0;
      for (let i = 0; i < limit; i++) {
        const v = rows[i][c];
        if (isBlank(v)) continue;
        n++;
        if (parseNumber(v) !== null) num++;
        else if (typeof v === 'string' && /^\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(v.trim()) && parseDate(v, 'DMY') !== null) date++;
      }
      if (!n) return 'Empty';
      if (num === n) return 'Number';
      if (date === n) return 'Date';
      if (num + date > n * 0.5) return 'Mixed';
      return 'Text';
    });
  };

  /* ------------------------------------------------------------------
   * 7. CSV output (with spreadsheet-formula-injection guard)
   * ------------------------------------------------------------------ */
  IF.csvCell = function (v) {
    if (v === null || v === undefined) return '';
    let s = String(v);
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  IF.toCSV = function (headers, rows) {
    return [headers.map(IF.csvCell).join(',')].concat(rows.map((r) => r.map(IF.csvCell).join(','))).join('\r\n') + '\r\n';
  };
  IF.download = function (filename, text, mime) {
    const blob = new Blob(['\ufeff' + text], { type: (mime || 'text/csv') + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ------------------------------------------------------------------
   * 8. Demo data — fictional, generated from a fixed random seed so the
   *    same file is produced every time. data/sample-sales.csv is made by
   *    this very function (see scripts/generate-sample-data.js).
   * ------------------------------------------------------------------ */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  IF.DEMO_HEADERS = ['Order ID', 'Order Date', 'Product Name', 'Category', 'Quantity', 'Unit Price', 'Revenue', 'Customer ID', 'Customer Name', 'City', 'State', 'Payment Method', 'Order Status'];
  let demoCache = null;
  IF.generateDemo = function () {
    if (demoCache) return demoCache;
    const rnd = mulberry32(20260930);
    const products = [
      ['Wireless Earbuds Pro', 'Electronics', 3499, 9], ['Bluetooth Speaker Mini', 'Electronics', 1899, 8], ['Smart Fitness Band', 'Electronics', 2799, 7],
      ['20000mAh Power Bank', 'Electronics', 1799, 8], ['USB-C Fast Charger', 'Electronics', 999, 10], ['Mechanical Keyboard', 'Electronics', 4299, 3],
      ['Air Fryer 4L', 'Home & Kitchen', 6499, 5], ['Stainless Steel Bottle', 'Home & Kitchen', 799, 12], ['Non-stick Cookware Set', 'Home & Kitchen', 3299, 4], ['LED Desk Lamp', 'Home & Kitchen', 1299, 6],
      ['Running Shoes', 'Fashion', 3999, 6], ['Cotton Casual Shirt', 'Fashion', 1199, 9], ['Denim Jacket', 'Fashion', 2999, 3], ['Leather Wallet', 'Fashion', 899, 7], ['Laptop Backpack 25L', 'Fashion', 1599, 6],
      ['Yoga Mat 6mm', 'Fitness', 899, 8], ['Adjustable Dumbbell Pair', 'Fitness', 3499, 3], ['Resistance Band Set', 'Fitness', 599, 9], ['Skipping Rope Pro', 'Fitness', 349, 6],
      ['Hardcover Notebook A5', 'Stationery & Office', 249, 14], ['Gel Pen Pack (10)', 'Stationery & Office', 199, 16], ['Ergonomic Mouse', 'Stationery & Office', 1099, 6],
      ['Vitamin C Face Serum', 'Beauty & Care', 699, 8], ['Herbal Shampoo 500ml', 'Beauty & Care', 449, 9], ['Sunscreen SPF 50', 'Beauty & Care', 549, 8]
    ];
    const places = [
      ['Delhi', 'Delhi', 14], ['Mumbai', 'Maharashtra', 14], ['Bengaluru', 'Karnataka', 13], ['Hyderabad', 'Telangana', 9], ['Chennai', 'Tamil Nadu', 8],
      ['Kolkata', 'West Bengal', 7], ['Pune', 'Maharashtra', 8], ['Ahmedabad', 'Gujarat', 6], ['Jaipur', 'Rajasthan', 5], ['Faridabad', 'Haryana', 4]
    ];
    const payments = [['UPI', 42], ['Credit Card', 22], ['Debit Card', 14], ['Cash on Delivery', 12], ['Net Banking', 6], ['Wallet', 4]];
    const firsts = ['Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Rohan', 'Arjun', 'Neha', 'Priya', 'Ananya', 'Diya', 'Kavya', 'Meera', 'Riya', 'Sneha', 'Tanvi', 'Karan', 'Manish', 'Nikhil', 'Pooja', 'Rahul', 'Sanjay', 'Simran', 'Varun', 'Yash', 'Zoya', 'Aisha', 'Dev', 'Isha', 'Lakshya'];
    const lasts = ['Sharma', 'Verma', 'Gupta', 'Mehta', 'Iyer', 'Nair', 'Reddy', 'Khan', 'Singh', 'Das', 'Patel', 'Joshi', 'Bose', 'Kapoor'];
    const wpick = (items, wi) => { let tot = 0; items.forEach((x) => { tot += x[wi]; }); let r = rnd() * tot; for (let i = 0; i < items.length; i++) { r -= items[i][wi]; if (r <= 0) return items[i]; } return items[items.length - 1]; };

    const customers = [];
    for (let i = 0; i < 360; i++) {
      const place = wpick(places, 2);
      customers.push({
        id: 'CUST-' + String(i + 1).padStart(4, '0'),
        name: firsts[i % firsts.length] + ' ' + lasts[Math.floor(i / firsts.length) % lasts.length],
        place, activity: 0.3 + Math.pow(rnd(), 2) * 3,
        join: i < 110 ? Math.floor(rnd() * 30) : Math.floor(rnd() * 360), orders: 0
      });
    }
    const start = Date.UTC(2025, 9, 1); // 1 Oct 2025
    const days = 365;
    const rows = [];
    let orderNo = 100000;
    for (let d = 0; d < days; d++) {
      const dt = new Date(start + d * DAY);
      const m = dt.getUTCMonth() + 1, dom = dt.getUTCDate(), dow = dt.getUTCDay();
      let season = 1;
      if ((m === 10 && dom >= 10) || (m === 11 && dom <= 8)) season = 1.55; // festive season
      else if (m === 12) season = 1.15; else if (m === 1) season = 0.95; else if (m === 2) season = 0.9;
      else if (m === 5) season = 1.05; else if (m === 6) season = 1.1; else if (m === 8) season = 1.12; else if (m === 9) season = 1.08;
      const lambda = (5 + 3.5 * (d / (days - 1))) * season * (dow === 0 || dow === 6 ? 1.2 : 1) * (0.8 + rnd() * 0.4);
      const nOrders = Math.round(lambda);
      const eligible = customers.filter((c) => c.join <= d);
      const age = days - 1 - d;
      for (let o = 0; o < nOrders; o++) {
        // pick a customer, favouring active ones and customers who just joined
        let tot = 0;
        const ws = eligible.map((c) => { const w = c.activity * (c.orders === 0 ? (d - c.join <= 7 ? 8 : 1.5) : 1); tot += w; return w; });
        let r = rnd() * tot, ci = 0;
        for (; ci < ws.length - 1; ci++) { r -= ws[ci]; if (r <= 0) break; }
        const cust = eligible[ci];
        cust.orders++;
        const place = rnd() < 0.93 ? cust.place : wpick(places, 2);
        const pay = wpick(payments, 1)[0];
        const sr = rnd();
        let status;
        if (age <= 10) status = sr < 0.35 ? 'Processing' : sr < 0.75 ? 'Shipped' : sr < 0.93 ? 'Delivered' : 'Cancelled';
        else status = sr < 0.88 ? 'Delivered' : sr < 0.93 ? 'Returned' : 'Cancelled';
        const lr = rnd();
        const nLines = lr < 0.65 ? 1 : lr < 0.9 ? 2 : 3;
        const chosen = [];
        const id = 'ORD-' + (++orderNo);
        for (let l = 0; l < nLines; l++) {
          let p = wpick(products, 3), guard = 0;
          while (chosen.indexOf(p[0]) >= 0 && guard++ < 10) p = wpick(products, 3);
          chosen.push(p[0]);
          const price = Math.max(49, Math.round((p[2] * (0.94 + rnd() * 0.08)) / 10) * 10 - 1);
          const qr = rnd();
          const qty = p[2] < 500 ? (qr < 0.45 ? 1 : qr < 0.75 ? 2 : qr < 0.9 ? 3 : 5) : (qr < 0.85 ? 1 : qr < 0.97 ? 2 : 3);
          rows.push([id, IF.fmt.iso(start + d * DAY), p[0], p[1], qty, price, qty * price, cust.id, cust.name, place[0], place[1], pay, status]);
        }
      }
    }
    demoCache = { headers: IF.DEMO_HEADERS.slice(), rows, firstDataRow: 2 };
    return demoCache;
  };
  IF.demoCSV = () => { const t = IF.generateDemo(); return IF.toCSV(t.headers, t.rows); };

  /* ------------------------------------------------------------------
   * 9. Shared application state
   * ------------------------------------------------------------------ */
  IF.state = {
    table: null, mapping: {}, records: [], quality: null, caps: {}, bounds: null,
    source: { type: 'none', name: '', sheet: '' }, dateFormat: 'DMY', removeDuplicates: true,
    notifications: [], unread: 0
  };
  IF.pages = IF.pages || {};
})(typeof window !== 'undefined' ? window : globalThis);
