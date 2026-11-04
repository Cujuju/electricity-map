import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fetchSector, normalizeRows, numeric, validateDataset, STATE_IDS } from '../server/eia.mjs';

const dataset = JSON.parse(
  await readFile(new URL('../data/electricity.json', import.meta.url), 'utf8'),
);
const raw = {
  period: '2025-Q1',
  stateid: 'CA',
  sectorid: 'RES',
  price: '31.42',
  sales: '1234.56',
  revenue: '387.9',
};

test('EIA missing values remain null, including empty strings and sentinels', () => {
  for (const value of [null, undefined, '', ' ', 'NA', '--', 'w', Infinity, '-2'])
    assert.equal(numeric(value), null);
  assert.equal(numeric('0'), 0);
  assert.equal(numeric('31.42'), 31.42);
});
test('normalization removes regional aggregates without discarding DC or U.S. totals', () => {
  const rows = normalizeRows([
    raw,
    { ...raw, stateid: 'US' },
    { ...raw, stateid: 'DC' },
    { ...raw, stateid: 'NEW' },
    { ...raw, sectorid: 'TRA' },
  ]);
  assert.deepEqual(
    rows.map((row) => row.state),
    ['CA', 'DC', 'US'],
  );
  assert.equal(rows[0].price, 31.42);
  assert.equal(rows[0].sales, 1234.56);
  assert.throws(() => normalizeRows([raw, raw]), /Duplicate/);
});
test('snapshot has every state, DC and national total in every sector/quarter', () => {
  const periods = validateDataset(dataset);
  assert.equal(STATE_IDS.size, 52);
  assert.equal(dataset.rows.length, periods.length * 52 * 4);
  assert.equal(periods[0], '2015-Q1');
  assert.ok(!Number.isNaN(Date.parse(dataset.fetchedAt)));
  assert.equal(dataset.source.priceUnit, 'cents per kilowatt-hour');
  assert.equal(dataset.source.salesUnit, 'million kilowatt hours');
  assert.ok(dataset.source.api.startsWith('https://api.eia.gov/'));
});
test('reported prices reconcile with reported sales and revenue, allowing EIA rounding', () => {
  for (const row of dataset.rows) {
    if (row.price !== null && row.revenue !== null && row.sales > 1)
      assert.ok(
        Math.abs(row.price - (row.revenue / row.sales) * 100) < 0.025,
        `${row.period}/${row.state}/${row.sector}`,
      );
  }
});
test('incomplete quarters, duplicate rows and invalid numbers are rejected', () => {
  assert.throws(() => validateDataset({ ...dataset, rows: dataset.rows.slice(1) }), /Incomplete/);
  assert.throws(
    () => validateDataset({ ...dataset, rows: [...dataset.rows, dataset.rows[0]] }),
    /duplicate/,
  );
  assert.throws(
    () =>
      validateDataset({
        ...dataset,
        rows: [{ ...dataset.rows[0], price: -1 }, ...dataset.rows.slice(1)],
      }),
    /Invalid price/,
  );
});
test('EIA pagination retrieves all pages in deterministic order', async () => {
  const offsets = [];
  const rows = await fetchSector('RES', {
    fetcher: async (input) => {
      const query = new URL(input).searchParams;
      offsets.push(query.get('offset'));
      assert.equal(query.get('frequency'), 'quarterly');
      assert.equal(query.get('facets[sectorid][]'), 'RES');
      return Response.json({
        response: {
          total: '3',
          data: query.get('offset') === '0' ? [raw, raw] : [raw],
        },
      });
    },
  });
  assert.equal(rows.length, 3);
  assert.deepEqual(offsets, ['0', '2']);
});
test('EIA errors and premature pagination fail instead of publishing partial data', async () => {
  await assert.rejects(
    fetchSector('RES', {
      fetcher: async () => new Response('', { status: 429 }),
    }),
    /HTTP 429/,
  );
  await assert.rejects(
    fetchSector('RES', {
      fetcher: async () => Response.json({ error: 'rate limited' }),
    }),
    /invalid response/,
  );
  await assert.rejects(
    fetchSector('RES', {
      fetcher: async () => Response.json({ response: { total: '3', data: [] } }),
    }),
    /pagination/,
  );
});

test('monthly refresh requests customer counts and preserves missing monthly observations', async () => {
  const monthlyRaw = {
    ...raw,
    period: '2026-08',
    customers: '123456',
    price: 'NA',
  };
  const rows = await fetchSector('RES', {
    frequency: 'monthly',
    fetcher: async (input) => {
      const query = new URL(input).searchParams;
      assert.equal(query.get('frequency'), 'monthly');
      assert.equal(query.get('start'), '2015-01');
      assert.equal(query.get('data[3]'), 'customers');
      return Response.json({ response: { total: '1', data: [monthlyRaw] } });
    },
  });
  const [row] = normalizeRows(rows, { frequency: 'monthly' });
  assert.equal(row.period, '2026-08');
  assert.equal(row.customers, 123456);
  assert.equal(row.price, null);
});
