# Electricity Map

A different kind of current. Live at **https://map.cujuju.foo**. An **Electron desktop app** with an original three-view observatory plus **ten additional dashboard designs**, all using real U.S. electricity prices. Built with **SolidJS, TypeScript, Vite, Electron, and Node.js**. Browser mode remains available.

- **Electric atlas** — a raised geographic map. State elevation and color encode electricity price; switch between relief and flat geography.
- **Price constellation** — a radial constellation of states. More expensive electricity sits farther from the center; bubble area increases with electricity sales. Census regions determine ordering.
- **Time machine** — a spiral through quarterly history. Solid dots follow a selected state, hollow dots follow the United States. Moving outward advances time; color and marker area encode price.

All three share sector, state, quarter, timeline playback, state rankings, historical detail, CSV download, and shareable URLs. Desktop and mobile layouts include keyboard controls and reduced-motion support.

The top navigation also opens **Change Lab** and **Local Utilities**. Both inherit the selected dashboard's visual theme and share its state and sector selection.

## The Design Lab

Use **Design Lab** at the top of the app to open the visual collection. The selector and arrow buttons switch immediately between the original Observatory and ten complete dashboards. State, sector, quarter and the original lens remain selected when switching. URLs include the selected design for sharing and reloads.

| Design | Direction | Data representation | URL parameter |
| --- | --- | --- | --- |
| Solar Commons | Botanical editorial; cream, green and citrus | State-price sunflower petals | `design=solar` |
| Voltage Bureau | Swiss brutalism; ink, concrete and acid yellow | Ranked price columns | `design=brutalist` |
| Power City | Neon arcade; violet, magenta and pixel type | Isometric towers built from state prices | `design=arcade` |
| Field Control | Cyanotype engineering; blueprints and component labels | Geographic tile schematic | `design=blueprint` |
| Heat Index | Thermal poster; vermilion, peach and red | Radial state-price instrument | `design=thermal` |
| Dark Matter | Cosmic scientific glass; nebula violet | Price versus electricity sales, with a logarithmic sales axis | `design=cosmic` |
| Current FM | Analog radio; warm metal and a dark signal screen | State and national quarterly history | `design=analog` |
| Watt Pop | Candy brutalism; lavender, pink and hard shadows | Price lollipops and state comparisons | `design=candy` |
| Tidal | Liquid glass; teal, mist and soft horizons | Six state histories as ridges on a shared scale | `design=tidal` |
| The Kilowatt | Financial newspaper; paper, ink and rust | Quarterly price almanac | `design=press` |

For example: **http://127.0.0.1:4187/?design=arcade&state=CA&sector=RES&period=2026-Q2**.

Each new dashboard has its own typography, layout treatment, SVG chart, state details, quarter selection, playback, rankings, CSV export, data notes, and mobile layout. Phone charts use dedicated portrait geometry with readable labels: the ranked bars become two columns, towers become an inventory of city blocks, and the almanac puts years down the page. Field Control switches from approximate geography to an explicitly labeled alphabetical component inventory. The radial/architectural metaphors are visualizations of price, not physical temperatures, buildings, or grid transmission connections.

## Change Lab

Follow monthly electricity prices from January 2015 through August 2026. Choose a month and compare it with the same month last year, the previous month, the beginning of the series, or a custom earlier month.

- **Change atlas:** a geographic map with nine metrics: price change in percent or cents/kWh, average price, fixed-usage cost or its change, kWh per customer, revenue per customer, sales growth, and price gap versus the United States. Teal means lower and orange means higher on diverging maps; gray means unavailable. The map scale adapts to the selected metric and comparison, with exact bounds shown below it.
- **Change chronicle:** an interactive state-by-month heatmap of year-over-year price changes. Choose 12, 24, 60, or all available months. Click a cell to select that state and month. Colors saturate at ±30%; exact values remain available on each cell. Missing comparisons remain gray.
- **Turning points:** the largest monthly rise/drop and their reporting months, a consecutive monthly price streak, high/low prices, annualized growth, rank movement, year-over-year volatility and acceleration.
- **Customer lens:** monthly sales and revenue divided by EIA customer counts, plus a chosen-kWh cost scenario. These are account averages and illustrative costs, not an individual household's measured usage or tariff.
- **Spending lens:** a symmetric midpoint decomposition of aggregate revenue change into price and sales-volume contributions, with a rounding residual. It is an accounting comparison, not a causal explanation.

