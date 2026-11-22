import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  LineSeries,
  LineStyle,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import type { MonthlyObservation } from './types';

const MS_PER_SECOND = 1000;
// Half the widest centred marker label ("BASELINE", 8 mono chars at the 12px default), so it never clips.
const MARKER_LABEL_CLEARANCE_PX = 32;
// Matches the two-decimal ¢/kWh shown everywhere else in Change Lab.
const PRICE_DECIMALS = 2;
const priceFormat = {
  type: 'custom' as const,
  minMove: 10 ** -PRICE_DECIMALS,
  formatter: (price: number) => `${price.toFixed(PRICE_DECIMALS)}¢`,
};

/** Month period `YYYY-MM` → first-of-month UTC timestamp, the chart's horizontal unit. */
function monthTime(period: string) {
  const [year, month] = period.split('-').map(Number);
  return (Date.UTC(year, month - 1, 1) / MS_PER_SECOND) as UTCTimestamp;
}

/** Missing prices become whitespace points, which the chart draws as gaps, never zeros. */
function seriesData(rows: MonthlyObservation[]) {
  return rows.map((row) =>
    row.price === null
      ? { time: monthTime(row.period) }
      : { time: monthTime(row.period), value: row.price },
  );
}

let pixel: CanvasRenderingContext2D | undefined;

/** Resolves a themed CSS value on `host`; colors are flattened to rgba for the canvas renderer. */
function themed(host: HTMLElement, property: 'color' | 'fontFamily', value: string) {
  const probe = document.createElement('span');
  probe.style[property] = value;
  host.append(probe);
  const computed = getComputedStyle(probe)[property];
  probe.remove();
  if (property === 'fontFamily') return computed;
  pixel ??= document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
  pixel.clearRect(0, 0, 1, 1);
  pixel.fillStyle = computed;
  pixel.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = pixel.getImageData(0, 0, 1, 1).data;
  return `rgba(${r},${g},${b},${a / 255})`;
}

function palette(host: HTMLElement) {
  return {
    accent: themed(host, 'color', 'var(--lab-accent)'),
    muted: themed(host, 'color', 'var(--lab-muted)'),
    line: themed(host, 'color', 'var(--lab-line)'),
    font: themed(host, 'fontFamily', 'var(--mono)'),
  };
}

export function HistoryPlot(props: {
  rows: MonthlyObservation[];
  national: MonthlyObservation[];
  selectedMonth: string;
  baseline: string;
  state: string;
  /** Theme key; colors are re-read from CSS when it changes. */
  design: string;
  onMonth: (month: string) => void;
}) {
  let host!: HTMLDivElement;
  const [colors, setColors] = createSignal<ReturnType<typeof palette>>();

  onMount(() => {
    const chart = createChart(host, {
      autoSize: true,
      // Wheel gestures keep scrolling the page instead of zooming the chart.
      handleScroll: { mouseWheel: false },
      handleScale: { mouseWheel: false },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, fixLeftEdge: true, rightOffsetPixels: MARKER_LABEL_CLEARANCE_PX },
      grid: { vertLines: { visible: false } },
      localization: { priceFormatter: priceFormat.formatter },
    });
    const national = chart.addSeries(LineSeries, {
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceFormat,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const state = chart.addSeries(LineSeries, { lineWidth: 2, priceFormat, priceLineVisible: false });
    const markers = createSeriesMarkers(state);
    const pick = (event: MouseEventParams<Time>) => {
      if (typeof event.time !== 'number') return;
      const date = new Date(event.time * MS_PER_SECOND);
      props.onMonth(
        `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      );
    };
    chart.subscribeClick(pick);
    onCleanup(() => chart.remove());

    createEffect(() => {
      void props.design;
      setColors(palette(host));
    });
    createEffect(() => {
      const theme = colors()!;
      chart.applyOptions({
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: theme.muted,
          fontFamily: theme.font,
        },
        grid: { horzLines: { color: theme.line } },
      });
      state.applyOptions({ color: theme.accent });
      national.applyOptions({ color: theme.muted });
    });
    createEffect(() => {
      state.setData(seriesData(props.rows));
      national.setData(seriesData(props.national));
      chart.timeScale().fitContent();
    });
    createEffect(() => {
      const theme = colors()!;
      const observed = new Set(props.rows.filter((row) => row.price !== null).map((row) => row.period));
      const marks: SeriesMarker<Time>[] = [];
      if (props.baseline !== props.selectedMonth && observed.has(props.baseline))
        marks.push({ time: monthTime(props.baseline), position: 'belowBar', shape: 'circle', color: theme.muted, text: 'BASELINE' });
      if (observed.has(props.selectedMonth))
        marks.push({ time: monthTime(props.selectedMonth), position: 'aboveBar', shape: 'circle', color: theme.accent, text: 'NOW' });
      markers.setMarkers(marks.sort((a, b) => (a.time as number) - (b.time as number)));
    });
  });

  return (
    <div
      ref={host}
      class="analysis-history"
      data-testid="history-chart"
      role="img"
      aria-label={`${props.state} and U.S. reported monthly prices, cents per kilowatt-hour. Select a point to inspect a month, or use the monthly timeline.`}
    />
  );
}
