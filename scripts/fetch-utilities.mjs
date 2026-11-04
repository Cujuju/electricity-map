import { mkdir, writeFile, rename } from 'node:fs/promises';
import { unzipSync } from 'fflate';
import { readSheet } from 'read-excel-file/node';
import { numeric, STATE_IDS } from '../server/eia.mjs';
import { validateUtilities } from '../server/utilities.mjs';

const source = 'https://www.eia.gov/electricity/data/eia861/';
const response = await fetch(source, { signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`EIA index returned ${response.status}`);
const html = await response.text();
const links = [...html.matchAll(/href="([^"]*f861(\d{4})\.zip)"/g)].map((match) => ({
  year: Number(match[2]),
  url: new URL(match[1], source).href,
}));
const archives = [
  ...new Map(links.sort((a, b) => b.year - a.year).map((item) => [item.year, item])).values(),
].slice(0, 3);
if (archives.length !== 3) throw new Error('Could not identify three EIA annual archives');
await mkdir(new URL('../.cache-eia/', import.meta.url), { recursive: true });
const records = [];
const territories = new Map();
for (const archive of archives) {
  console.log(`Reading EIA-861 ${archive.year}…`);
  const cache = new URL(`../.cache-eia/f861${archive.year}.zip`, import.meta.url);
  const res = await fetch(archive.url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Annual archive returned ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  await writeFile(cache, bytes);
  const files = unzipSync(bytes);
  const sheet = async (stem) => {
    const name = Object.keys(files).find(
      (name) => name.split('/').at(-1) === `${stem}_${archive.year}.xlsx`,
    );
    if (!name) throw new Error(`Missing ${stem} in ${archive.year}`);
    return readSheet(Buffer.from(files[name]));
  };
  const groups = new Map();
  function accumulate({
    id,
    name,
    state,
    sector,
    service,
    revenue,
    sales,
    customers,
    imputed,
    ownership,
  }) {
    id = String(id);
    if (
      !/^\d+$/.test(id) ||
      Number(id) >= 99990 ||
      !STATE_IDS.has(state) ||
      state === 'US' ||
      /adjustment|total electric/i.test(String(name))
    )
      return;
    const key = `${id}:${state}:${sector}:${service}`;
    const row = groups.get(key) ?? {
      year: archive.year,
      id,
      name: String(name),
      state,
      sector,
      service,
      ownership: String(ownership ?? ''),
      revenue: 0,
      sales: 0,
      customers: 0,
      imputed: false,
      missing: { revenue: false, sales: false, customers: false },
    };
    for (const [field, value] of Object.entries({
      revenue,
      sales,
      customers,
    })) {
      const n = numeric(value);
      if (n === null) row.missing[field] = true;
      else row[field] += n;
    }
    row.imputed ||= imputed;
    groups.set(key, row);
  }
  const sales = await sheet('Sales_Ult_Cust');
  for (const row of sales.slice(3)) {
    if (row[0] !== archive.year || row[4] !== 'Bundled') continue;
    for (const [sector, offset] of [
      ['RES', 9],
      ['COM', 12],
      ['IND', 15],
      ['ALL', 21],
    ])
      accumulate({
        id: row[1],
        name: row[2],
        state: row[6],
        sector,
        service: 'Bundled',
        revenue: row[offset],
        sales: row[offset + 1],
        customers: row[offset + 2],
        imputed: row[5] === 'I',
        ownership: row[7],
      });
  }
  const short = await sheet('Short_Form');
  for (const row of short.slice(1))
    if (row[0] === archive.year)
      accumulate({
        id: row[1],
        name: row[2],
        state: row[4],
        sector: 'ALL',
        service: 'Short form total',
        revenue: row[6],
        sales: row[7],
        customers: row[8],
        imputed: false,
        ownership: row[3],
      });
  for (const row of groups.values()) {
    const { missing, ...record } = row;
    for (const field of ['revenue', 'sales', 'customers']) if (missing[field]) record[field] = null;
    record.price =
      record.revenue !== null && record.sales > 0 ? (record.revenue / record.sales) * 100 : null;
    if (record.customers === 0 && record.sales === 0 && record.revenue === 0) continue;
    record.revenue = record.revenue === null ? null : record.revenue / 1000;
    record.sales = record.sales === null ? null : record.sales / 1000;
    records.push(record);
  }
  if (archive.year === archives[0].year)
    for (const row of (await sheet('Service_Territory')).slice(1)) {
      if (row[0] !== archive.year || !STATE_IDS.has(row[4]) || !row[5]) continue;
      const key = `${row[1]}:${row[4]}`;
      const counties = territories.get(key) ?? new Set();
      counties.add(String(row[5]));
      territories.set(key, counties);
    }
}
const dataset = {
  schemaVersion: 1,
  fetchedAt: new Date().toISOString(),
  source: {
    name: 'EIA-861 annual utility survey',
    url: source,
    archives,
    frequency: 'annual',
    priceUnit: 'cents per kilowatt-hour',
    salesUnit: 'million kilowatt hours',
    revenueUnit: 'million dollars',
    coverage:
      'Bundled service providers by sector; short-form providers in ALL only. County equipment presence is not a city price or an address-level service guarantee.',
  },
  years: archives.map((item) => item.year).sort(),
  territories: Object.fromEntries([...territories].map(([key, value]) => [key, [...value].sort()])),
  records: records.sort(
    (a, b) =>
      a.year - b.year ||
      a.state.localeCompare(b.state) ||
      a.name.localeCompare(b.name) ||
      a.sector.localeCompare(b.sector),
  ),
};
validateUtilities(dataset);
await writeFile(new URL('../data/utilities.json.tmp', import.meta.url), JSON.stringify(dataset));
await rename(
  new URL('../data/utilities.json.tmp', import.meta.url),
  new URL('../data/utilities.json', import.meta.url),
);
console.log(
  `Saved ${records.length} utility/sector/year observations, ${dataset.years.join(', ')}; ${territories.size} utility/state county lists.`,
);
