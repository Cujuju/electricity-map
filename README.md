# Electricity Map

U.S. retail electricity prices from EIA, as an Electron desktop app and a public website: **https://map.cujuju.foo**. Built with SolidJS, TypeScript, Vite, Electron and Node.js.

## What's in it

- **Observatory** with three lenses: a raised price **atlas**, a radial **constellation** (distance = price, area = sales) and a **time machine** spiral through quarterly history.
- **Design Lab**: ten more complete dashboards (`design=solar|brutalist|arcade|blueprint|thermal|cosmic|analog|candy|tidal|press`). Switching keeps state, sector and quarter.
- **Change Lab** (`lab=changes`): monthly prices since 2015, compared year over year, month over month or against a chosen baseline. Includes a change atlas, a state-by-month heatmap, turning points, per-customer costs and a price/volume decomposition of spending.
- **Local Utilities** (`lab=utilities`): about 24,000 EIA-861 utility records (2023–2025), searchable by name, ID or county.

Everything has shareable URLs, CSV export, keyboard controls and mobile layouts. Example: `/?design=arcade&state=CA&sector=RES&period=2026-Q2`.

## Run locally

Requires Node.js 22.18+.

```sh
npm install
npm run dev          # desktop app with hot reload (Vite on 4187)
npm run dev:web      # browser mode (Vite 4187, API 3001)
npm run build && npm start      # production desktop app
npm run start:web               # production web server
```

## Test

```sh
npm run check        # TypeScript
npm test             # data, calculations, HTTP
npm run test:ui      # Playwright (Chrome, or PLAYWRIGHT_BUNDLED_CHROMIUM=1)
npm run test:desktop # real Electron with isolated profiles
npm run ci:local     # everything a PR needs, including UI tests against the Pages build
```

GitHub Actions is not used (workflows are manual-only). Run `npm run ci:local` before merging.

## Data

Snapshots in `data/` come from the EIA API and EIA-861 archives: quarterly prices (`electricity.json`), monthly prices and customer counts (`monthly.json`) and annual utilities (`utilities.json`). Each records its source and `fetchedAt`.

```sh
npm run data:refresh   # or :quarterly, :monthly, :utilities
```

Set `EIA_API_KEY` in `.env` (copy `.env.example`). Without it, the rate-limited `DEMO_KEY` is used. Each file is validated and replaced atomically; a failed fetch leaves it intact.

Prices are nominal cents/kWh, sales million kWh and revenue million dollars. Missing values stay missing, never zero. Utility prices are utility/state averages, not city or tariff prices. See `AGENTS.md` for the full data contracts.

## Website (Cloudflare Pages)

The site is fully static. `npm run build:pages` writes `dist-pages/`: the Vite build, the snapshots as `/api/*.json` (rewritten from `/api/*` by `_redirects`), headers and CSP in `_headers`, and a small Function for unknown API routes. `electricity-map.pages.dev` also works but is marked `noindex`.

```sh
npm run build:pages && npm run pages:dev   # preview at http://127.0.0.1:8788
```

**Deploying.** Merges to `main` do not deploy. To publish `main` now:

```sh
npm run release:weekly -- --force
```

This fetches `origin/main` into its own clone, refreshes EIA data, runs all checks and tests, and deploys. It works from any checkout. `npm run release` does the same in the current checkout, which needs `npm install` first.

**Weekly refresh.** T3 Code scheduled tasks run `scripts/local-deploy/runner.mjs` from `origin/main` on Mondays: the Mac at 09:00 and the AMD Windows box at 13:00. A run skips if the live data is under six days old, so the first machine on does the release. Failed tests stop a release, and the site keeps its last good deployment. Refreshed data is deployed but not committed.

**Secrets.** The scripts read `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` and `EIA_API_KEY` from, in order:

1. environment variables;
2. `secrets.env` in the deploy folder (`~/Library/Application Support/Electricity Map Deploy` or `%LOCALAPPDATA%\Electricity Map Deploy`);
3. the macOS Keychain, service `electricity-map-deploy`:

   ```sh
   security add-generic-password -U -s electricity-map-deploy -a CLOUDFLARE_API_TOKEN -w
   ```

The Cloudflare token needs Pages Edit and Account Settings Read, plus DNS Edit on `cujuju.foo` only to manage the custom domain.

## Desktop app

The renderer is sandboxed, with context isolation, a sender-validated bridge and a CSP. A bundled Node service on a free loopback port serves the snapshots, so the app works offline. Window state and filters are restored at launch. Share links use `electricity-map://open?...`. The toolbar's **App icon** switches between blue and purple (default); `npm run icons` regenerates all icon sizes.

```sh
npm run package:dir   # unpacked app in release/
npm run package       # Windows installer and portable exe (unsigned)
```

Windows x64 is tested; the macOS and Linux targets are configured but unverified.

## Layout

```text
src/            SolidJS app; designs/, analytics/ and desktop/ subfolders
desktop/        Electron main process and preload
server/         Node HTTP server, EIA adapters, validation
scripts/        dev runner, data refresh, Pages build and release
functions/      Cloudflare Pages Function
data/           EIA snapshots
tests/          unit, HTTP, UI and desktop tests
```

Private repository [Cujuju/electricity-map](https://github.com/Cujuju/electricity-map). Follow-up work is tracked in GitHub Issues.
