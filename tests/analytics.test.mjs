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
import {
  aggregateYear,
  comparisonThrough,
  initialRange,
  periodLabel,
  reportedRuns,
} from '../src/analytics/periods.ts';
import { indexMonthly } from '../src/analytics/math.ts';
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

const months = (year, count, row) =>
  Array.from({ length: count }, (_, i) => ({
    ...base,
    period: `${year}-${String(i + 1).padStart(2, '0')}`,
    ...row(i),
  }));
test('calendar years weight price by sales, average accounts and require every month', () => {
  // Jan: 10 cents on 100 million kWh; Feb: 20 cents on 300. Weighted 17.5, not the 15 mean.
  const rows = months(2025, 2, (i) => ({
    price: [10, 20][i],
    sales: [100, 300][i],
    revenue: [10, 60][i],
    customers: [1000, 3000][i],
  }));
  const year = aggregateYear(indexMonthly(rows), 'RES', 'CA', '2025', 2);
  assert.equal(year.price, 17.5);
  assert.equal(year.sales, 400);
  assert.equal(year.revenue, 70);
  assert.equal(year.customers, 2000);
  const gap = aggregateYear(indexMonthly(rows.slice(1)), 'RES', 'CA', '2025', 2);
  assert.equal(gap.price, null);
  assert.equal(gap.sales, null);
  const withheld = aggregateYear(
    indexMonthly(rows.map((row, i) => (i ? { ...row, revenue: null } : row))),
    'RES',
    'CA',
    '2025',
    2,
  );
  assert.equal(withheld.price, null);
  assert.equal(withheld.sales, 400);
  assert.equal(aggregateYear(indexMonthly(rows), 'RES', 'TX', '2025', 2), undefined);
});
test('a partial final year compares year-to-date windows of equal length', () => {
  const data = ['2024-12', '2025-01', '2025-08'];
  assert.equal(comparisonThrough('2025', data), 8);
  assert.equal(comparisonThrough('2024', data), 12);
  assert.equal(comparisonThrough('2025-08', data), 12);
  assert.equal(periodLabel('2025', 8), 'Jan–Aug 2025');
  assert.equal(periodLabel('2024', 12), '2024');
});
test('range links read from/to and still honor legacy compare links', () => {
  const all = ['2025-06', '2025-07', '2025-08', '2026-07', '2026-08'];
  const range = (search, grain = 'month', periods = all) =>
    initialRange(new URLSearchParams(search), grain, periods);
  assert.deepEqual(range(''), { to: '2026-08', gap: 12 });
  assert.deepEqual(range('to=2026-07&from=2025-06'), { to: '2026-07', gap: 13 });
  assert.deepEqual(range('month=2026-07&compare=month'), { to: '2026-07', gap: 1 });
  assert.deepEqual(range('month=2026-08&compare=custom&since=2025-07'), { to: '2026-08', gap: 13 });
  assert.deepEqual(range('compare=start'), { to: '2026-08', gap: 14 });
  // A From that is not earlier, or of the other grain, falls back to one year back.
  assert.deepEqual(range('from=2026-08'), { to: '2026-08', gap: 12 });
  assert.deepEqual(range('grain=year&from=2025', 'year', ['2024', '2025', '2026']), {
    to: '2026',
    gap: 1,
  });
  assert.deepEqual(range('month=2026-07&from=2015-01', 'year', ['2015', '2026']), {
    to: '2026',
    gap: 1,
  });
});

test('history runs break at missing prices and skipped months, never bridging them', () => {
  const row = (period, price) => ({ ...base, period, price });
  const runs = reportedRuns([
    row('2016-06', 20),
    row('2016-07', 21),
    row('2016-08', null),
    row('2016-09', null),
    row('2016-10', 22),
    row('2016-12', 23),
  ]);
  assert.deepEqual(
    runs.map((run) => run.map((item) => item.period)),
    [['2016-06', '2016-07'], ['2016-10'], ['2016-12']],
  );
  assert.deepEqual(reportedRuns([row('2016-01', null)]), []);
});
