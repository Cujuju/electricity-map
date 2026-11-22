import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import {
  ColorType,
  createChart,
  createSeriesMarkers,
  type DeepPartial,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type LineData,
  LineSeries,
  LineStyle,
  type LineStyleOptions,
  type LineWidth,
  type MouseEventParams,
  type SeriesOptionsCommon,
  type Time,
  type UTCTimestamp,
  type WhitespaceData,
} from 'lightweight-charts';
import type { MonthlyObservation } from './types';
import { reportedRuns } from './periods';

const MS_PER_SECOND = 1000;
// Room past the last month for the "From"/"To" titles, drawn in the plot beside the price
// axis (4 mono chars at the 12px default, plus padding), so they never cover recent months.
const END_CLEARANCE_PX = 48;
// Compared periods are drawn over the state line at twice its width.
const STATE_LINE_PX: LineWidth = 2;
const WINDOW_LINE_PX: LineWidth = 4;
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

type LineOptions = DeepPartial<LineStyleOptions & SeriesOptionsCommon>;

/**
 * A line that breaks at missing months, never bridging or zero-filling them. Line series
 * join points across whitespace, so each unbroken run gets its own series.
 */
function gappedLine(chart: IChartApi, base: LineOptions) {
  let options = base;
  const series: ISeriesApi<'Line'>[] = [chart.addSeries(LineSeries, options)];
  return {
    /** Kept for the chart's lifetime, so price lines and markers attached to it persist. */
    first: series[0],
    applyOptions(next: LineOptions) {
      options = { ...options, ...next };
      for (const item of series) item.applyOptions(next);
    },
    setData(rows: MonthlyObservation[]) {
      const runs = reportedRuns(rows).map((run) =>
        run.map((row) => ({ time: monthTime(row.period), value: row.price })),
      );
      while (series.length < runs.length) {
        const added = chart.addSeries(LineSeries, options);
        // Draw beside its siblings, not over lines added after this one (the highlights).
        added.setSeriesOrder(series.at(-1)!.seriesOrder() + 1);
        series.push(added);
      }
      while (series.length > Math.max(1, runs.length)) chart.removeSeries(series.pop()!);
      series.forEach((item, i) => item.setData(runs[i] ?? []));
    },
  };
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
    bg: themed(host, 'color', 'var(--lab-bg)'),
    font: themed(host, 'fontFamily', 'var(--mono)'),
  };
}

/** One side of the comparison: its months and the price the comparison uses for it. */
export type ComparedWindow = {
  start: string;
  end: string;
  /** Monthly price, or the sales-weighted price over the window for a year comparison. */
  price: number | null;
};

export function HistoryPlot(props: {
  rows: MonthlyObservation[];
  national: MonthlyObservation[];
  from: ComparedWindow;
  to: ComparedWindow;
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
      timeScale: { borderVisible: false, fixLeftEdge: true, rightOffsetPixels: END_CLEARANCE_PX },
      grid: { vertLines: { visible: false } },
      localization: { priceFormatter: priceFormat.formatter },
    });
    // Latest-value labels are off: the From and To labels carry the compared values.
    const quiet = { priceFormat, priceLineVisible: false, lastValueVisible: false };
    // Holds every month as a time slot, so gaps keep their width, and carries the endpoint dots.
    const timeline = chart.addSeries(LineSeries, {
      ...quiet,
      lineVisible: false,
      crosshairMarkerVisible: false,
    });
    const national = gappedLine(chart, { ...quiet, lineWidth: 1, lineStyle: LineStyle.Dashed });
    const state = gappedLine(chart, { ...quiet, lineWidth: STATE_LINE_PX });
    const highlight = { ...quiet, lineWidth: WINDOW_LINE_PX, crosshairMarkerVisible: false };
    const fromHighlight = gappedLine(chart, highlight);
    const toHighlight = gappedLine(chart, highlight);
    // A one-month window has no segment to thicken, so it gets a dot on the line instead.
    // The timeline is drawn first, so its dots are lifted above every line.
    const markers = createSeriesMarkers(timeline, [], { zOrder: 'top' });
    let priceLines: IPriceLine[] = [];
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
      state.setData(props.rows);
      national.setData(props.national);
      chart.timeScale().fitContent();
    });
    createEffect(() => {
      const theme = colors()!;
      const sides = [
        { window: props.from, title: 'From', color: theme.muted, series: fromHighlight },
        { window: props.to, title: 'To', color: theme.accent, series: toHighlight },
      ];
      for (const { window, color, series } of sides) {
        series.applyOptions({ color });
        series.setData(
          props.rows.filter((row) => row.period >= window.start && row.period <= window.end),
        );
      }
      const dots = new Map<string, { price: number; color: string }>();
      for (const { window, color } of sides) {
        const row = props.rows.find((item) => item.period === window.end);
        if (window.start === window.end && row?.price != null)
          dots.set(row.period, { price: row.price, color });
      }
      const months = [...new Set([...props.rows, ...props.national].map((row) => row.period))].sort();
      timeline.setData(
        months.map((period): LineData<Time> | WhitespaceData<Time> => {
          const dot = dots.get(period);
          return dot ? { time: monthTime(period), value: dot.price } : { time: monthTime(period) };
        }),
      );
      markers.setMarkers(
        [...dots].map(([period, dot]) => ({
          time: monthTime(period),
          position: 'atPriceMiddle',
          price: dot.price,
          shape: 'circle',
          color: dot.color,
        })),
      );
      for (const line of priceLines) state.first.removePriceLine(line);
      priceLines = sides
        .filter(({ window }) => window.price !== null)
        .map(({ window, title, color }) =>
          state.first.createPriceLine({
            price: window.price!,
            title,
            lineVisible: false,
            axisLabelVisible: true,
            axisLabelColor: color,
            axisLabelTextColor: theme.bg,
          }),
        );
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
