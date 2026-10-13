/* Optional developer tool: regenerates data/sample-sales.csv from the same
 * generator the dashboard uses. Not needed to run the dashboard.
 * Usage: node scripts/generate-sample-data.js */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ctx = { console };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/data.js'), 'utf8'), ctx);
const csv = ctx.IF.demoCSV();
fs.writeFileSync(path.join(__dirname, '../data/sample-sales.csv'), csv);
console.log('Wrote data/sample-sales.csv (' + ctx.IF.generateDemo().rows.length + ' rows)');
