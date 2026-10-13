/*!
 * InsightFlow — entry.js
 * Data Entry page: type orders directly into the dashboard instead of uploading a file.
 * Typed orders form a dataset called "My Entries" that feeds every dashboard page.
 * Saving a copy in this browser (LocalStorage) is optional and is NOT encrypted.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const F = IF.fmt, h = IF.h;
  const $ = (id) => document.getElementById(id);
  const E = (IF.entry = { rows: [], editing: null });
  IF.pages = IF.pages || {};
  const KEY = 'insightflow.entries.v1';
  const WIDTH = 13; // Order ID, Date, Product, Category, Qty, Unit Price, Revenue, Cust ID, Cust Name, City, State, Payment, Status
  const PAYMENTS = ['UPI', 'Cash', 'Credit Card', 'Debit Card', 'Net Banking', 'Wallet', 'Cash on Delivery'];
  const STATUSES = ['Delivered', 'Shipped', 'Processing', 'Cancelled', 'Returned'];
  let know = { prod: new Map(), cust: new Map(), custByName: new Map() };
  let ordersTable = null, builtForm = false, saving = false;

  /* ---------------- storage ---------------- */
  /** Load saved entries from this browser. Returns true when there is at least one. */
  E.loadSaved = function () {
    if (!IF.settings.saveEntries) return false;
    try {
      const s = JSON.parse(root.localStorage.getItem(KEY) || 'null');
      if (Array.isArray(s)) {
        E.rows = s.filter((r) => Array.isArray(r) && r.length === WIDTH && IF.parseDate(r[1]) !== null);
        return E.rows.length > 0;
      }
    } catch (e) { /* storage blocked or corrupt */ }
    return false;
  };
  E.persist = function () {
    try {
      if (!IF.settings.saveEntries || !E.rows.length) root.localStorage.removeItem(KEY);
      else root.localStorage.setItem(KEY, JSON.stringify(E.rows));
      return true;
    } catch (e) { return false; }
  };
  const persistOrWarn = () => { if (IF.settings.saveEntries && !E.persist()) IF.ui.toast('error', 'Your entries could not be saved in this browser (storage full or blocked). They are safe for now, but download a backup so you do not lose them.'); };

  /** Rebuild the dashboard from the typed orders. */
  E.commit = async function (opts) {
    const table = { headers: IF.DEMO_HEADERS.slice(), rows: E.rows, firstDataRow: 2 };
    const mapping = IF.detectMapping(table.headers);
    const res = IF.normalize(table, mapping, { dateFormat: 'DMY', removeDuplicates: false });
    await IF.app.loadDataset({ table, mapping, records: res.records, quality: res.quality, dateFormat: 'DMY', removeDuplicates: false, source: { type: 'manual', name: 'My Entries', sheet: '' }, quiet: !!(opts && opts.quiet) });
  };

  E.clearAll = function (silent) {
    E.rows = []; E.editing = null;
    E.persist();
    if (!silent) E.commit({ quiet: true });
  };

  E.orders = function () {
    const m = new Map();
    E.rows.forEach((r) => {
      let o = m.get(r[0]);
      if (!o) { o = { id: r[0], date: r[1], customer: r[8] || r[7] || '', status: r[12] || '', items: 0, total: 0 }; m.set(r[0], o); }
      o.items++; o.total += Number(r[6]) || 0;
    });
    return Array.from(m.values());
  };

  E.nextId = function () {
    const ids = new Set(E.rows.map((r) => r[0]));
    const last = E.rows.length ? E.rows[E.rows.length - 1][0] : 'ORD-1000';
    const m = String(last).match(/^(.*?)(\d+)$/);
    let prefix = m ? m[1] : 'ORD-', n = m ? parseInt(m[2], 10) : 1000;
    const width = m ? m[2].length : 4;
    do { n++; } while (ids.has(prefix + String(n).padStart(width, '0')));
    return prefix + String(n).padStart(width, '0');
  };

  const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

  /* ---------------- form ---------------- */
  function field(id, label, input, hint) { return h('div', { class: 'field' }, h('label', { for: id, text: label }), input, hint ? h('p', { class: 'small muted', text: hint }) : null); }
  const txt = (id, list, ph) => h('input', { id, class: 'input', type: 'text', autocomplete: 'off', list: list || null, placeholder: ph || null });

  function addLine(v) {
    v = v || {};
    const box = $('eLines');
    const n = box.children.length + 1;
    const mk = (cls, label, input) => h('div', { class: 'field ' + cls }, h('label', { class: 'visually-hidden', text: label + ' (item ' + n + ')' }), input);
    const product = h('input', { class: 'input', type: 'text', list: 'dlProducts', autocomplete: 'off', placeholder: 'Product name', value: v.product || '', 'data-k': 'product' });
    const category = h('input', { class: 'input', type: 'text', list: 'dlCategories', autocomplete: 'off', placeholder: 'Category', value: v.category || '', 'data-k': 'category' });
    const qty = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: 'Qty', value: v.qty === undefined ? '1' : v.qty, 'data-k': 'qty' });
    const price = h('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '0', step: 'any', placeholder: '0.00', value: v.price === undefined ? '' : v.price, 'data-k': 'price' });
    const total = h('output', { class: 'line-total', text: '—' });
    const rm = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Remove item ' + n, onclick: () => { if ($('eLines').children.length > 1) { row.remove(); renumber(); updateTotals(); } else IF.ui.toast('info', 'An order needs at least one product line.'); } }, IF.icon('trash', 16));
    const row = h('div', { class: 'line-row' }, mk('f-product', 'Product', product), mk('f-category', 'Category', category), mk('f-qty', 'Quantity', qty), mk('f-price', 'Unit price', price), h('div', { class: 'field f-total' }, total), rm);
    row._total = total;
    const upd = () => updateTotals();
    qty.addEventListener('input', upd); price.addEventListener('input', upd);
    product.addEventListener('change', () => { // fill category and last used price for known products
      const k = know.prod.get(product.value.trim());
      if (k) { if (!category.value && k.category) category.value = k.category; if (!price.value && k.price !== null && k.price !== undefined) price.value = String(Math.round(k.price * 100) / 100); updateTotals(); }
    });
    box.append(row);
    updateTotals();
    return row;
  }
  function renumber() { Array.from($('eLines').children).forEach((row, i) => { row.querySelectorAll('label.visually-hidden').forEach((l) => { l.textContent = l.textContent.replace(/\(item \d+\)/, '(item ' + (i + 1) + ')'); }); }); }

  function readLines() {
    return Array.from($('eLines').children).map((row) => {
      const g = (k) => row.querySelector('[data-k="' + k + '"]').value.trim();
      return { product: g('product'), category: g('category'), qtyRaw: g('qty'), priceRaw: g('price'), el: row };
    });
  }
  function updateTotals() {
    let sum = 0;
    readLines().forEach((l) => {
      const q = IF.parseNumber(l.qtyRaw), p = IF.parseNumber(l.priceRaw);
      const t = q !== null && p !== null ? q * p : null;
      l.el._total.textContent = t === null ? '—' : F.cur(t, 2);
      if (t !== null) sum += t;
    });
    const tot = $('eTotal'); if (tot) tot.textContent = F.cur(sum, 2);
  }

  function buildForm() {
    const root_ = $('entryRoot');
    root_.textContent = '';
    const dl = (id, items) => h('datalist', { id }, items.map((x) => h('option', { value: x })));
    root_.append(dl('dlProducts', []), dl('dlCategories', []), dl('dlCustNames', []), dl('dlCities', []), dl('dlStates', []), dl('dlPay', PAYMENTS), dl('dlStatus', STATUSES));

    // where is the dashboard reading from?
    root_.append(h('div', { class: 'state state-info', id: 'eSource', role: 'status' }));

    const edit = h('div', { class: 'state state-info edit-banner', id: 'eEdit', hidden: true }, h('strong', { id: 'eEditText' }), h('button', { type: 'button', class: 'btn btn-sm', onclick: cancelEdit }, 'Cancel editing'));

    const orderCard = h('section', { class: 'card', 'aria-labelledby': 'eFormTitle' },
      h('h2', { class: 'card-title', id: 'eFormTitle', text: 'New order' }), edit,
      h('div', { class: 'form-grid' },
        field('eId', 'Order ID', txt('eId', null, 'Auto'), 'Leave as is for an automatic number.'),
        field('eDate', 'Order date', h('input', { id: 'eDate', class: 'input', type: 'date', value: todayISO() })),
        field('eCustName', 'Customer name', txt('eCustName', 'dlCustNames'), 'Optional. Leave blank if unknown.'),
        field('eCustId', 'Customer ID (automatic)', h('input', { id: 'eCustId', class: 'input', type: 'text', readonly: true, placeholder: 'Created from the name' })),
        field('eCity', 'City', txt('eCity', 'dlCities')),
        field('eState', 'State / Region', txt('eState', 'dlStates')),
        field('ePay', 'Payment method', txt('ePay', 'dlPay')),
        field('eStatus', 'Order status', txt('eStatus', 'dlStatus'))),
      h('div', { id: 'eCustChoice', class: 'cust-choice', hidden: true }),
      h('h3', { text: 'Products in this order' }),
      h('div', { class: 'line-head', 'aria-hidden': 'true' }, h('span', { text: 'Product' }), h('span', { text: 'Category' }), h('span', { text: 'Quantity' }), h('span', { text: 'Unit price' }), h('span', { text: 'Line total' }), h('span')),
      h('div', { class: 'lines', id: 'eLines' }),
      h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn btn-sm', onclick: () => { const r = addLine(); r.querySelector('input').focus(); } }, '+ Add another product')),
      h('div', { class: 'entry-total' }, h('span', null, 'Order total: ', h('strong', { id: 'eTotal', text: F.cur(0, 2) })),
        h('div', { class: 'btn-row' }, h('button', { type: 'button', class: 'btn', onclick: () => resetForm(true) }, 'Clear form'), h('button', { type: 'button', class: 'btn btn-primary', id: 'eSave', onclick: save }, 'Save order'))),
      h('div', { class: 'state state-error', id: 'eErrors', role: 'alert', tabindex: '-1', hidden: true }));
    root_.append(orderCard);

    const stor = h('section', { class: 'card', 'aria-labelledby': 'eStoreTitle' },
      h('h2', { class: 'card-title', id: 'eStoreTitle', text: 'Saving and backup' }),
      h('label', { class: 'check', for: 'eSaveLocal' }, h('input', { type: 'checkbox', id: 'eSaveLocal', checked: IF.settings.saveEntries, onchange: (e) => { IF.app.setSetting('saveEntries', e.target.checked); if (e.target.checked) persistOrWarn(); else { E.persist(); IF.ui.toast('info', 'Saved copy removed. Your entries now live only until you reload this page. Download a backup.'); } } }),
        h('span', null, h('strong', { text: 'Save my entries in this browser' }), h('br'), h('span', { class: 'small muted', text: 'Your orders stay here after you close the page. They live only in this browser on this device, are not encrypted, and are lost if the browser data is cleared. If this is off, entries disappear when you reload.' }))),
      h('div', { class: 'btn-row' },
        h('button', { type: 'button', class: 'btn', id: 'eBackup', onclick: downloadBackup }, IF.icon('download', 16), ' Download all entries (CSV)'),
        h('button', { type: 'button', class: 'btn btn-danger', id: 'eClearAll', onclick: clearAll }, IF.icon('trash', 16), ' Delete all entries')),
      h('p', { class: 'small muted', text: 'The CSV opens in Excel, and you can upload it again later with “Upload data”. Download a backup regularly.' }));
    const list = h('section', { class: 'card', 'aria-labelledby': 'eListTitle' }, h('h2', { class: 'card-title', id: 'eListTitle', text: 'My orders' }), h('div', { id: 'eOrders' }));
    root_.append(list, stor);

    // customer ID is created automatically from the name (and city)
    ['eCustName', 'eCity', 'eState'].forEach((id) => { $(id).addEventListener('input', () => updateCustomer()); $(id).addEventListener('change', () => updateCustomer()); });
    resetForm(false);
    builtForm = true;
  }


  /* ---------------- automatic customer ID ---------------- */
  /** Customers already in My Entries, built from the typed orders. */
  function registry() {
    const m = new Map();
    E.rows.forEach((r) => {
      if (!r[7] || !r[8]) return;
      let c = m.get(r[7]);
      if (!c) { c = { id: r[7], name: r[8], city: r[9] || '', state: r[10] || '', orders: new Set(), last: r[1] }; m.set(r[7], c); }
      c.orders.add(r[0]);
      if (r[1] >= c.last) { c.last = r[1]; if (r[9]) c.city = r[9]; if (r[10]) c.state = r[10]; }
    });
    return Array.from(m.values());
  }
  /** Next unused ID such as CUST-0007. */
  E.nextCustId = function () {
    let max = 0, prefix = 'CUST-', width = 4;
    E.rows.forEach((r) => { const m = String(r[7] || '').match(/^(.*?)(\d+)$/); if (m) { prefix = m[1]; width = Math.max(width, m[2].length); max = Math.max(max, parseInt(m[2], 10)); } });
    return prefix + String(max + 1).padStart(width, '0');
  };
  const norm = (x) => String(x || '').trim().toLowerCase();

  /**
   * Work out the customer ID. Same name + same city could be one person or two,
   * so when that happens the user is asked, instead of guessing.
   */
  function updateCustomer(preferId) {
    const name = $('eCustName').value.trim(), city = $('eCity').value.trim();
    const box = $('eCustChoice'), idEl = $('eCustId');
    box.textContent = '';
    if (!name) { idEl.value = ''; box.hidden = true; return; }
    const sameName = registry().filter((c) => norm(c.name) === norm(name));
    // same name in a different city is treated as a different person; no city typed = could be anyone
    const candidates = sameName.filter((c) => !city || !c.city || norm(c.city) === norm(city));
    const newId = E.nextCustId();
    if (!candidates.length) {
      idEl.value = newId;
      box.hidden = false;
      box.append(h('p', { class: 'small muted' }, IF.icon('info', 14), sameName.length ? ' New customer. A customer named “' + name + '” exists in another city, so this is treated as a different person.' : ' New customer. A new ID was created.'));
      return;
    }
    const prev = box.dataset.choice;
    candidates.sort((a, b) => b.orders.size - a.orders.size);
    const options = candidates.map((c) => ({ id: c.id, label: 'Same customer as ' + c.id + ' · ' + (c.city || 'no city') + ' · ' + c.orders.size + ' order' + (c.orders.size === 1 ? '' : 's') + ', last on ' + F.date(IF.parseDate(c.last)) }));
    options.push({ id: newId, label: 'A different person with the same name. Create a new customer (' + newId + ')', isNew: true });
    let chosen = preferId && options.some((o) => o.id === preferId) ? preferId : (prev && options.some((o) => o.id === prev) ? prev : options[0].id);
    const fs = h('fieldset', { class: 'choice-set' }, h('legend', { text: 'A customer named “' + name + '” already exists. Which one is this?' }));
    options.forEach((o, i) => {
      const rid = 'cc' + i;
      const r = h('input', { type: 'radio', name: 'custChoice', id: rid, value: o.id, checked: o.id === chosen });
      r.addEventListener('change', () => { box.dataset.choice = o.id; idEl.value = o.id; });
      fs.append(h('label', { class: 'check', for: rid }, r, h('span', { text: o.label })));
    });
    if (!city) fs.append(h('p', { class: 'small muted', text: 'Tip: add the city so people with the same name can be told apart.' }));
    box.append(fs);
    box.hidden = false;
    box.dataset.choice = chosen;
    idEl.value = chosen;
    // fill empty city/state from the chosen existing customer
    const c = candidates.find((x) => x.id === chosen);
    if (c) { if (!$('eCity').value && c.city) $('eCity').value = c.city; if (!$('eState').value && c.state) $('eState').value = c.state; }
  }

  function resetForm(keepDate) {
    const date = $('eDate') ? $('eDate').value : todayISO();
    ['eCustId', 'eCustName', 'eCity', 'eState'].forEach((id) => { $(id).value = ''; });
    $('eId').value = E.nextId();
    $('eDate').value = keepDate && date ? date : todayISO();
    if (!$('ePay').value) $('ePay').value = 'UPI';
    if (!$('eStatus').value) $('eStatus').value = 'Delivered';
    $('eLines').textContent = '';
    addLine();
    $('eErrors').hidden = true;
    E.editing = null;
    updateCustomer();
    $('eEdit').hidden = true;
    $('eFormTitle').textContent = 'New order';
    $('eSave').textContent = 'Save order';
  }

  function cancelEdit() { resetForm(true); }

  function showErrors(list) {
    const box = $('eErrors');
    box.textContent = '';
    list.forEach((m) => box.append(h('p', null, IF.icon('alert', 16), ' ' + m)));
    box.hidden = false;
    box.focus();
  }

  async function save() {
    if (saving) return;
    const errs = [];
    const id = $('eId').value.trim() || E.nextId();
    const date = $('eDate').value;
    if (IF.parseDate(date) === null) errs.push('Choose a valid order date.');
    updateCustomer(($('eCustChoice').dataset.choice) || undefined); // make sure the ID matches the name and city typed
    if (E.rows.some((r) => r[0] === id) && id !== E.editing) errs.push('Order ID “' + id + '” already exists. Use a different ID, or edit that order from the list below.');
    const lines = readLines().filter((l) => l.product || l.qtyRaw !== '' && l.priceRaw !== '' || l.category);
    if (!lines.length) errs.push('Add at least one product with a quantity and a unit price.');
    const out = [];
    lines.forEach((l, i) => {
      const q = IF.parseNumber(l.qtyRaw), p = IF.parseNumber(l.priceRaw);
      const tag = 'Item ' + (i + 1) + ': ';
      if (!l.product) errs.push(tag + 'enter a product name.');
      if (q === null || q <= 0) errs.push(tag + 'quantity must be a number greater than 0.');
      if (p === null || p < 0) errs.push(tag + 'unit price must be a number (0 or more).');
      if (l.product && q > 0 && p !== null && p >= 0) out.push([id, date, l.product, l.category, q, p, Math.round(q * p * 100) / 100, $('eCustId').value.trim(), $('eCustName').value.trim(), $('eCity').value.trim(), $('eState').value.trim(), $('ePay').value.trim(), $('eStatus').value.trim()]);
    });
    if (errs.length) { showErrors(errs); return; }
    $('eErrors').hidden = true;

    saving = true;
    try {
      const type = IF.state.source.type;
      if (type !== 'manual') {
        const label = type === 'demo' ? 'the demo data' : type === 'file' ? 'your uploaded file' : 'no data';
        if (type !== 'none') {
          const ok = await IF.ui.confirm({ title: 'Start your own dataset?', message: 'Your order will be saved in “My Entries”, and the dashboard will switch from ' + label + ' to show only the orders you type in. You can bring ' + label + ' back from Settings or Data Entry at any time.', confirmLabel: 'Save and switch' });
          if (!ok) return;
        }
      }
      const wasEditing = E.editing;
      if (wasEditing) E.rows = E.rows.filter((r) => r[0] !== wasEditing);
      E.rows.push.apply(E.rows, out);
      persistOrWarn();
      await E.commit({ quiet: type === 'manual' });
      IF.ui.toast('success', (wasEditing ? 'Order ' + id + ' updated' : 'Order ' + id + ' saved') + ' (' + F.cur(out.reduce((s, r) => s + r[6], 0), 2) + ').');
      resetForm(true);
      E.refresh();
      $('eId').focus();
    } finally { saving = false; }
  }

  function editOrder(id) {
    const rows = E.rows.filter((r) => r[0] === id);
    if (!rows.length) return;
    const f = rows[0];
    E.editing = id;
    $('eId').value = id; $('eDate').value = f[1]; $('eCustName').value = f[8]; $('eCity').value = f[9]; $('eState').value = f[10]; $('ePay').value = f[11]; $('eStatus').value = f[12];
    updateCustomer(f[7]);
    $('eLines').textContent = '';
    rows.forEach((r) => addLine({ product: r[2], category: r[3], qty: r[4], price: r[5] }));
    $('eFormTitle').textContent = 'Edit order';
    $('eEditText').textContent = 'Editing order ' + id + '. Saving replaces it.';
    $('eEdit').hidden = false;
    $('eSave').textContent = 'Update order';
    $('eErrors').hidden = true;
    if ($('eFormTitle').scrollIntoView) $('eFormTitle').scrollIntoView({ block: 'start' });
    $('eDate').focus();
  }

  async function deleteOrder(id) {
    const ok = await IF.ui.confirm({ title: 'Delete order ' + id + '?', message: 'This removes the order from your entries and from every dashboard page. This cannot be undone.', confirmLabel: 'Delete order', danger: true });
    if (!ok) return;
    E.rows = E.rows.filter((r) => r[0] !== id);
    if (E.editing === id) resetForm(true);
    persistOrWarn();
    await E.commit({ quiet: true });
    E.refresh();
    IF.ui.toast('success', 'Order ' + id + ' deleted.');
  }

  async function clearAll() {
    if (!E.rows.length) { IF.ui.toast('info', 'There are no entries to delete.'); return; }
    const ok = await IF.ui.confirm({ title: 'Delete all entries?', message: 'This permanently deletes all ' + F.num(E.orders().length) + ' orders you typed in, including the saved copy in this browser. Download a backup first if you may need them.', confirmLabel: 'Delete all entries', danger: true });
    if (!ok) return;
    E.clearAll(true);
    resetForm(true);
    if (IF.state.source.type === 'manual') await E.commit({ quiet: true });
    E.refresh();
    IF.ui.toast('success', 'All entries deleted.');
  }

  function downloadBackup() {
    if (!E.rows.length) { IF.ui.toast('error', 'There are no entries to download yet.'); return; }
    const name = 'insightflow-my-entries-' + F.iso(Date.now()) + '.csv';
    IF.download(name, IF.toCSV(IF.DEMO_HEADERS, E.rows));
    IF.ui.toast('success', 'Downloaded ' + name + ' (' + F.num(E.rows.length) + ' rows).');
  }

  /* ---------------- refresh dynamic parts ---------------- */
  function updateKnowledge() {
    know = { prod: new Map(), cust: new Map(), custByName: new Map() };
    const cats = new Set(), cities = new Set(), states = new Set(), ids = new Set(), names = new Set();
    IF.state.records.forEach((r) => { // records are sorted by date, so later rows (latest prices) win
      if (r.product) know.prod.set(r.product, { category: r.category || '', price: r.price !== null ? r.price : (r.qty ? r.revenue / r.qty : null) });
      if (r.category) cats.add(r.category);
      if (r.city) cities.add(r.city);
      if (r.state) states.add(r.state);
      if (r.customerName) names.add(r.customerName);
    });
    const setList = (id, items) => { const el = $(id); if (!el) return; el.textContent = ''; Array.from(items).sort().slice(0, 1500).forEach((x) => el.append(h('option', { value: x }))); };
    setList('dlProducts', know.prod.keys()); setList('dlCategories', cats); setList('dlCities', cities); setList('dlStates', states); setList('dlCustNames', names);
  }

  E.refresh = function () {
    if (!builtForm) return;
    updateKnowledge();
    const type = IF.state.source.type, orders = E.orders();
    const box = $('eSource'); box.textContent = '';
    if (type === 'manual') box.append(h('span', null, IF.icon('check', 16), ' The dashboard is showing ', h('strong', { text: 'My Entries' }), ' (' + F.num(orders.length) + ' order' + (orders.length === 1 ? '' : 's') + '). Each order you save shows up on every page right away.'));
    else {
      box.append(h('span', null, 'The dashboard is currently showing ' + (type === 'demo' ? 'the fictional demo data' : type === 'file' ? 'your uploaded file' : 'no data') + '. When you save your first order, it switches to “My Entries”.'));
      if (E.rows.length) box.append(' ', h('button', { type: 'button', class: 'btn btn-sm', onclick: () => E.commit() }, 'Show my entries (' + F.num(orders.length) + ')'));
    }
    $('eSaveLocal').checked = IF.settings.saveEntries;
    if (!ordersTable) {
      ordersTable = new IF.Table($('eOrders'), {
        id: 'entries', label: 'Orders you typed in', searchPlaceholder: 'Search your orders', defaultSort: { key: 'date', dir: 'desc' }, emptyMessage: 'No orders yet. Fill in the form above and press Save order.',
        columns: [
          { key: 'date', label: 'Date', format: (v) => F.date(IF.parseDate(v)) },
          { key: 'id', label: 'Order ID' },
          { key: 'customer', label: 'Customer', format: (v) => v || '—' },
          { key: 'items', label: 'Items', num: true, format: (v) => F.num(v) },
          { key: 'total', label: 'Total', num: true, format: (v) => F.cur(v, 2) },
          { key: 'status', label: 'Status', format: (v) => v || '—' },
          { key: 'actions', label: 'Actions', noSort: true, render: (row, td) => td.append(
            h('button', { type: 'button', class: 'btn btn-sm', 'aria-label': 'Edit order ' + row.id, onclick: () => editOrder(row.id) }, 'Edit'), ' ',
            h('button', { type: 'button', class: 'btn btn-sm btn-danger', 'aria-label': 'Delete order ' + row.id, onclick: () => deleteOrder(row.id) }, 'Delete')) }
        ]
      });
    }
    ordersTable.setRows(orders);
  };

  IF.pages.entry = {
    render() { if (!builtForm) buildForm(); E.refresh(); },
    init() { buildForm(); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
