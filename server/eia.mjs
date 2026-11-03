export const SECTORS = ['RES', 'COM', 'IND', 'ALL'];
export const STATE_IDS = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY US'.split(
    ' ',
  ),
);
export const SOURCE_URL =
  'https://www.eia.gov/electricity/data/browser/#/topic/7?agg=1,0&geo=g0fvvvvvvvvvo&endsec=8&linechart=ELEC.PRICE.US-RES.Q&freq=Q';

/** Missing EIA values must stay missing, never coerce null/empty to zero. */
export function numeric(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function normalizeRows(raw) {
  const rows = new Map();
  for (const row of raw) {
    if (
      !STATE_IDS.has(row.stateid) ||
      !SECTORS.includes(row.sectorid) ||
      !/^\d{4}-Q[1-4]$/.test(row.period)
    )
      continue;
    const key = `${row.period}:${row.stateid}:${row.sectorid}`;
    if (rows.has(key)) throw new Error(`Duplicate EIA observation: ${key}`);
    rows.set(key, {
      period: row.period,
      state: row.stateid,
      sector: row.sectorid,
      price: numeric(row.price),
      sales: numeric(row.sales),
      revenue: numeric(row.revenue),
    });
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.period.localeCompare(b.period) ||
      a.sector.localeCompare(b.sector) ||
      a.state.localeCompare(b.state),
  );
}

export function validateDataset(dataset) {
  if (dataset.schemaVersion !== 1 || !Array.isArray(dataset.rows) || dataset.rows.length === 0)
    throw new Error('Invalid or empty EIA snapshot');
  const periods = [...new Set(dataset.rows.map((row) => row.period))].sort();
  const keys = new Set();
  for (const row of dataset.rows) {
    const key = `${row.period}:${row.state}:${row.sector}`;
    if (
      !/^\d{4}-Q[1-4]$/.test(row.period) ||
      !STATE_IDS.has(row.state) ||
      !SECTORS.includes(row.sector) ||
      keys.has(key)
    )
      throw new Error(`Invalid or duplicate observation: ${key}`);
    keys.add(key);
    for (const field of ['price', 'sales', 'revenue']) {
      if (
        row[field] !== null &&
        (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0)
      )
        throw new Error(`Invalid ${field} in ${key}`);
    }
  }
  for (const sector of SECTORS) {
    for (const period of periods) {
      const records = dataset.rows.filter((row) => row.period === period && row.sector === sector);
      if (
        records.length !== STATE_IDS.size ||
        !records.some((row) => row.state === 'US' && row.price !== null)
      )
        throw new Error(`Incomplete EIA quarter: ${sector}/${period}`);
    }
  }
  return periods;
}

export async function fetchSector(sector, { apiKey = 'DEMO_KEY', fetcher = fetch } = {}) {
  const rows = [];
  let total = Infinity;
  do {
    const query = new URLSearchParams({
      api_key: apiKey,
      frequency: 'quarterly',
      'data[0]': 'price',
      'data[1]': 'sales',
      'data[2]': 'revenue',
      'facets[sectorid][]': sector,
      start: '2015-Q1',
      'sort[0][column]': 'period',
      'sort[0][direction]': 'desc',
      'sort[1][column]': 'stateid',
      'sort[1][direction]': 'asc',
      offset: String(rows.length),
      length: '5000',
    });
    const response = await fetcher(
      `https://api.eia.gov/v2/electricity/retail-sales/data/?${query}`,
      { signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok) throw new Error(`EIA returned HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error || !Array.isArray(payload.response?.data))
      throw new Error('EIA returned an invalid response');
    total = Number(payload.response.total);
    if (
      !Number.isInteger(total) ||
      total < 1 ||
      (payload.response.data.length === 0 && rows.length < total)
    )
      throw new Error('EIA pagination ended before all observations arrived');
    rows.push(...payload.response.data);
  } while (rows.length < total);
  return rows;
}
