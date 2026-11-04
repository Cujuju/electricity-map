import { writeFile, rename } from 'node:fs/promises';
import {
  fetchSector,
  normalizeRows,
  validateMonthlyDataset,
  SECTORS,
  SOURCE_URL,
} from '../server/eia.mjs';
const raw = [];
for (const sector of SECTORS) {
  console.log(`Fetching monthly ${sector}, with customers…`);
  raw.push(
    ...(await fetchSector(sector, {
      frequency: 'monthly',
      apiKey: process.env.EIA_API_KEY || 'DEMO_KEY',
    })),
  );
}
const dataset = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  source: {
    name: 'U.S. Energy Information Administration',
    url: SOURCE_URL,
    api: 'https://api.eia.gov/v2/electricity/retail-sales/data/',
    frequency: 'monthly',
    priceUnit: 'cents per kilowatt-hour',
    salesUnit: 'million kilowatt hours',
    revenueUnit: 'million dollars',
    customersUnit: 'number of customers',
  },
  rows: normalizeRows(raw, { frequency: 'monthly' }),
};
const periods = validateMonthlyDataset(dataset);
const path = new URL('../data/monthly.json', import.meta.url);
await writeFile(new URL('../data/monthly.json.tmp', import.meta.url), JSON.stringify(dataset));
await rename(new URL('../data/monthly.json.tmp', import.meta.url), path);
console.log(`Saved ${dataset.rows.length} monthly observations: ${periods[0]} – ${periods.at(-1)}`);
