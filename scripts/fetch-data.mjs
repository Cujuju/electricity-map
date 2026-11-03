import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  fetchSector,
  normalizeRows,
  validateDataset,
  SECTORS,
  SOURCE_URL,
} from '../server/eia.mjs';

const observations = [];
for (const sector of SECTORS) {
  console.log(`Fetching ${sector} from EIA…`);
  observations.push(
    ...(await fetchSector(sector, { apiKey: process.env.EIA_API_KEY || 'DEMO_KEY' })),
  );
}
const dataset = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  source: {
    name: 'U.S. Energy Information Administration',
    url: SOURCE_URL,
    api: 'https://api.eia.gov/v2/electricity/retail-sales/data/',
    frequency: 'quarterly',
    priceUnit: 'cents per kilowatt-hour',
    salesUnit: 'million kilowatt hours',
    revenueUnit: 'million dollars',
  },
  rows: normalizeRows(observations),
};
const periods = validateDataset(dataset);
const directory = fileURLToPath(new URL('../data/', import.meta.url));
await mkdir(directory, { recursive: true });
const path = fileURLToPath(new URL('../data/electricity.json', import.meta.url));
await writeFile(`${path}.tmp`, JSON.stringify(dataset));
await rename(`${path}.tmp`, path);
console.log(`Saved ${dataset.rows.length} observations, ${periods[0]} – ${periods.at(-1)}.`);
