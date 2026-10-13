# InsightFlow — Data Analytics Dashboard

**Turn Your Data Into Decisions.** A sales analytics dashboard by **Jatnex Technologies**. Upload a CSV or Excel file and explore revenue, products, customers and locations, then download CSV summaries or print a report.

It is plain HTML, CSS and JavaScript. There is no build step, no backend and no API key, so it runs on GitHub Pages and Netlify as-is.

## Features

- **Overview**: six KPI cards (revenue, orders, units, average order value, customers, revenue growth) with the change against the previous equivalent period, tooltips and small trend lines; revenue over time (daily, weekly, monthly), sales by category, top 10 products, and key findings.
- **Sales Analytics**: orders vs revenue, monthly performance against the previous period, payment method distribution, monthly summary table.
- **Products**: searchable, sortable, paginated table with category filter and CSV export; top products and lowest-revenue products (only ranked when there are at least 10 products).
- **Customers**: unique customers, revenue per customer, order frequency, new vs returning, top customers, searchable table.
- **Geographic Analysis**: revenue and orders by city or state/region, ranking table, top locations. No map is drawn, because place names alone are not reliable coordinates and none are invented.
- **Data Entry**: type orders straight into the dashboard (order ID, date, customer, city, state, payment, status, and several products per order) with autocomplete and auto-fill from existing data, an automatic Customer ID (existing customers are recognised by name and city; if two people share a name and city you are asked which one it is), edit or delete orders, and see them on every page immediately. Optional saving in this browser, plus CSV backup.
- **Data Explorer**: paginated, searchable, sortable table of the imported columns; column visibility; missing-value and duplicate summaries; detected column types; export.
- **Reports**: four CSV downloads and a printable report (title, date, range, filters, KPIs, charts, findings, assumptions). Use "Save as PDF" in the print dialog.
- **Upload wizard**: drag and drop or browse, CSV/XLS/XLSX, size and type checks, worksheet picker, preview, automatic column detection with manual mapping, date-format choice, data-quality summary before import.
- **Global filters** (date range, category, product, city, state, payment method, order status), active-filter chips, reset and clear.
- **Settings**: light/dark theme, currency (INR, USD, EUR, GBP), number and date formats, reset and clear actions with confirmation dialogs.
- Responsive layout, keyboard navigation, visible focus states, labelled controls, loading, empty, success and error states.

## Technologies

