import type { Sector } from '../types';
import type { MonthlyObservation } from './types';
import { getMonth, monthLabel, monthNumber, offsetMonth } from './math.ts';

/** Comparison unit: one reported month, or a calendar year built from its months. */
export type Grain = 'month' | 'year';
export const MONTHS_PER_YEAR = 12;
/** Revenue (million USD) ÷ sales (million kWh) is USD/kWh; prices are cents/kWh. */
const CENTS_PER_DOLLAR = 100;
/** Default From: the same period one year earlier, which holds seasonality constant. */
export const DEFAULT_GAP: Record<Grain, number> = { month: MONTHS_PER_YEAR, year: 1 };
const MONTH_PERIOD = /^\d{4}-\d{2}$/;
const YEAR_PERIOD = /^\d{4}$/;

export const grainOf = (period: string): Grain | null =>
  MONTH_PERIOD.test(period) ? 'month' : YEAR_PERIOD.test(period) ? 'year' : null;
export const yearsOf = (months: string[]) => [...new Set(months.map((m) => m.slice(0, 4)))];
const pad = (month: number) => String(month).padStart(2, '0');

/** Months reported in the data's final year; below 12 means that year is year-to-date. */
export const ytdThrough = (months: string[]) =>
  months.length ? Number(months.at(-1)!.slice(5, 7)) : MONTHS_PER_YEAR;
/** Both years in a comparison cover Jan–`through`, so a partial year meets a matching window. */
export const comparisonThrough = (to: string, months: string[]) =>
  grainOf(to) === 'year' && to === months.at(-1)?.slice(0, 4)
    ? ytdThrough(months)
    : MONTHS_PER_YEAR;

export const offsetPeriod = (period: string, offset: number) =>
  grainOf(period) === 'year' ? String(Number(period) + offset) : offsetMonth(period, offset);
export const periodDistance = (to: string, from: string) =>
  grainOf(to) === 'year' ? Number(to) - Number(from) : monthNumber(to) - monthNumber(from);
/** Last reported month inside a period. */
export const periodEnd = (period: string, through: number) =>
  grainOf(period) === 'year' ? `${period}-${pad(through)}` : period;
export function periodLabel(period: string, through: number) {
  if (grainOf(period) !== 'year') return monthLabel(period);
  if (through === MONTHS_PER_YEAR) return period;
  const end = new Date(Number(period), through - 1, 15).toLocaleDateString('en-US', {
    month: 'short',
  });
  return `Jan–${end} ${period}`;
}

/** Calendar-year totals from monthly reports. A field is null unless every month reports it. */
export function aggregateYear(
  index: Map<string, MonthlyObservation>,
  sector: Sector,
  state: string,
  year: string,
  through: number,
): MonthlyObservation | undefined {
  const rows = Array.from({ length: through }, (_, i) =>
    getMonth(index, sector, `${year}-${pad(i + 1)}`, state),
  );
  if (rows.every((row) => !row)) return undefined;
  const complete = (key: 'sales' | 'revenue' | 'customers') =>
    rows.every((row) => row?.[key] != null)
      ? rows.reduce((sum, row) => sum + row![key]!, 0)
      : null;
  const sales = complete('sales');
  const revenue = complete('revenue');
  const customers = complete('customers');
  return {
    period: year,
    state,
    sector,
    sales,
    revenue,
    // Account counts are point-in-time, so the year uses their monthly average.
    customers: customers === null ? null : customers / through,
    // Sales-weighted: total revenue over total sales, never a mean of monthly prices.
    price: sales && revenue !== null ? (revenue / sales) * CENTS_PER_DOLLAR : null,
  };
}

/** Reads `to`/`from`, falling back to legacy `month`/`compare`/`since` links. */
export function initialRange(q: URLSearchParams, grain: Grain, periods: string[]) {
  const requested = q.get('to') ?? (grain === 'month' ? q.get('month') : null);
  const to = requested && periods.includes(requested) ? requested : periods.at(-1)!;
  const legacy = grain === 'month' ? q.get('compare') : null;
  const from =
    q.get('from') ??
    (legacy === 'custom'
      ? q.get('since')
      : legacy === 'start'
        ? periods[0]
        : legacy === 'month'
          ? offsetPeriod(to, -1)
          : null);
  const gap =
    from && grainOf(from) === grain && from < to ? periodDistance(to, from) : DEFAULT_GAP[grain];
  return { to, gap };
}
