# Electricity Map

SolidJS + TypeScript frontend, Vite build, and a Node.js HTTP/data service.

The original Observatory contains three lenses. `src/designs/` contains ten additional complete dashboard designs, selected through Design Lab or the `design` URL parameter. Keep filters, selected state, quarter and original lens intact when changing designs. Design-specific CSS is scoped under `.skin-…` to preserve the original application.

## Commands

- `npm run dev`: Node API at 127.0.0.1:3001 and Vite at 127.0.0.1:4187.
- `npm run check`: TypeScript checking.
- `npm test`: data transformation, provenance, and HTTP integration tests.
- `npm run test:ui`: Playwright interaction and responsive checks.
- `npm run build` then `npm start`: production build served by Node.
- `npm run data:refresh`: fetch all four sectors from EIA; atomically replace the bundled snapshot only after validation.

## Data contracts

Never invent observations or replace missing values with zero. Preserve EIA's U.S. total rather than averaging state prices. Quarterly prices are supplied by EIA, not averages of monthly prices. Sales are million kWh; prices are cents/kWh; revenue is million dollars. State visuals include 50 states and DC; U.S. totals are separate. Color, height, radial distance, and time encodings must be explained in the UI.

## Task tracking

GitHub Issues: https://github.com/Cujuju/electricity-map/issues (repository `Cujuju/electricity-map`). Use one `area/…` bucket label per issue and `arc/…` for concrete active work threads. Create Issues for durable follow-up work. Do not use Todoist for this project.
