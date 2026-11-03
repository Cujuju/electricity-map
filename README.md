# Electricity Map

A different kind of current. An original three-view observatory plus **ten additional dashboard designs**, all using real U.S. electricity prices. Built with **SolidJS, TypeScript, Vite, and Node.js**.

- **Electric atlas** — a raised geographic map. State elevation and color encode electricity price; switch between relief and flat geography.
- **Price constellation** — a radial constellation of states. More expensive electricity sits farther from the center; bubble area increases with electricity sales. Census regions determine ordering.
- **Time machine** — a spiral through quarterly history. Solid dots follow a selected state, hollow dots follow the United States. Moving outward advances time; color and marker area encode price.

All three share sector, state, quarter, timeline playback, state rankings, historical detail, CSV download, and shareable URLs. Desktop and mobile layouts include keyboard controls and reduced-motion support.

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

The original Observatory color scale runs from 5 to 50¢/kWh; values outside it saturate. Atlas elevation and constellation distance are capped, with exact values always available in details. The ten new dashboards share a price scale that starts at zero and ends at at least 60¢/kWh, expanded to cover the entire loaded snapshot rather than rescaled by quarter. Dark Matter omits observations without valid sales or price from its scatter plot and reports how many were omitted. History lines break at missing prices. Calendar cells display unavailable observations as gray with an em dash.

Constellation connectors are visual guides, not electrical transmission lines. Geography is Albers USA from [us-atlas](https://github.com/topojson/us-atlas), with repositioned Alaska and Hawaii. Field Control uses an explicitly approximate tile map. Small states and DC can be selected from the state dropdown or rankings.

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

UI tests use installed Google Chrome through Playwright and serve the production build on port 3187. They cover the original views and all ten dashboards, chart keyboard interactions, state/sector/quarter selection, playback, URL restoration, switching designs, rankings, source notes, CSV contents, missing data, error recovery, and desktop/mobile overflow. Screenshots of every design are written under the ignored test-results directory.

## Project layout

```text
src/                 SolidJS application and SVG visualizations
src/assets/          Bundled geographic topology
src/designs/         Ten dashboard designs, chart components, catalog and Design Lab
server/              Node HTTP server, EIA adapter and validation
scripts/             Development runner and snapshot refresh
data/                Reproducible EIA snapshot
tests/               Data, HTTP and browser checks
```

Repository: [Cujuju/electricity-map](https://github.com/Cujuju/electricity-map) (private). Follow-up work is tracked in GitHub Issues.
