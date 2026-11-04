import { SECTORS, STATE_IDS } from './eia.mjs';
export function validateUtilities(dataset) {
  if (
    dataset.schemaVersion !== 1 ||
    !Array.isArray(dataset.records) ||
    dataset.records.length < 100 ||
    !Array.isArray(dataset.years) ||
    !dataset.territories
  )
    throw new Error('Invalid utility snapshot');
  const keys = new Set();
  for (const row of dataset.records) {
    const key = `${row.year}:${row.id}:${row.state}:${row.sector}:${row.service}`;
    if (
      !dataset.years.includes(row.year) ||
      !STATE_IDS.has(row.state) ||
      row.state === 'US' ||
      !SECTORS.includes(row.sector) ||
      keys.has(key)
    )
      throw new Error(`Invalid or duplicate utility row: ${key}`);
    keys.add(key);
    for (const field of ['price', 'sales', 'revenue', 'customers'])
      if (row[field] !== null && (!Number.isFinite(row[field]) || row[field] < 0))
        throw new Error(`Invalid utility ${field}: ${key}`);
    if (
      row.price !== null &&
      row.sales > 0 &&
      Math.abs(row.price - (row.revenue / row.sales) * 100) > 0.000001
    )
      throw new Error(`Utility units do not reconcile: ${key}`);
  }
  for (const year of dataset.years)
    if (!dataset.records.some((row) => row.year === year && row.sector === 'RES'))
      throw new Error(`No residential utility data: ${year}`);
  return dataset.years;
}
