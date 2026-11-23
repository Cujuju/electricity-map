import { COLOR_STOPS, priceColor } from '../data';

export const DESIGNS = [
  {
    id: 'solar',
    number: '01',
    name: 'Solar Commons',
    category: 'BOTANICAL EDITORIAL',
    brand: 'solar / commons',
    title: 'Power, in full bloom.',
    intro: 'A garden of American electricity. Every petal is a state. Every price tells a story.',
    chartTitle: 'The sunflower index',
    chartSubtitle: '51 petals. One very electric country.',
    encoding:
      'Petal length and color = price. States run alphabetically clockwise. Select a petal to explore.',
    palette: ['#f2eedc', '#273d29', '#b9d342', '#dceaa0', '#e5653f'],
    chart: 'petals',
  },
  {
    id: 'brutalist',
    number: '02',
    name: 'Voltage Bureau',
    category: 'RADICAL SWISS / BRUTALISM',
    brand: 'VOLTAGE BUREAU®',
    title: 'POWER HAS A PRICE.',
    intro: 'No soft edges. Just the numbers. A hard look at what America pays to plug in.',
    chartTitle: 'The cost of connection',
    chartSubtitle: 'States ranked from most to least expensive.',
    encoding:
      'Column height = price in cents/kWh. Ranked high to low. The outlined column is your selected state.',
    palette: ['#e9e9e2', '#151515', '#d7ff00', '#b6bf93', '#1c2418'],
    chart: 'bars',
  },
  {
    id: 'arcade',
    number: '03',
    name: 'Power City',
    category: 'NEON ARCADE / SYNTH CITY',
    brand: 'POWER://CITY',
    title: 'INSERT CURRENT_',
    intro: 'Welcome to the electric skyline. Fifty-one towers. A whole new high score.',
    chartTitle: 'An expensive kind of skyline',
    chartSubtitle: 'A fictional city built from real state prices.',
    encoding:
      'Tower height = price. Towers are ranked tallest in back to shortest in front, not geographic buildings. Select a tower to inspect its state.',
    palette: ['#120b2e', '#f1dcff', '#faff00', '#7049bd', '#ff4ec2'],
    chart: 'city',
  },
  {
    id: 'blueprint',
    number: '04',
    name: 'Field Control',
    category: 'ENGINEERING / CYANOTYPE',
    brand: 'FIELD CONTROL / E-051',
    title: 'THE ANATOMY OF CURRENT.',
    intro: 'A schematic for the price of power. Trace the system. Inspect every component.',
    chartTitle: 'United States / component diagram',
    chartSubtitle: 'Geographic schematic on desktop; component inventory on phones.',
    encoding:
      'Tile color = price. Labels give exact cents/kWh. Desktop geography is approximate, with AK and HI inset; phones show alphabetical components. Traces are decorative guides, not transmission connections.',
    palette: ['#123b66', '#d9efff', '#a9f5f1', '#295b84', '#c2ffff'],
    chart: 'circuit',
  },
  {
    id: 'thermal',
    number: '05',
    name: 'Heat Index',
    category: 'THERMAL SCAN / SWISS POSTER',
    brand: 'HEAT INDEX°',
    title: 'FEEL THE DIFFERENCE.',
    intro: 'Electricity has no temperature here. This is the heat of a price, made visible.',
    chartTitle: 'Fifty-one degrees of electricity',
    chartSubtitle: 'One radial instrument. Fifty-one state readings.',
    encoding:
      'Radial bar length and color = price, not temperature. Alphabetical clockwise order; exact prices remain available in details.',
    palette: ['#ff5b35', '#3d1415', '#f7ff82', '#ffc8a1', '#ac1539'],
    chart: 'thermal',
  },
  {
    id: 'cosmic',
    number: '06',
    name: 'Dark Matter',
    category: 'COSMIC / SCIENTIFIC GLASS',
    brand: 'DARK MATTER',
    title: 'A universe of differences.',
    intro:
      'Same country. Very different gravitational pulls. Find your place in the price–demand universe.',
    chartTitle: 'The price–volume universe',
    chartSubtitle: 'Each planet is a state. This is a statistical space.',
    encoding:
      'Horizontal position = electricity sales on a logarithmic TWh scale. Vertical position and color = price. Planet area increases with sales.',
    palette: ['#101127', '#f1ecff', '#d1abff', '#4b4d98', '#f5b3ee'],
    chart: 'scatter',
  },
  {
    id: 'analog',
    number: '07',
    name: 'Current FM',
    category: 'ANALOG RADIO / INSTRUMENT PANEL',
    brand: 'CURRENT FM / 60 HZ',
    title: 'TUNE INTO THE CURRENT.',
    intro: 'A slow signal from a changing country. Turn the dial on eleven years of electricity.',
    chartTitle: 'The long-wave price signal',
    chartSubtitle: 'Selected state and U.S. total, quarter by quarter.',
    encoding:
      'Horizontal position = quarter. Vertical position = price on a shared scale. Solid signal = state; dashed signal = U.S. No smoothing or invented waveforms.',
    palette: ['#d8c9aa', '#352d24', '#bd4b2c', '#50826e', '#ffc872'],
    chart: 'signal',
  },
  {
    id: 'candy',
    number: '08',
    name: 'Watt Pop',
    category: 'CANDY BRUTALISM / PLAY',
    brand: 'watt pop!',
    title: 'OH, WHAT A WATT.',
    intro: 'Serious electricity data with a little extra fizz. Pick a state. Follow the flavor.',
    chartTitle: 'The price pop chart',
    chartSubtitle: 'The eleven highest-priced states, plus your selection.',
    encoding:
      'Lollipop length = price. The list includes your selected state even when outside the highest eleven. Color also encodes price.',
    palette: ['#d4c2ff', '#2b2048', '#f9ff82', '#f8aeef', '#ff594f'],
    chart: 'lollipops',
  },
  {
    id: 'tidal',
    number: '09',
    name: 'Tidal',
    category: 'LIQUID GLASS / TOPOGRAPHY',
    brand: 'tidal',
    title: 'Everything has a current.',
    intro: 'A landscape of prices in motion. Follow the rise and fall of electricity through time.',
    chartTitle: 'The price landscape',
    chartSubtitle: 'Six state histories, each given its own horizon.',
    encoding:
      'Left to right = time. Height above each row baseline = price on one shared scale. Ridges overlap as a visual treatment; they do not add together.',
    palette: ['#0b303a', '#e0f5f2', '#99ead6', '#387b93', '#bcece3'],
    chart: 'ridges',
  },
  {
    id: 'press',
    number: '10',
    name: 'The Kilowatt',
    category: 'FINANCIAL PRESS / EDITORIAL',
    brand: 'The Kilowatt',
    title: 'The price of being plugged in.',
    intro: 'A quarterly dispatch from the American socket. All the figures, none of the noise.',
    chartTitle: 'The electricity almanac',
    chartSubtitle: 'Your selected state, arranged by year and quarter.',
    encoding:
      'Each cell = one reported quarter; color = price. Gray means unavailable. Select a cell to inspect that quarter. Prices are nominal, without inflation adjustment.',
    palette: ['#eee9dd', '#292823', '#bb462c', '#d5d8c0', '#b04932'],
    chart: 'calendar',
  },
] as const;

