/*!
 * InsightFlow — upload.js
 * CSV / Excel import wizard: choose file -> map columns -> review data quality -> import.
 * Files are read in the browser with FileReader / PapaParse / SheetJS and are never sent anywhere.
 */
(function (root) {
  'use strict';
  const IF = (root.IF = root.IF || {});
  const U = (IF.upload = {});
  const L = IF.LIMITS;

  /* ------------------------------------------------------------------
   * Pure helpers (no DOM) — also used by the automated tests
   * ------------------------------------------------------------------ */

  /** Turn an array of row-arrays into {headers, rows}. Returns {error} when unusable. */
  U.buildTable = function (arrays) {
    let hi = -1;
    for (let i = 0; i < arrays.length && hi < 0; i++) if (arrays[i].some((v) => !IF.isBlank(v))) hi = i;
    if (hi < 0) return { error: 'The file is empty. Choose a file that contains a header row and at least one row of data.' };
    let end = arrays.length;
    while (end > hi + 1 && !arrays[end - 1].some((v) => !IF.isBlank(v))) end--; // drop trailing blank rows
    const body = arrays.slice(hi + 1, end);
    if (!body.length) return { error: 'The file has a header row but no data rows. Add at least one row of data and try again.' };
    if (body.length > L.maxRows) return { error: 'This file has ' + IF.fmt.num(body.length) + ' rows. The limit is ' + IF.fmt.num(L.maxRows) + ' so the browser stays responsive. Split the file or remove old rows first.' };
    let width = 0;
    const scan = (r) => { for (let j = r.length - 1; j >= 0; j--) if (!IF.isBlank(r[j])) { if (j + 1 > width) width = j + 1; break; } };
    scan(arrays[hi]);
    for (let i = 0; i < body.length; i++) scan(body[i]);
    if (width === 0) return { error: 'No columns were found in this file.' };
    if (width > L.maxCols) return { error: 'This file has ' + width + ' columns. The limit is ' + L.maxCols + '.' };
    const seen = {};
    const headers = [];
    for (let j = 0; j < width; j++) {
      let name = IF.isBlank(arrays[hi][j]) ? 'Column ' + (j + 1) : String(arrays[hi][j]).trim();
      if (seen[name]) { seen[name]++; name = name + ' (' + seen[name] + ')'; } else seen[name] = 1;
      headers.push(name);
    }
    const rows = body.map((r) => { const out = new Array(width); for (let j = 0; j < width; j++) out[j] = r[j] === undefined ? '' : r[j]; return out; });
    return { headers, rows, firstDataRow: hi + 2 };
  };

  /** Parse CSV text with PapaParse. Returns {arrays, warnings} or {error}. */
  U.parseCSV = function (text, PapaLib) {
    const Papa = PapaLib || root.Papa;
    if (!Papa) return { error: 'The CSV reader could not load. Check your internet connection (PapaParse is loaded from a CDN) and refresh the page.' };
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    if (!text.trim()) return { error: 'The file is empty. Choose a file that contains a header row and at least one row of data.' };
    const res = Papa.parse(text, { skipEmptyLines: false });
    const warnings = [];
    let mismatch = 0, quotes = 0;
    (res.errors || []).forEach((e) => { if (e.type === 'FieldMismatch') mismatch++; else if (e.type === 'Quotes') quotes++; });
    if (mismatch) warnings.push(mismatch + ' row(s) have a different number of cells than the header. Missing cells are treated as empty and extra cells are ignored.');
    if (quotes) warnings.push('The file has a quotation mark that is not closed properly. Rows after it may have been merged into one cell. Open the file in a spreadsheet app and re-save it as CSV if the numbers look wrong.');
    return { arrays: res.data, warnings };
  };

  /** Read an Excel workbook (ArrayBuffer). Returns {wb, sheets:[{name, usable, rows}]} or {error}. */
  U.parseWorkbook = function (buffer, XLSXLib) {
    const XLSX = XLSXLib || root.XLSX;
    if (!XLSX) return { error: 'The Excel reader could not load. Check your internet connection (SheetJS is loaded from a CDN) and refresh the page.' };
    let wb;
    try { wb = XLSX.read(buffer, { type: 'array', cellDates: false }); } catch (e) {
      return { error: 'This Excel file could not be read. It may be password-protected, damaged or not a real .xls/.xlsx file. Try re-saving it from Excel as .xlsx or .csv.' };
    }
    const sheets = (wb.SheetNames || []).map((name) => {
      const ws = wb.Sheets[name];
      const arrays = ws && ws['!ref'] ? XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '', blankrows: true }) : [];
      const nonBlank = arrays.filter((r) => r.some((v) => !IF.isBlank(v))).length;
      return { name, arrays, usable: nonBlank >= 2, rows: Math.max(0, nonBlank - 1) };
    });
    if (!sheets.some((s) => s.usable)) return { error: 'None of the sheets in this workbook contain a header row plus data. Chart sheets and empty sheets cannot be analysed.' };
    return { wb, sheets };
  };

  /** Validate a chosen file before reading it. Returns an error string or ''. */
  U.checkFile = function (file) {
    if (!file) return 'No file was selected.';
    const name = (file.name || '').toLowerCase();
    const ext = name.slice(name.lastIndexOf('.'));
    if (['.csv', '.xls', '.xlsx'].indexOf(ext) < 0) return '“' + file.name + '” is not a supported file type. Upload a .csv, .xls or .xlsx file.';
    if (file.size === 0) return '“' + file.name + '” is empty (0 bytes).';
    if (file.size > L.maxFileBytes) return '“' + file.name + '” is ' + IF.fmt.bytes(file.size) + '. The limit is ' + IF.fmt.bytes(L.maxFileBytes) + '. Split the file or remove columns you do not need.';
    return '';
  };

  /* ------------------------------------------------------------------
   * Wizard UI
   * ------------------------------------------------------------------ */
  const s = { file: null, kind: null, sheets: null, sheetName: '', table: null, mapping: {}, fileWarnings: [], dateFmt: 'DMY', dateManual: false, dedupe: true, quality: null, records: null, fromCurrent: false, busy: false };
  const $ = (id) => document.getElementById(id);
  let dlg = null;

  function reset() {
    Object.assign(s, { file: null, kind: null, sheets: null, sheetName: '', table: null, mapping: {}, fileWarnings: [], dateFmt: 'DMY', dateManual: false, dedupe: true, quality: null, records: null, fromCurrent: false, busy: false });
    $('fileInput').value = '';
    setStatus('');
    $('uploadLoading').hidden = true;
  }
  function setStatus(msg, kind) {
    const el = $('uploadStatus');
    el.textContent = msg || '';
    el.className = 'state ' + (kind === 'ok' ? 'state-ok' : 'state-error');
    el.hidden = !msg;
  }
  function showStep(n) {
    [1, 2, 3].forEach((i) => { $('uploadStep' + i).hidden = i !== n; });
    document.querySelectorAll('#uploadSteps li').forEach((li) => {
      const i = +li.dataset.step;
      li.classList.toggle('is-current', i === n);
      li.classList.toggle('is-done', i < n);
      if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
    });
    const body = dlg.querySelector('.modal-body'); if (body) body.scrollTop = 0;
  }

  U.open = function (opts) {
    opts = opts || {};
    reset();
    if (opts.fromCurrent && IF.state.table) {
      s.fromCurrent = true;
      s.table = IF.state.table;
      s.mapping = Object.assign({}, IF.state.mapping);
      s.dateFmt = IF.state.dateFormat || 'DMY';
      s.dateManual = true;
      s.dedupe = IF.state.removeDuplicates !== false;
      s.sheetName = IF.state.source.sheet || '';
      s.file = { name: IF.state.source.name || 'Current data', size: null };
      renderMapping();
      showStep(2);
    } else showStep(1);
    if (!dlg.open) dlg.showModal();
  };
  U.close = function () { if (dlg && dlg.open) dlg.close(); };

  async function handleFile(file) {
    setStatus('');
    const problem = U.checkFile(file);
    if (problem) { setStatus(problem); return; }
    s.file = file; s.fromCurrent = false;
    $('uploadLoading').hidden = false;
    s.busy = true;
    try {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
      if (ext === '.csv') {
        const text = await readText(file);
        const res = U.parseCSV(text);
        if (res.error) throw new Error(res.error);
        const t = U.buildTable(res.arrays);
        if (t.error) throw new Error(t.error);
        s.kind = 'csv'; s.sheets = null; s.sheetName = ''; s.table = t; s.fileWarnings = res.warnings;
      } else {
        const buf = await readBuffer(file);
        const res = U.parseWorkbook(buf);
        if (res.error) throw new Error(res.error);
        s.kind = 'xlsx'; s.sheets = res.sheets; s.fileWarnings = [];
        const first = res.sheets.filter((x) => x.usable).sort((a, b) => b.rows - a.rows)[0]; // start with the biggest sheet
        if (!useSheet(first.name)) return;
      }
      s.mapping = IF.detectMapping(s.table.headers);
      s.dateManual = false;
      detectDate();
      renderMapping();
      showStep(2);
    } catch (e) {
      setStatus(e.message || 'This file could not be read.');
      showStep(1);
    } finally { $('uploadLoading').hidden = true; s.busy = false; }
  }
  const readText = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error('The file could not be read. Try again or re-save it.')); r.readAsText(f); });
  const readBuffer = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('The file could not be read. Try again or re-save it.')); r.readAsArrayBuffer(f); });

  /** Switch to a worksheet. Returns false (and shows an error) when it cannot be used. */
  function useSheet(name) {
    const sh = s.sheets.find((x) => x.name === name);
    const t = U.buildTable(sh.arrays);
    if (t.error) { setStatus('Sheet “' + name + '”: ' + t.error); showStep(1); return false; }
    s.sheetName = name; s.table = t;
    return true;
  }

  function detectDate() {
    if (s.dateManual || s.mapping.date === undefined || s.mapping.date < 0) return;
    const col = s.mapping.date;
    const sample = s.table.rows.length > 20000 ? s.table.rows.slice(0, 20000) : s.table.rows;
    const d = IF.detectDateFormat(sample.map((r) => r[col]));
    s.dateFmt = d.format; s.dateInfo = d;
  }

  function renderMapping() {
    const h = IF.h, t = s.table;
    $('uploadFileInfo').textContent = '';
    $('uploadFileInfo').append(
      h('strong', { text: s.file.name }), ' · ', s.file.size ? IF.fmt.bytes(s.file.size) + ' · ' : '',
      IF.fmt.num(t.rows.length) + ' rows · ' + t.headers.length + ' columns', s.sheetName ? ' · sheet “' + s.sheetName + '”' : '');

    // worksheet picker
    const sheetField = $('sheetField'), sheetSel = $('sheetSelect');
    if (s.sheets && s.sheets.length > 1) {
      sheetField.hidden = false; sheetSel.textContent = '';
      s.sheets.forEach((x) => sheetSel.append(h('option', { value: x.name, disabled: !x.usable, text: x.name + (x.usable ? ' (' + IF.fmt.num(x.rows) + ' rows)' : ' (empty or unsupported)') })));
      sheetSel.value = s.sheetName;
    } else sheetField.hidden = true;

    // detected columns
    const cols = $('detectedCols'); cols.textContent = '';
    t.headers.forEach((hd) => cols.append(h('li', { class: 'chip', text: hd })));

    // warnings from reading the file
    const w = $('uploadWarnings'); w.textContent = ''; w.hidden = !s.fileWarnings.length;
    s.fileWarnings.forEach((m) => w.append(h('p', null, IF.icon('alert', 16), ' ' + m)));

    // preview table
    const pv = $('previewTable'); pv.textContent = '';
    const body = h('tbody');
    t.rows.slice(0, L.previewRows).forEach((r) => body.append(h('tr', null, r.map((v) => h('td', { text: IF.isBlank(v) ? '—' : String(v) })))));
    pv.append(h('table', { class: 'data compact' }, h('thead', null, h('tr', null, t.headers.map((x) => h('th', { scope: 'col', text: x })))), body));

    // mapping selects
    const grid = $('mapGrid'); grid.textContent = '';
    IF.FIELDS.forEach((f) => {
      const id = 'map-' + f.key;
      const sel = h('select', { id, class: 'input', dataset: { key: f.key } });
      sel.append(h('option', { value: '-1', text: '— Not in my file —' }));
      t.headers.forEach((hd, i) => sel.append(h('option', { value: String(i), text: hd })));
      sel.value = String(s.mapping[f.key] === undefined ? -1 : s.mapping[f.key]);
      sel.addEventListener('change', () => { s.mapping[f.key] = +sel.value; if (f.key === 'date') { s.dateManual = false; detectDate(); updateDateUI(); } $('mapErrors').hidden = true; });
      grid.append(h('div', { class: 'field' }, h('label', { for: id }, f.label, f.required ? h('span', { class: 'req', text: ' (required)' }) : null), sel));
    });
    $('dedupe').checked = s.dedupe;
    updateDateUI();
    $('mapErrors').hidden = true;
  }

  function updateDateUI() {
    $('dateFmtSelect').value = s.dateFmt;
    const info = s.dateInfo, hint = $('dateFmtHint');
    if (s.dateManual) hint.textContent = 'You chose this format.';
    else if (info && info.conflict) hint.textContent = 'The date column mixes day-first and month-first values. Day first was assumed. Check the data-quality summary.';
    else if (info && !info.certain) hint.textContent = 'Every date could be read either way (for example 03/04/2026), so day first was assumed. Change this if your dates are month first.';
    else hint.textContent = 'Detected from your data.';
  }

  function runQuality() {
    const errs = IF.validateMapping(s.mapping);
    const box = $('mapErrors');
    box.textContent = '';
    if (errs.length) {
      box.hidden = false;
      errs.forEach((m) => box.append(IF.h('p', null, IF.icon('alert', 16), ' ' + m)));
      box.focus();
      return;
    }
    s.dedupe = $('dedupe').checked;
    const res = IF.normalize(s.table, s.mapping, { dateFormat: s.dateFmt, removeDuplicates: s.dedupe });
    s.records = res.records; s.quality = res.quality;
    renderQuality();
    showStep(3);
  }

  function renderQuality() {
    const h = IF.h, q = s.quality, F = IF.fmt, out = $('qualityBody');
    out.textContent = '';
    const cards = h('div', { class: 'mini-kpis' });
    [['Rows read', F.num(q.totalRows)], ['Ready for analysis', F.num(q.usedRows)], ['Left out', F.num(q.excludedTotal + q.blankRows)],
      ['Date range', q.dateMin ? F.date(q.dateMin) + ' to ' + F.date(q.dateMax) : '—']].forEach((x) => cards.append(h('div', { class: 'mini-kpi' }, h('span', { class: 'small muted', text: x[0] }), h('strong', { text: x[1] }))));
    out.append(cards);
    if (!q.usedRows) out.append(h('div', { class: 'state state-error', role: 'alert' }, h('strong', { text: 'No rows can be analysed.' }), h('p', { text: 'Go back and check that Order Date and Revenue are mapped to the right columns and that the date format matches your file.' })));

    const reasons = Object.keys(q.excluded);
    if (reasons.length || q.blankRows) {
      const body = h('tbody');
      reasons.forEach((r) => body.append(h('tr', null, h('th', { scope: 'row', text: r }), h('td', { class: 'num', text: F.num(q.excluded[r].count) }), h('td', { text: 'e.g. row ' + q.excluded[r].rows.join(', ') }))));
      if (q.blankRows) body.append(h('tr', null, h('th', { scope: 'row', text: 'Completely blank row' }), h('td', { class: 'num', text: F.num(q.blankRows) }), h('td', { text: '—' })));
      out.append(h('h3', { text: 'Rows left out and why' }), h('div', { class: 'table-scroll' }, h('table', { class: 'data compact' }, h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Reason' }), h('th', { scope: 'col', class: 'num', text: 'Rows' }), h('th', { scope: 'col', text: 'Where to look (row numbers in your file)' }))), body)));
    } else out.append(h('p', { class: 'state state-ok', role: 'status' }, IF.icon('check', 16), ' Every row passed the checks.'));

    const missKeys = Object.keys(q.missing).filter((k) => q.missing[k] > 0);
    if (missKeys.length) {
      const body = h('tbody');
      missKeys.forEach((k) => body.append(h('tr', null, h('th', { scope: 'row', text: IF.fieldLabel(k) }), h('td', { class: 'num', text: F.num(q.missing[k]) }), h('td', { class: 'num', text: F.pct(q.usedRows ? (q.missing[k] / q.usedRows) * 100 : 0) }))));
      out.append(h('h3', { text: 'Missing values in the rows that were kept' }), h('div', { class: 'table-scroll' }, h('table', { class: 'data compact' }, h('thead', null, h('tr', null, h('th', { scope: 'col', text: 'Field' }), h('th', { scope: 'col', class: 'num', text: 'Missing' }), h('th', { scope: 'col', class: 'num', text: 'Share' }))), body)));
      out.append(h('p', { class: 'small muted', text: 'Missing values are never filled in. They appear as “Unknown” in charts, or the related metric is shown as unavailable.' }));
    }
    const notes = q.warnings.concat(q.assumptions);
    out.append(h('h3', { text: 'Assumptions and notes' }), h('ul', { class: 'notes' }, notes.map((n) => h('li', { text: n }))));
    $('importBtn').disabled = !q.usedRows;
  }

  async function doImport() {
    if (!s.records || !s.records.length) return;
    $('importBtn').disabled = true;
    U.close();
    await IF.app.loadDataset({ table: s.table, mapping: Object.assign({}, s.mapping), records: s.records, quality: s.quality, dateFormat: s.dateFmt, removeDuplicates: s.dedupe, source: { type: s.fromCurrent ? IF.state.source.type : 'file', name: s.file.name, sheet: s.sheetName } });
  }

  U.init = function () {
    dlg = $('uploadDialog');
    const dz = $('dropzone'), input = $('fileInput');
    $('browseBtn').addEventListener('click', () => input.click());
    input.addEventListener('change', () => { if (input.files && input.files[0]) handleFile(input.files[0]); });
    ['dragenter', 'dragover'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
    dz.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (!files || !files.length) return;
      if (files.length > 1) setStatus('Please drop one file at a time. Only the first file will be used.');
      handleFile(files[0]);
    });
    // Dropping a file anywhere else on the page opens the wizard instead of leaving the app
    window.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (dlg.open || !e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      U.open();
      handleFile(e.dataTransfer.files[0]);
    });
    $('uploadClose').addEventListener('click', U.close);
    ['cancelBtn1', 'cancelBtn2', 'cancelBtn3'].forEach((id) => $(id).addEventListener('click', U.close));
    ['replaceBtn2', 'replaceBtn3'].forEach((id) => $(id).addEventListener('click', () => { reset(); showStep(1); $('browseBtn').focus(); }));
    $('sheetSelect').addEventListener('change', (e) => {
      if (!useSheet(e.target.value)) return;
      s.mapping = IF.detectMapping(s.table.headers); s.dateManual = false; detectDate(); renderMapping();
    });
    $('dateFmtSelect').addEventListener('change', (e) => { s.dateFmt = e.target.value; s.dateManual = true; updateDateUI(); });
    $('checkQualityBtn').addEventListener('click', runQuality);
    $('backBtn3').addEventListener('click', () => showStep(2));
    $('importBtn').addEventListener('click', doImport);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) U.close(); }); // click on backdrop
  };
})(typeof window !== 'undefined' ? window : globalThis);
