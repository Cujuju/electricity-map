import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  offsetMonth,
  monthNumber,
  pct,
  metricValue,
  perCustomer,
  historyStats,
  priceRank,
  cagr,
  spendingDrivers,
} from '../src/analytics/math.ts';
import { validateMonthlyDataset } from '../server/eia.mjs';
import { validateUtilities } from '../server/utilities.mjs';
const base = {
  period: '2025-01',
  state: 'CA',
  sector: 'RES',
  price: 10,
  sales: 10,
  revenue: 1,
  customers: 100000,
};
const now = { ...base, period: '2026-01', price: 20, sales: 20, revenue: 4 };
test('monthly comparison offsets cross years correctly and never use nearest missing observations', () => {
  assert.equal(offsetMonth('2026-01', -1), '2025-12');
  assert.equal(offsetMonth('2016-02', -12), '2015-02');
  assert.equal(monthNumber('2026-01') - monthNumber('2025-01'), 12);
  assert.equal(pct(20, 10), 100);
  assert.equal(pct(20, null), null);
  assert.equal(pct(20, 0), null);
});
test('price, customer and fixed-usage metrics preserve cents, million units and missing values', () => {
  assert.equal(metricValue('delta', now, base, now, 1000), 10);
  assert.equal(metricValue('cost', now, base, now, 1000), 200);
  assert.equal(metricValue('costChange', now, base, now, 1000), 100);
  assert.equal(metricValue('usage', now, base, now, 1000), 200);
  assert.equal(metricValue('spending', now, base, now, 1000), 40);
  assert.equal(metricValue('gap', now, base, { ...now, price: 10 }, 1000), 100);
  assert.equal(perCustomer(null, 100), null);
  assert.equal(perCustomer(1, 0), null);
});
test('historical shocks and streaks cannot jump across missing months', () => {
  const history = [
    base,
    { ...base, period: '2025-02', price: 12 },
    { ...base, period: '2025-03', price: null },
    { ...base, period: '2025-04', price: 20 },
  ];
  const result = historyStats(history, '2025-04');
  assert.equal(result.biggestRise.period, '2025-02');
  assert.equal(result.biggestRise.delta, 2);
  assert.equal(result.streak, 0);
  assert.equal(result.biggestDrop, undefined);
  assert.equal(result.high.period, '2025-04');
  assert.equal(result.low.period, '2025-01');
  assert.equal(
    historyStats([base, { ...base, period: '2025-03', price: 20 }], '2025-03').biggestRise,
    undefined,
  );
});
test('annualization and competition ranks have explicit time and tie semantics', () => {
  assert.ok(Math.abs(cagr(121, 100, 24) - 10) < 1e-9);
  assert.equal(cagr(20, 10, 0), null);
  const rows = [
    { ...base, state: 'CA', price: 20 },
    { ...base, state: 'HI', price: 20 },
    { ...base, state: 'TX', price: 10 },
    { ...base, state: 'AK', price: null },
  ];
  assert.equal(priceRank(rows, 'HI'), 1);
  assert.equal(priceRank(rows, 'TX'), 3);
  assert.equal(priceRank(rows, 'AK'), null);
});
test('midpoint spending decomposition reconciles with revenue without calling it causality', () => {
  const parts = spendingDrivers(now, base);
  assert.equal(parts.price, 1.5);
  assert.equal(parts.volume, 1.5);
  assert.equal(parts.reported, 3);
  assert.equal(parts.residual, 0);
  assert.equal(spendingDrivers({ ...now, sales: null }, base), null);
});
test('monthly snapshot includes every geography/sector with customers and correct monetary units', async () => {
  const data = JSON.parse(await readFile(new URL('../data/monthly.json', import.meta.url), 'utf8'));
  const periods = validateMonthlyDataset(data);
  assert.equal(data.rows.length, periods.length * 52 * 4);
  assert.equal(periods[0], '2015-01');
  assert.ok(periods.at(-1) >= '2026-08');
  assert.ok(data.rows.some((row) => row.customers > 100000));
  for (const row of data.rows)
    if (row.price !== null && row.sales > 1 && row.revenue !== null)
      assert.ok(
        Math.abs(row.price - (row.revenue / row.sales) * 100) < 0.025,
        `${row.state}/${row.period}/${row.sector}`,
      );
  assert.throws(
    () => validateMonthlyDataset({ ...data, rows: data.rows.slice(1) }),
    /Incomplete month/,
  );
  assert.throws(
    () =>
      validateMonthlyDataset({
        ...data,
        rows: data.rows.filter((row) => row.period !== '2020-01'),
      }),
    /Missing month/,
  );
});
test('utility snapshot is annual, preserves service boundaries and reconciles calculated prices', async () => {
  const data = JSON.parse(
    await readFile(new URL('../data/utilities.json', import.meta.url), 'utf8'),
  );
  validateUtilities(data);
  assert.ok(data.years.length >= 3);
  assert.ok(data.records.length > 20000);
  assert.ok(Object.keys(data.territories).length > 2000);
  assert.ok(data.source.coverage.includes('not a city price'));
  for (const row of data.records)
    if (row.service === 'Short form total') assert.equal(row.sector, 'ALL');
  assert.throws(
    () =>
      validateUtilities({
        ...data,
        records: [...data.records, data.records[0]],
      }),
    /duplicate/,
  );
});