export type Design = (typeof DESIGNS)[number];
export type DesignId = Design['id'];
export type DashboardId = 'original' | DesignId;
export type ThemeId = DashboardId;

export type ThemeTone = 'Light' | 'Dark' | 'Warm';

export interface ThemeMeta {
  id: ThemeId;
  number: string;
  name: string;
  tone: ThemeTone;
  category: string;
  palette: readonly [string, string, string, string, string];
}

const THEME_LABELS: Record<DesignId, { name: string; tone: ThemeTone }> = {
  solar: { name: 'Meadow Linen', tone: 'Light' },
  brutalist: { name: 'Acid Concrete', tone: 'Light' },
  arcade: { name: 'Ultraviolet', tone: 'Dark' },
  blueprint: { name: 'Cyanotype', tone: 'Dark' },
  thermal: { name: 'Infrared', tone: 'Warm' },
  cosmic: { name: 'Midnight Iris', tone: 'Dark' },
  analog: { name: 'Walnut & Rust', tone: 'Light' },
  candy: { name: 'Lilac Fizz', tone: 'Light' },
  tidal: { name: 'Abyssal Teal', tone: 'Dark' },
  press: { name: 'Newsprint', tone: 'Light' },
};

export const ORIGINAL_THEME: ThemeMeta = {
  id: 'original',
  number: '00',
  name: 'Night Moss',
  tone: 'Dark',
  category: 'DARK BOTANICAL / OBSERVATORY',
  palette: ['#111916', '#e8eddf', '#d4fa66', '#79ccb6', '#ec665d'],
};

