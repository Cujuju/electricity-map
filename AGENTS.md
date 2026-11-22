# Electricity Map

SolidJS + TypeScript frontend, Electron desktop shell, Vite build, and a Node.js HTTP/data service. Desktop code is under `desktop/` and `src/desktop/`; browser mode remains supported.

The original Observatory contains three lenses. `src/designs/` contains ten additional complete dashboard designs, selected through Design Lab or the `design` URL parameter. Keep filters, selected state, quarter and original lens intact when changing designs. Design-specific CSS is scoped under `.skin-…` to preserve the original application.

`src/analytics/` adds Change Lab (`lab=changes`) and Local Utilities (`lab=utilities`) across all themes. These use monthly and annual data respectively. State/sector remain shared; monthly dates and annual utility years are separate from the original quarterly selection. Preserve unfamiliar query parameters when updating a workspace's own URL state.

## Commands

- `npm run dev`: Electron Dev app, Vite at 4187 and a managed Node API on a free loopback port. `npm run dev:web` runs the original browser/API development mode.
- `npm run check`: TypeScript checking.
- `npm test`: data transformation, provenance, and HTTP integration tests.
- `npm run test:ui`: Playwright interaction and responsive checks.
- `npm run build` then `npm start`: production desktop app. `npm run start:web`: production Node web server.
- `npm run test:desktop`: real Electron tests with isolated profiles. `ELECTRICITY_MAP_EXECUTABLE` selects a packaged binary.
- `npm run package:dir` / `npm run package`: unpacked desktop app / installers in ignored `release/`.
- `npm run data:refresh`: sequential quarterly, monthly and annual utility updates. Each file is replaced atomically after its own validation. Individual refresh commands have `:quarterly`, `:monthly`, and `:utilities` suffixes.
- `npm run ci:local`: full pre-merge check (types, unit tests, Pages build, UI tests against the Node server and `wrangler pages dev`). GitHub Actions is not used.

## Deploying the website

https://map.cujuju.foo is a static Cloudflare Pages site (project `electricity-map`). Merging to `main` does not deploy it. To update Cloudflare ("deploy", "release", "push to Cloudflare"), run from any checkout of this repo:

```sh
npm run release:weekly -- --force
```

It clones `origin/main` into its own folder, installs dependencies, refreshes EIA data, runs all checks and tests, and deploys. Secrets come from the macOS Keychain (service `electricity-map-deploy`) or `secrets.env` in the deploy folder; never ask for them in chat. Success ends with `RESULT: released <sha>`. Then confirm with `curl https://map.cujuju.foo/api/health`. Only unmerged code needs `npm run release` in a worktree with `node_modules`. Weekly T3 scheduled tasks run the same command without `--force`.

## Data contracts

Desktop contracts: keep the renderer sandboxed, Node integration off and context isolation on. Validate IPC sender/frame/origin. Allow external HTTP(S) links only through the system browser. App links use `electricity-map://open` with a bounded whitelist of query parameters. Keep production/development profiles and app identities separate. The desktop Node service binds loopback on a free port and stops with Electron. Do not reuse Spillway credentials, identity, update feed or signing keys.

Never invent observations or replace missing values with zero. Preserve EIA's U.S. total rather than averaging state prices. Quarterly prices are supplied by EIA, not averages of monthly prices. Sales are million kWh; prices are cents/kWh; revenue is million dollars. State visuals include 50 states and DC; U.S. totals are separate. Color, height, radial distance, and time encodings must be explained in the UI.

Monthly customer values are account counts, not population. Per-account usage and spending must use the correct million-unit conversion. Fixed-usage costs are illustrative, not tariff quotes. Missing months break historical calculations. Price/volume spending decomposition is accounting, not causation.

Annual utility prices are utility/state averages derived from EIA-861 revenue and sales. Keep bundled, energy-only, delivery-only and short-form services distinct. The directory includes bundled service plus separately labeled ALL-sector short-form totals. Latest-year county equipment-presence lists are not city prices, address service guarantees or historical territory boundaries. Label annual and monthly reporting periods separately.

## Task tracking

GitHub Issues: https://github.com/Cujuju/electricity-map/issues (repository `Cujuju/electricity-map`). Use one `area/…` bucket label per issue and `arc/…` for concrete active work threads. Create Issues for durable follow-up work. Do not use Todoist for this project.