Playback, comparison CSV downloads, state/US history, keyboard controls and shareable URLs work across all eleven visual themes. Large per-account values use compact notation in the headline; the title, details and exports retain the numeric value. Example: **http://127.0.0.1:4187/?lab=changes&design=cosmic&state=CA&sector=RES&month=2026-08&compare=year**.

Methods: percent change is `(current / baseline - 1) × 100`, with zero/missing baselines unavailable. Fixed-usage cost is `cents/kWh × chosen kWh / 100`. Per-account values are `reported total × 1,000,000 / customers`. Annualized growth uses elapsed months. Volatility is the sample standard deviation of available year-over-year percentage changes in the last 36 months, measured in percentage points. Acceleration is the current YoY change less the prior month's YoY change. Competition price ranks assign 1 to the highest price; ties share a rank. Records stop at the selected month, and missing observations interrupt streaks and lines rather than being bridged. The historical chart still displays the complete loaded series to allow navigation.

For spending, the price contribution is `Δprice × mean(sales) / 100`, and the volume contribution is `Δsales × mean(price) / 100`, both in million USD. Their sum reconciles modeled revenue change; the difference from reported revenue is shown separately.

## Local Utilities

Explore **23,879 utility/state/sector/year records** from the **2023–2025 EIA-861 annual surveys**. Search utility name, EIA ID or county; filter by state, sector, report year and reported county. Inspect customer counts, sales, revenue, prior-year price change, and up to three annual price observations. County, search, utility selection and report year are retained in the URL. Export the filtered directory as CSV.

These are **annual utility-wide prices within a state, not measured city-level prices**. Prices are derived from revenue divided by sales. Full-form records include only **bundled service**, aggregated across balancing authorities for the same utility, state and sector. Energy-only and delivery-only service are excluded so unlike services are not combined. Short-form utility totals are listed separately under **All sectors**. Missing inputs remain unavailable; imputed survey records are labeled.

The county index contains **3,096 utility/state lists** from the **2025 Service Territory** file. It identifies counties where a utility reported distribution equipment. It does not establish a county-specific price, exclusive territory, exact address service, or historical county coverage for 2023/2024. Municipal utility names can help locate a city-associated provider, but prices still describe the utility/state observation. The directory does not cover every retail provider or rate plan.

Source archives and fetch time are recorded in `data/utilities.json`; original downloads are saved in the ignored `.cache-eia` directory during refresh. Example: **http://127.0.0.1:4187/?lab=utilities&state=CA&sector=RES**.

## Run locally

Requires Node.js 22.18 or later (Node 24 is used in CI). In PowerShell:

```powershell
Set-Location -LiteralPath 'E:\Development\Projects\Electricity Map'
npm install
npm run dev
```

`npm run dev` opens **Electricity Map Dev** as a desktop window with Vite hot reload. The launcher runs Vite and the Node API under plain Node, with an automatically selected API loopback port proxied through **http://127.0.0.1:4187**. Closing the app stops both servers. Restart it after desktop/backend or snapshot changes.

For a production build:

```powershell
npm run build
npm start
```

`npm start` opens the built desktop app. It runs its own Node service on a free loopback port, so it does not need a separately running server or port 3001. The launcher clears `ELECTRON_RUN_AS_NODE` if an editor terminal supplied it.

For browser development use `npm run dev:web` (Vite on 4187, API on 3001). To serve the built web app use `npm run start:web`. Only browser server mode uses `HOST` and `PORT` from `.env`.

## Public website (Cloudflare Pages)

The browser version is published at **https://map.cujuju.foo** (also `https://electricity-map.pages.dev`, which sends `X-Robots-Tag: noindex` so search engines index only the custom domain). The site is fully static: no Node server runs in production.

`npm run build:pages` runs `vite build`, then `scripts/build-pages.mjs` assembles `dist-pages/`:

