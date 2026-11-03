# Electricity Map

A different kind of current. Three experimental, interactive representations of real U.S. electricity prices, built with **SolidJS, TypeScript, Vite, and Node.js**.

- **Electric atlas** — a raised geographic map. State elevation and color encode electricity price; switch between relief and flat geography.
- **Price constellation** — a radial constellation of states. More expensive electricity sits farther from the center; bubble area increases with electricity sales. Census regions determine ordering.
- **Time machine** — a spiral through quarterly history. Solid dots follow a selected state, hollow dots follow the United States. Moving outward advances time; color and marker area encode price.

All three share sector, state, quarter, timeline playback, state rankings, historical detail, CSV download, and shareable URLs. Desktop and mobile layouts include keyboard controls and reduced-motion support.

## Run locally

Requires Node.js 22.12 or later. In PowerShell:

```powershell
Set-Location -LiteralPath 'E:\Development\Projects\Electricity Map'
npm install
npm run dev
```

Open **http://127.0.0.1:4187**. Vite proxies `/api` to the Node service at `127.0.0.1:3001`. Both services run in one process and stop together. Frontend edits use Vite hot reload; restart `npm run dev` for backend or snapshot changes.

For a production build:

```powershell
npm run build
npm start
```

Node serves both the built app and API at **http://127.0.0.1:3001**. The host defaults to loopback. Set `HOST` and `PORT` in `.env` for another environment.

## Data and provenance

Source: [the original EIA Electricity Data Browser](https://www.eia.gov/electricity/data/browser/#/topic/7?agg=1,0&geo=g0fvvvvvvvvvo&endsec=8&linechart=ELEC.PRICE.US-RES.Q&freq=Q). The original link selects `ELEC.PRICE.US-RES.Q`: U.S. residential average retail electricity price, quarterly.

The bundled snapshot was fetched November 3, 2026 UTC. It contains **9,568 observations**, **46 quarters** (2015 Q1–2026 Q2), **50 states + DC + a separate U.S. total**, and four sectors: residential, commercial, industrial, and all sectors. It is a dated snapshot, not a live transmission-grid feed. `data/electricity.json` records the exact fetch time, source, units, and unrounded observations.

Prices are **nominal cents/kWh**. EIA supplies quarterly prices directly; this app does not average monthly prices or state prices to obtain national figures. EIA sales are million kWh, displayed as TWh by dividing by 1,000. Revenue is million dollars. Missing observations remain `null` and display as unavailable, never zero. Regional aggregates are excluded from state visuals.

The fixed color scale runs from 5 to 50¢/kWh; values outside it saturate. Atlas elevation and constellation distance are capped, with exact values always available in details. Constellation connectors are visual guides, not electrical transmission lines. Geography is Albers USA from [us-atlas](https://github.com/topojson/us-atlas), with repositioned Alaska and Hawaii. Small states and DC can be selected from the state dropdown or rankings.

## Update the snapshot

```powershell
Copy-Item -LiteralPath '.env.example' -Destination '.env'
# Optional: set EIA_API_KEY in .env to your own registered EIA key.
npm run data:refresh
```

The public `DEMO_KEY` works within EIA's demo limits; a personal [EIA API key](https://www.eia.gov/opendata/register.php) is optional. Keys stay in the ignored `.env` file and never enter the browser bundle. Refresh fetches all pages, validates every sector/quarter for 52 geographies, and replaces the snapshot only after the entire fetch succeeds. Restart Node after refreshing. Upstream failures preserve the previous snapshot.

[EIA API documentation](https://www.eia.gov/opendata/documentation.php) describes the `electricity/retail-sales` dataset and quarterly frequency.

## Validation

```powershell
npm run check
npm test
npm run build
npm run test:ui
```

UI tests use installed Google Chrome through Playwright and serve the production build on port 3187. They cover all views, state/sector/quarter selection, playback, URL restoration, rankings, source notes, CSV contents, error recovery, and desktop/mobile overflow.

## Project layout

```text
src/                 SolidJS application and SVG visualizations
src/assets/          Bundled geographic topology
server/              Node HTTP server, EIA adapter and validation
scripts/             Development runner and snapshot refresh
data/                Reproducible EIA snapshot
tests/               Data, HTTP and browser checks
```

Repository: [Cujuju/electricity-map](https://github.com/Cujuju/electricity-map) (private). Follow-up work is tracked in GitHub Issues.
