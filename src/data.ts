import type { Dataset, Observation, Sector, StateInfo } from './types';

const stateDefinitions = [
  ['AL', '01', 'Alabama', 'South'],
  ['AK', '02', 'Alaska', 'West'],
  ['AZ', '04', 'Arizona', 'West'],
  ['AR', '05', 'Arkansas', 'South'],
  ['CA', '06', 'California', 'West'],
  ['CO', '08', 'Colorado', 'West'],
  ['CT', '09', 'Connecticut', 'Northeast'],
  ['DE', '10', 'Delaware', 'South'],
  ['DC', '11', 'District of Columbia', 'South'],
  ['FL', '12', 'Florida', 'South'],
  ['GA', '13', 'Georgia', 'South'],
  ['HI', '15', 'Hawaii', 'West'],
  ['ID', '16', 'Idaho', 'West'],
  ['IL', '17', 'Illinois', 'Midwest'],
  ['IN', '18', 'Indiana', 'Midwest'],
  ['IA', '19', 'Iowa', 'Midwest'],
  ['KS', '20', 'Kansas', 'Midwest'],
  ['KY', '21', 'Kentucky', 'South'],
  ['LA', '22', 'Louisiana', 'South'],
  ['ME', '23', 'Maine', 'Northeast'],
  ['MD', '24', 'Maryland', 'South'],
  ['MA', '25', 'Massachusetts', 'Northeast'],
  ['MI', '26', 'Michigan', 'Midwest'],
  ['MN', '27', 'Minnesota', 'Midwest'],
  ['MS', '28', 'Mississippi', 'South'],
  ['MO', '29', 'Missouri', 'Midwest'],
  ['MT', '30', 'Montana', 'West'],
  ['NE', '31', 'Nebraska', 'Midwest'],
  ['NV', '32', 'Nevada', 'West'],
  ['NH', '33', 'New Hampshire', 'Northeast'],
  ['NJ', '34', 'New Jersey', 'Northeast'],
  ['NM', '35', 'New Mexico', 'West'],
  ['NY', '36', 'New York', 'Northeast'],
  ['NC', '37', 'North Carolina', 'South'],
  ['ND', '38', 'North Dakota', 'Midwest'],
  ['OH', '39', 'Ohio', 'Midwest'],
  ['OK', '40', 'Oklahoma', 'South'],
  ['OR', '41', 'Oregon', 'West'],
  ['PA', '42', 'Pennsylvania', 'Northeast'],
  ['RI', '44', 'Rhode Island', 'Northeast'],
  ['SC', '45', 'South Carolina', 'South'],
  ['SD', '46', 'South Dakota', 'Midwest'],
  ['TN', '47', 'Tennessee', 'South'],
  ['TX', '48', 'Texas', 'South'],
  ['UT', '49', 'Utah', 'West'],
  ['VT', '50', 'Vermont', 'Northeast'],
  ['VA', '51', 'Virginia', 'South'],
  ['WA', '53', 'Washington', 'West'],
  ['WV', '54', 'West Virginia', 'South'],
  ['WI', '55', 'Wisconsin', 'Midwest'],
  ['WY', '56', 'Wyoming', 'West'],
] as const;
export const STATES: StateInfo[] = stateDefinitions.map(([id, fips, name, region]) => ({
  id,
  fips,
  name,
  region,
}));
export const SECTORS: { id: Sector; name: string; description: string }[] = [
  { id: 'RES', name: 'Residential', description: 'Homes & households' },
  { id: 'COM', name: 'Commercial', description: 'Offices, shops & services' },
  { id: 'IND', name: 'Industrial', description: 'Factories & industry' },
  { id: 'ALL', name: 'All sectors', description: 'All ultimate customers' },
];
export const SOURCE_URL =
  'https://www.eia.gov/electricity/data/browser/#/topic/7?agg=1,0&geo=g0fvvvvvvvvvo&endsec=8&linechart=ELEC.PRICE.US-RES.Q&columnchart=ELEC.PRICE.US-RES.Q&map=ELEC.PRICE.US-RES.Q&freq=Q';
export const price = (value: number | null | undefined) => (value == null ? '—' : value.toFixed(2));
export const quarter = (period: string) => {
  const [year, q] = period.split('-');
  return `${q} ${year}`;
};
export const previousYear = (period: string) =>
  `${Number(period.slice(0, 4)) - 1}${period.slice(4)}`;
export const percentage = (now?: number | null, previous?: number | null) =>
  now == null || previous == null || previous === 0 ? null : (now / previous - 1) * 100;
export const signed = (value: number | null) =>
  value === null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
export const sales = (value: number | null | undefined) =>
  value == null ? '—' : `${(value / 1000).toFixed(1)} TWh`;

export function indexDataset(dataset: Dataset) {
  return new Map(dataset.rows.map((row) => [`${row.sector}:${row.period}:${row.state}`, row]));
}
export function observation(
  index: Map<string, Observation>,
  sector: Sector,
  period: string,
  state: string,
) {
  return index.get(`${sector}:${period}:${state}`);
}

// One fixed price scale across sectors, states, quarters, and all three lenses.
export const COLOR_STOPS = ['#79ccb6', '#c8ec88', '#e6eb67', '#e5b354', '#e68150', '#ec665d'];
export function priceColor(value: number | null | undefined) {
  if (value == null) return '#56605a';
  const position = Math.max(0, Math.min(1, (value - 5) / 45)) * (COLOR_STOPS.length - 1);
  const left = Math.floor(position);
  const right = Math.min(left + 1, COLOR_STOPS.length - 1);
  const t = position - left;
  const rgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));
  const a = rgb(COLOR_STOPS[left]);
  const b = rgb(COLOR_STOPS[right]);
  return `rgb(${a.map((channel, i) => Math.round(channel + (b[i] - channel) * t)).join(',')})`;
}

export function downloadCSV(rows: Observation[], sector: Sector, period: string) {
  const header = 'quarter,state,sector,price_cents_per_kwh,sales_million_kwh,revenue_million_usd';
  const body = rows.map((row) =>
    [row.period, row.state, row.sector, row.price ?? '', row.sales ?? '', row.revenue ?? ''].join(
      ',',
    ),
  );
  const blob = new Blob([[header, ...body].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `electricity-map-${sector}-${period}.csv`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