- The three snapshots are validated with the same validators as the Node server and copied to `/api/electricity.json`, `/api/monthly.json` and `/api/utilities.json`; `/api/health.json` is generated from the quarterly snapshot. `_redirects` rewrites the extensionless `/api/…` routes the frontend fetches to those files (status 200, not a redirect).
- `_headers` applies the desktop Content Security Policy (`desktopCSP()`, so Google Fonts are allowed and `connect-src` is `'self'`), `nosniff`, `Referrer-Policy`, `Cache-Control: public, max-age=3600` and per-snapshot `Last-Modified` from `fetchedAt`, matching `server/index.mjs`. Hashed `/assets/*` are immutable. Cloudflare negotiates gzip/Brotli itself.
- `functions/api/[[path]].js` returns the server's JSON 404 (`API route not found`) or 405 for any other `/api/*` path; `_routes.json` keeps the four snapshot routes static so the Function only runs for unknown API paths.
- `index.html` gains `<link rel="canonical" href="https://map.cujuju.foo/">`. Set `SITE_URL` or `PAGES_PROJECT` to build for another host or project name.

Share links in the browser are `window.location.href`, so they use whichever host served the page. Desktop builds, `npm run dev:web` and `npm run start:web` are unchanged; `dist-pages/` is ignored by Git and not packaged into Electron.

Preview locally with Cloudflare's runtime, then run the UI tests against it:

```sh
npm run build:pages
npm run pages:dev                                      # http://127.0.0.1:8788
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8788 npm run test:ui
```

### Local CI and release (no GitHub Actions)

GitHub Actions minutes are not used for this private repository, so CI and releases run on a Mac. `.github/workflows/` stays available for manual runs only (`workflow_dispatch`).

| Command | What it does |
| --- | --- |
| `npm run ci:local` | Run before merging a PR: `check`, unit tests, `build:pages`, then the Playwright UI suite against the Node server **and** against `wrangler pages dev dist-pages` |
| `npm run release` | `data:refresh`, the same checks and tests, then `wrangler pages deploy dist-pages --project-name electricity-map --branch main` |
| `npm run deploy:install` | Install the weekly launchd agent `foo.cujuju.electricity-map.deploy` (`deploy:uninstall` removes it) |

Flags for `scripts/release-pages.mjs`: `--no-refresh`, `--no-deploy`, `--no-ui`. Without Google Chrome installed, UI tests use Playwright's bundled Chromium (`PLAYWRIGHT_BUNDLED_CHROMIUM=1`).

