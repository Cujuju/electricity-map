import type { MonthlyObservation, Metric } from './types';
import type { Sector } from '../types';

export const METRICS: { id: Metric; name: string; unit: string; diverging: boolean }[] = [
  { id: 'change', name: 'Price change (%)', unit: '%', diverging: true },
  { id: 'delta', name: 'Price change (¢/kWh)', unit: '¢/kWh', diverging: true },
  { id: 'price', name: 'Average price', unit: '¢/kWh', diverging: false },
  { id: 'costChange', name: 'Cost change at chosen usage', unit: '$', diverging: true },
  { id: 'cost', name: 'Cost at chosen usage', unit: '$', diverging: false },
  { id: 'usage', name: 'kWh per customer', unit: 'kWh/account', diverging: false },
  { id: 'spending', name: 'Spending per customer', unit: '$/account', diverging: false },
  { id: 'salesChange', name: 'Electricity sold change', unit: '%', diverging: true },
  { id: 'gap', name: 'Price gap versus U.S.', unit: '%', diverging: true },
];
export const delta = (now: number | null | undefined, then: number | null | undefined) =>
  now == null || then == null ? null : now - then;
export const pct = (now: number | null | undefined, then: number | null | undefined) =>
  now == null || then == null || then <= 0 ? null : (now / then - 1) * 100;
export const monthNumber = (period: string) =>
  Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
export function offsetMonth(period: string, offset: number) {
  const n = monthNumber(period) + offset;
  return `${Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, '0')}`;
}
export const monthLabel = (period: string) =>
  /^\d{4}-\d{2}$/.test(period)
    ? new Date(Number(period.slice(0, 4)), Number(period.slice(5)) - 1, 15).toLocaleDateString(
        'en-US',
        { month: 'short', year: 'numeric' },
      )
    : '—';
export const display = (value: number | null | undefined, digits = 1) =>
  value == null || !Number.isFinite(value)
    ? '—'
    : value.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      });
export const signedValue = (value: number | null | undefined, digits = 1) =>
  value == null ? '—' : `${value > 0 ? '+' : ''}${display(value, digits)}`;
export const perCustomer = (
  total: number | null | undefined,
  customers: number | null | undefined,
) => (total == null || customers == null || customers <= 0 ? null : (total * 1e6) / customers);
export const cost = (price: number | null | undefined, kwh: number) =>
  price == null ? null : (price * kwh) / 100;
export const indexMonthly = (rows: MonthlyObservation[]) =>
  new Map(rows.map((row) => [`${row.sector}:${row.period}:${row.state}`, row]));
export const getMonth = (
  index: Map<string, MonthlyObservation>,
  sector: Sector,
  month: string,
  state: string,
) => index.get(`${sector}:${month}:${state}`);
export function metricValue(
  metric: Metric,
  now: MonthlyObservation | undefined,
  before: MonthlyObservation | undefined,
  us: MonthlyObservation | undefined,
  kwh: number,
) {
  switch (metric) {
    case 'price':
      return now?.price ?? null;
    case 'change':
      return pct(now?.price, before?.price);
    case 'delta':
      return delta(now?.price, before?.price);
    case 'cost':
      return cost(now?.price, kwh);
    case 'costChange':
      return cost(delta(now?.price, before?.price), kwh);
    case 'usage':
      return perCustomer(now?.sales, now?.customers);
    case 'spending':
      return perCustomer(now?.revenue, now?.customers);
    case 'salesChange':
      return pct(now?.sales, before?.sales);
    case 'gap':
      return pct(now?.price, us?.price);
  }
}
export function historyStats(rows: MonthlyObservation[], until: string) {
  const history = rows
    .filter((row) => row.period <= until)
    .sort((a, b) => a.period.localeCompare(b.period));
  const valid = history.filter(
    (row): row is MonthlyObservation & { price: number } => row.price !== null,
  );
  const changes = history.flatMap((row, i) => {
    const before = history[i - 1];
    const change =
      before && monthNumber(row.period) - monthNumber(before.period) === 1
        ? delta(row.price, before.price)
        : null;
    return change === null
      ? []
      : [{ period: row.period, delta: change, pct: pct(row.price, before.price) }];
  });
  const biggestRise = changes
    .filter((row) => row.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.period.localeCompare(b.period))[0];
  const biggestDrop = changes
    .filter((row) => row.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.period.localeCompare(b.period))[0];
  let streak = 0;
  let direction = 0;
  for (let i = history.length - 1; i > 0; i--) {
    const change =
      monthNumber(history[i].period) - monthNumber(history[i - 1].period) === 1
        ? delta(history[i].price, history[i - 1].price)
        : null;
    if (change === null || change === 0) break;
    const sign = Math.sign(change);
    if (direction && direction !== sign) break;
    direction = sign;
    streak++;
  }
  const byMonth = new Map(history.map((row) => [row.period, row]));
  const yoy = history
    .filter((row) => monthNumber(until) - monthNumber(row.period) < 36)
    .map((row) => pct(row.price, byMonth.get(offsetMonth(row.period, -12))?.price))
    .filter((value): value is number => value !== null);
  const mean = yoy.length ? yoy.reduce((a, b) => a + b, 0) / yoy.length : null;
  const volatility =
    yoy.length > 1
      ? Math.sqrt(yoy.reduce((sum, value) => sum + (value - mean!) ** 2, 0) / (yoy.length - 1))
      : null;
  const now = byMonth.get(until);
  const previous = byMonth.get(offsetMonth(until, -1));
  const acceleration = delta(
    pct(now?.price, byMonth.get(offsetMonth(until, -12))?.price),
    pct(previous?.price, byMonth.get(offsetMonth(until, -13))?.price),
  );
  return {
    biggestRise,
    biggestDrop,
    streak,
    direction,
    volatility,
    acceleration,
    high: valid.reduce<(typeof valid)[number] | undefined>(
      (best, row) => (!best || row.price > best.price ? row : best),
      undefined,
    ),
    low: valid.reduce<(typeof valid)[number] | undefined>(
      (best, row) => (!best || row.price < best.price ? row : best),
      undefined,
    ),
  };
}
export function priceRank(rows: (MonthlyObservation | undefined)[], state: string) {
  const selected = rows.find((row) => row?.state === state);
  return selected?.price == null
    ? null
    : 1 + rows.filter((row) => row?.price != null && row.price > selected.price!).length;
}
export function cagr(
  now: number | null | undefined,
  before: number | null | undefined,
  months: number,
) {
  return now == null || before == null || before <= 0 || months <= 0
    ? null
    : ((now / before) ** (12 / months) - 1) * 100;
}
/** Symmetric midpoint decomposition; residual is upstream EIA price rounding. */
export function spendingDrivers(
  now: MonthlyObservation | undefined,
  before: MonthlyObservation | undefined,
) {
  if (
    !now ||
    !before ||
    now.price === null ||
    before.price === null ||
    now.sales === null ||
    before.sales === null
  )
    return null;
  const price = ((now.price - before.price) * (now.sales + before.sales)) / 2 / 100;
  const volume = ((now.sales - before.sales) * (now.price + before.price)) / 2 / 100;
  const reported = delta(now.revenue, before.revenue);
  return {
    price,
    volume,
    reported,
    residual: reported === null ? null : reported - price - volume,
  };
}
export function downloadAnalysis(rows: Record<string, string | number | null>[], name: string) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const text = [
    columns.join(','),
    ...rows.map((row) => columns.map((key) => escape(row[key])).join(',')),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