export const THEMES: readonly ThemeMeta[] = [
  ORIGINAL_THEME,
  ...DESIGNS.map((design) => ({
    id: design.id,
    number: design.number,
    name: THEME_LABELS[design.id].name,
    tone: THEME_LABELS[design.id].tone,
    category: design.category,
    palette: design.palette,
  })),
];

export function isDesign(value: string | null): value is DesignId {
  return DESIGNS.some((design) => design.id === value);
}

export function isTheme(value: string | null): value is ThemeId {
  return value === 'original' || isDesign(value);
}

export function themeById(id: ThemeId): ThemeMeta {
  return THEMES.find((theme) => theme.id === id) ?? ORIGINAL_THEME;
}

export function themeGradient(id: ThemeId): string {
  if (id === 'original') return `linear-gradient(90deg, ${COLOR_STOPS.join(', ')})`;
  const { palette } = themeById(id);
  return `linear-gradient(90deg, ${palette[3]}, ${palette[4]})`;
}

function parseRgb(color: string): [number, number, number] | null {
  if (color.startsWith('#') && color.length === 7) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16),
    ];
  }
  const match = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(color);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function mixStops(stops: readonly string[], t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const scaled = clamped * (stops.length - 1);
  const left = Math.floor(scaled);
  const right = Math.min(left + 1, stops.length - 1);
  const frac = scaled - left;
  const a = parseRgb(stops[left])!;
  const b = parseRgb(stops[right])!;
  return `rgb(${a.map((channel, index) => Math.round(channel + (b[index] - channel) * frac)).join(',')})`;
}

export function interpolateColor(
  value: number | null | undefined,
  themeOrDesign: ThemeId | Design,
  ceiling: number,
) {
  if (value == null) return '#868b88';
  const id = typeof themeOrDesign === 'string' ? themeOrDesign : themeOrDesign.id;
  const t = value / ceiling;
  if (id === 'original') return mixStops(COLOR_STOPS, t);
  const { palette } = themeById(id);
  return mixStops([palette[3], palette[4]], t);
}

// Observatory lenses map prices onto a fixed 5–50¢ range.
const OBSERVATORY_MIN_PRICE = 5;
const OBSERVATORY_PRICE_SPAN = 45;

export function observatoryPriceColor(value: number | null | undefined, themeId: ThemeId) {
  if (themeId === 'original') return priceColor(value);
  if (value == null) return '#868b88';
  const { palette } = themeById(themeId);
  return mixStops([palette[3], palette[4]], (value - OBSERVATORY_MIN_PRICE) / OBSERVATORY_PRICE_SPAN);
}

// Perceived luminance threshold separating dark ink from light ink on data tiles.
const CONTRAST_LUMINANCE_MIDPOINT = 140;

export function contrastInk(color: string): string {
  const rgb = parseRgb(color);
  if (!rgb) return 'var(--ink)';
  const luminance = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
  return luminance > CONTRAST_LUMINANCE_MIDPOINT ? '#111916' : '#f7f9f4';
}