The agent is a launchd job (macOS's cron), not a T3 Code task. Every Monday at 09:00, or on the next wake if the Mac was asleep, it runs `~/Library/Application Support/Electricity Map Deploy/runner.mjs`. The runner updates its own clone of `origin/main` in that folder (never your working checkout) and runs `npm run release` there. Output goes to `~/Library/Logs/electricity-map-deploy.log`, and a failure shows a macOS notification. Merges to `main` are not deployed automatically: run `npm run release` on an up-to-date `main` after merging, or wait for Monday. Re-run `npm run deploy:install` after changing `runner.mjs`.

Every release refreshes the data before it deploys. A failed refresh, validation or test stops the release, and the live site keeps its last good deployment. Nothing is committed or pushed, so the repository's `data/` lags the live site. Refresh locally and open a PR when you want the committed (and desktop-bundled) snapshots updated.

Secrets live in the login Keychain under service `electricity-map-deploy`, or in environment variables of the same names:

```sh
security add-generic-password -U -s electricity-map-deploy -a CLOUDFLARE_API_TOKEN -w
security add-generic-password -U -s electricity-map-deploy -a CLOUDFLARE_ACCOUNT_ID -w
security add-generic-password -U -s electricity-map-deploy -a EIA_API_KEY -w
```

`CLOUDFLARE_API_TOKEN` is a custom token with Account · Cloudflare Pages · Edit, Account · Account Settings · Read, and Zone · DNS · Edit for `cujuju.foo` (DNS is only needed to manage the custom domain). `EIA_API_KEY` is a free [EIA key](https://www.eia.gov/opendata/register.php); without it, `DEMO_KEY` is used and EIA rate-limits it (HTTP 429). The same names are also repository secrets for the manual GitHub workflow.

One-time Cloudflare setup (already done for this repository): `wrangler pages project create electricity-map --production-branch main`; add `map.cujuju.foo` under **Workers & Pages → electricity-map → Custom domains**; the `cujuju.foo` zone is on Cloudflare, so its DNS record is a proxied `CNAME map → electricity-map.pages.dev`.

## Desktop behavior and packages

Use **App icon** in the toolbar to choose the blue or purple electrical map. Purple is the default. The choice is remembered on this device and updates the toolbar, title bar, favicon and running desktop window icon (Dock icon on macOS). Installed shortcuts and installer branding use purple. `npm run icons` regenerates web/native icon sizes from the archived full-bleed artwork in `output/imagegen/round-3-icons/`.

The desktop shell adapts Spillway's Solid title bar, native macOS traffic-light layout, isolated preload bridge, window restoration, launcher, and installer conventions. It has native minimize/maximize/restore/close controls, an application menu, zoom/fullscreen shortcuts, a single-instance lock, external links in the default browser, and CSV downloads through Electron's native download handling.

Window bounds, maximized state and the selected dashboard/workspace/filters are restored at launch. State lives in the app's user-data directory (`%APPDATA%\Electricity Map` on Windows); development uses `Electricity Map Dev`. Bounds are clamped to connected displays when monitors change. `ELECTRICITY_MAP_PROFILE` accepts an absolute directory for an isolated profile, used by desktop tests.

Share buttons copy `electricity-map://open?...` links in Electron and ordinary HTTP URLs in browser mode. The Windows installer registers the protocol; opening a link activates the existing app and restores the linked dashboard. Unpacked source builds can display/copy these links, but require an installed protocol handler to open them through the operating system.

The production renderer is sandboxed with Node integration disabled, context isolation, a narrow sender-validated window-control bridge, restricted navigation and a Content Security Policy. Its Node service serves bundled EIA snapshots locally. Charts/data work offline; Google Fonts have system fallbacks when offline.

```powershell
npm run package:dir   # Unpacked app under release\win-unpacked on Windows
npm run package       # Windows x64 installer and portable executable under release
```

Windows output names are `Electricity-Map-Setup-1.1.0-x64.exe` and `Electricity-Map-Portable-1.1.0-x64.exe`. The packaged app includes Electron/Node and all three snapshots; users do not need Node or npm installed. Build outputs are ignored by Git. These local packages are unsigned, and automatic application updates are not configured. This app has its own identity and protocol; it does not use Spillway's update feed or credentials.

Windows x64 packaging is tested. macOS DMG and Linux AppImage targets are configured but unverified on their native platforms. Rebuild the app after refreshing source snapshots. `npm run icons` regenerates the desktop icons, `favicon.ico`, `apple-touch-icon.png` and the web app manifest's 192 px icon from the purple Midnight Grid artwork using PowerShell/System.Drawing on Windows. Spillway's MIT notice ships in `licenses/Spillway.txt`.

Vite generates bundled renderer dependency notices at `dist/licenses/npm-renderer.txt`. Packaging requires these notices and ships them beside the app under `resources/licenses/`, following Spillway's build convention. The production dependency audit is clean; npm currently reports moderate minimatch-related advisories in the development-only electron-builder toolchain.

## Data and provenance

Source: [the original EIA Electricity Data Browser](https://www.eia.gov/electricity/data/browser/#/topic/7?agg=1,0&geo=g0fvvvvvvvvvo&endsec=8&linechart=ELEC.PRICE.US-RES.Q&freq=Q). The original link selects `ELEC.PRICE.US-RES.Q`: U.S. residential average retail electricity price, quarterly.

The bundled snapshot was fetched November 3, 2026 UTC. It contains **9,568 observations**, **46 quarters** (2015 Q1–2026 Q2), **50 states + DC + a separate U.S. total**, and four sectors: residential, commercial, industrial, and all sectors. It is a dated snapshot, not a live transmission-grid feed. `data/electricity.json` records the exact fetch time, source, units, and unrounded observations.

The monthly snapshot, also fetched November 3, contains **29,120 observations**, **140 months** (2015-01–2026-08), the same 52 geographies and four sectors, and reported customer counts. The annual utility snapshot covers 2023–2025. The Node routes `/api/electricity`, `/api/monthly`, and `/api/utilities` serve the bundled snapshots with provenance headers; the latter two negotiate gzip compression. The utility snapshot is fetched by the browser only when opening Local Utilities.

Prices are **nominal cents/kWh**. EIA supplies quarterly prices directly; this app does not average monthly prices or state prices to obtain national figures. EIA sales are million kWh, displayed as TWh by dividing by 1,000. Revenue is million dollars. Missing observations remain `null` and display as unavailable, never zero. Regional aggregates are excluded from state visuals.

The original Observatory color scale runs from 5 to 50¢/kWh; values outside it saturate. Atlas elevation and constellation distance are capped, with exact values always available in details. The ten new dashboards share a price scale that starts at zero and ends at at least 60¢/kWh, expanded to cover the entire loaded snapshot rather than rescaled by quarter. Dark Matter omits observations without valid sales or price from its scatter plot and reports how many were omitted. History lines break at missing prices. Calendar cells display unavailable observations as gray with an em dash.

Constellation connectors are visual guides, not electrical transmission lines. Geography is Albers USA from [us-atlas](https://github.com/topojson/us-atlas), with repositioned Alaska and Hawaii. Field Control uses an explicitly approximate tile map. Small states and DC can be selected from the state dropdown or rankings.

## Update the snapshot

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
# Optional: set EIA_API_KEY in .env to your own registered EIA key.
npm run data:refresh
```

The public `DEMO_KEY` works within EIA's demo limits; a personal [EIA API key](https://www.eia.gov/opendata/register.php) is optional. Keys stay in the ignored `.env` file and never enter the browser bundle. Refresh runs quarterly, monthly, then annual utility updates. Each snapshot is validated and replaced atomically after its own complete fetch succeeds; the three-file refresh is not a single transaction. Failed fetches leave that snapshot intact, and stop subsequent refresh steps. Restart Node after refreshing.

To update just one source, use `npm run data:refresh:quarterly`, `npm run data:refresh:monthly`, or `npm run data:refresh:utilities`. The utility refresh discovers the three latest annual archives on the [EIA-861 page](https://www.eia.gov/electricity/data/eia861/), downloads fresh copies to include revisions, parses full/short-form workbooks and the latest county coverage file, then validates identities, values and units before publishing.

[EIA API documentation](https://www.eia.gov/opendata/documentation.php) describes the `electricity/retail-sales` dataset and its monthly and quarterly frequencies.

## Validation

```powershell
npm run check
npm test
npm run build
npm run test:ui
npm run test:desktop
```

UI tests use installed Google Chrome through Playwright and serve the production build on port 3187. They cover the original views and all ten dashboards, chart keyboard interactions, state/sector/quarter selection, playback, URL restoration, switching designs, rankings, source notes, CSV contents, missing data, error recovery, and desktop/mobile overflow. New checks cover monthly calculations against the actual snapshot, per-account units, chosen usage, custom baseline restoration/clamping, heatmap interaction, utility search, county coverage and URL restoration. Unit tests check change calculations, missing months, ties, annualized growth, price/volume reconciliation, snapshot integrity and compressed HTTP responses. Screenshots are written under the ignored test-results directory.

Desktop tests launch the real Electron binary with isolated temporary profiles. They check the bridge, window controls, bundled API/CSP, CSV download, protocol links, clipboard sharing, blocked navigation, restart restoration and utility data. A separate development check verifies Vite/API startup and shutdown. Set `ELECTRICITY_MAP_EXECUTABLE` to an absolute packaged executable to run the production check against that build; development checks are skipped for packaged binaries. Desktop screenshots are written under the ignored `test-results-desktop` directory.

## Project layout

```text
src/                 SolidJS application and SVG visualizations
src/assets/          Bundled geographic topology
src/designs/         Ten dashboard designs, chart components, catalog and Design Lab
src/analytics/       Monthly Change Lab, shared calculations and annual utility explorer
src/desktop/         Solid title bar, desktop bridge types, native share links and chrome
desktop/             Electron main process, sandboxed preload and window/deep-link state
resources/           Native app icons
licenses/            Redistributed desktop component notices
server/              Node HTTP server, EIA adapter and validation
scripts/             Development runner and snapshot refresh
data/                Quarterly, monthly and annual utility EIA snapshots
tests/               Data, HTTP and browser checks
```

Repository: [Cujuju/electricity-map](https://github.com/Cujuju/electricity-map) (private). Follow-up work is tracked in GitHub Issues.