HTML5, CSS3, vanilla JavaScript (ES6+), [Chart.js 4.4.3](https://www.chartjs.org/), [PapaParse 5.4.1](https://www.papaparse.com/), [SheetJS 0.20.3](https://sheetjs.com/) (loaded from the SheetJS CDN), inline SVG icons, Manrope font from Google Fonts. Libraries load from CDNs with pinned versions, so the first load needs an internet connection.

## Folder structure

```
insightflow-dashboard/
├── index.html
├── README.md
├── LICENSE
├── .gitignore
├── netlify.toml
├── assets/
│   ├── css/styles.css
│   ├── js/
│   │   ├── data.js        shared state, formatting, parsing, cleaning, demo data
│   │   ├── analytics.js   pure calculations (KPIs, grouping, insights)
│   │   ├── filters.js     date range + global filters -> one filtered dataset
│   │   ├── charts.js      Chart.js builders + Sales Analytics page
│   │   ├── tables.js      reusable table + Products, Customers, Geo, Explorer pages
│   │   ├── upload.js      CSV/Excel import wizard
│   │   ├── reports.js     CSV exports + printable report
│   │   ├── entry.js       manual data entry (My Entries)
│   │   └── app.js         shell, KPIs, Overview, Settings, routing
│   └── images/
├── data/sample-sales.csv
└── scripts/generate-sample-data.js   (optional developer tool)
```

## Run locally

Double-click `index.html`, or serve the folder (recommended):

```
python3 -m http.server 8000
```

then open http://localhost:8000. No Node.js is needed.

## Test the uploads

1. Open **Settings → Download sample CSV** (or use `data/sample-sales.csv`).
2. Click **Upload data**, drop the file, check the column matching, click **Check data quality**, then **Import and analyze**.
3. For Excel, open the CSV in Excel or Google Sheets, save as `.xlsx`, and upload that. If the workbook has several sheets, pick one in the wizard.
4. Try breaking things: a `.txt` file, an empty file, a header-only file, a file over 10 MB, a row with a bad date or negative revenue. Each should give a clear message and never crash the page.

## Supported data columns

Only **Order Date** and **Revenue** are required. Revenue can be calculated as Quantity × Unit Price when the Revenue cell is empty. Every other field is optional; pages that need a missing field explain what is unavailable.

| Field | Used for |
|---|---|
| Order Date (required) | all time-based analysis |
| Revenue (or Quantity + Unit Price) | all money figures |
| Order ID | Total Orders, Average Order Value |
| Quantity, Unit Price | Units Sold, average selling price |
| Product Name, Category | Products, category charts |
| Customer ID / Customer Name | Customers page |
| City, State / Region | Geographic page |
| Payment Method, Order Status | payment chart, status filter |

Rules applied: negative or zero quantities, negative revenue, unreadable dates and exact duplicate rows are left out (and counted in the quality summary); zero-revenue rows are kept; missing values are never filled in. Multiple rows with the same Order ID are treated as one multi-product order. By default, orders whose status contains cancel/return/refund/fail/void/reject are not counted (a setting, and bypassed by choosing a status filter). Dates like 03/04/2026 are read day-first unless the data proves otherwise or you choose month-first.

## Sample dataset

`data/sample-sales.csv` has 3,977 rows of **fictional** orders (Oct 2025 – Sep 2026), 25 products, 6 categories, 360 customers, 10 Indian cities, 6 payment methods and 5 order statuses. It is generated by `IF.generateDemo()` in `data.js`, and all dashboard numbers are calculated from it. "Demo Data" is shown whenever it is active.

## Upload to GitHub

```
cd insightflow-dashboard
git init
git add .
git commit -m "InsightFlow dashboard"
git branch -M main
git remote add origin https://github.com/<your-username>/insightflow-dashboard.git
git push -u origin main
```

For GitHub Pages: repository **Settings → Pages → Deploy from a branch → main / (root)**.

## Deploy on Netlify

- **Drag and drop**: go to https://app.netlify.com/drop and drop the project folder.
- **From GitHub**: *Add new site → Import an existing project → pick the repo*. Leave the build command empty and set the publish directory to `.` (already set in `netlify.toml`).

## Privacy and data handling

- Files are read and analysed in the browser. Nothing is uploaded, and no analytics or tracking code is included. The only network requests are the library and font downloads.
- Uploaded data is kept in memory only and disappears on reload.
- Orders typed into **Data Entry** are kept in memory and, if "Save my entries in this browser" is on (the default), also in LocalStorage so they survive a reload. That copy is not encrypted, exists only on that browser and device, and is lost if browser data is cleared, so download the CSV backup regularly. Turn the option off to keep nothing.
- LocalStorage stores display preferences (theme, currency, formats, rows per page, date range, last page) and, only when that option is on, your typed Data Entry orders. It is **not encrypted**, the browser can clear it at any time, and it is suitable for demo preferences, not for secure storage of sensitive business data.
- Imported values are written to the page as text, and CSV exports neutralise cells that start with `=`, `+`, `-` or `@` to prevent spreadsheet formula injection.
- No customer data is written to the browser console.

## Known limitations

- Needs internet on first load for Chart.js, PapaParse, SheetJS and the font (no offline bundle yet; fonts fall back to system fonts).
- Data Entry is single-user and single-browser: entries are not shared between devices or people (there is no backend). Use the CSV backup to move them.
- Limits: 10 MB, 100,000 rows, 200 columns per file. Large files are processed on the main thread.
- No map view; no currency conversion (currency only changes how numbers are displayed).
- "New vs returning" needs a start date later than the first date in the data, and defines "new" as a first order inside the selected range.
- Report charts are images drawn from the current data; print layout depends on the browser's print engine. There is no built-in PDF generator.
- CSV dates with a two-digit year are assumed to be 20xx. Encodings other than UTF-8 may show odd characters.
- Verification so far: the calculations, the page logic and the upload flows were exercised with automated Node/jsdom tests (about 50 checks). The visual design, chart rendering with real Chart.js, printing and mobile layouts were **not** checked in a real browser and should be reviewed there before publishing.

## Future improvements

Offline bundle of the libraries; Web Worker parsing for big files; saved column mappings; map view with user-supplied coordinates; forecasting with clearly shown assumptions; shareable filter links; automated browser tests.

## License

MIT — see `LICENSE`.
