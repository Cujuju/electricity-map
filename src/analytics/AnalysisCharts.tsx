import { createMemo, For, Show } from 'solid-js';
import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topology from '../assets/states.json';
import { STATES } from '../data';
import type { MonthlyObservation } from './types';
import { display, monthLabel, offsetMonth, pct, signedValue } from './math';

const topo = topology as unknown as Topology<{ states: GeometryCollection }>;
const path = geoPath().digits(1);
const shapes = feature(topo, topo.objects.states).features.map((shape) => ({
  id: String(shape.id).padStart(2, '0'),
  d: path(shape) ?? '',
  center: path.centroid(shape),
  area: path.area(shape),
}));
export function dataColor(value: number | null, limit: number, diverging = true) {
  if (value === null) return 'var(--lab-missing)';
  const t = Math.max(0, Math.min(1, Math.abs(value) / Math.max(0.001, limit)));
  return `color-mix(in srgb,${diverging ? (value < 0 ? 'var(--lab-down)' : 'var(--lab-up)') : 'var(--lab-accent)'} ${18 + t * 82}%,var(--lab-surface))`;
}

export function ChangeMap(props: {
  values: Map<string, number | null>;
  selected: string;
  limit: number;
  diverging: boolean;
  unit: string;
  onSelect: (id: string) => void;
}) {
  return (
    <svg
      class="change-map"
      viewBox="0 0 975 610"
      role="group"
      aria-label="United States monthly electricity metrics by state. Alaska and Hawaii are repositioned."
    >
      <defs>
        <pattern id="lab-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="currentColor" stroke-opacity=".05" />
        </pattern>
      </defs>
      <rect width="975" height="610" fill="url(#lab-map-grid)" />
      <For each={shapes}>
        {(shape) => {
          const state = STATES.find((state) => state.fips === shape.id);
          return (
            <Show when={state}>
              <g>
                <path
                  data-analysis-state={state!.id}
                  d={shape.d}
                  fill={dataColor(
                    props.values.get(state!.id) ?? null,
                    props.limit,
                    props.diverging,
                  )}
                  stroke={props.selected === state!.id ? 'var(--lab-ink)' : 'var(--lab-bg)'}
                  stroke-width={props.selected === state!.id ? 3 : 1}
                  role="button"
                  tabindex="0"
                  aria-label={`${state!.name}: ${display(props.values.get(state!.id))} ${props.unit}`}
                  aria-pressed={props.selected === state!.id}
                  onClick={() => props.onSelect(state!.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      props.onSelect(state!.id);
                    }
                  }}
                >
                  <title>
                    {state!.name}: {display(props.values.get(state!.id))} {props.unit}
                  </title>
                </path>
                <Show when={shape.area > 600 || props.selected === state!.id}>
                  <text
                    x={shape.center[0]}
                    y={shape.center[1] + 4}
                    text-anchor="middle"
                    class="analysis-map-label"
                  >
                    {state!.id}
                  </text>
                </Show>
              </g>
            </Show>
          );
        }}
      </For>
    </svg>
  );
}

export function HistoryPlot(props: {
  rows: MonthlyObservation[];
  national: MonthlyObservation[];
  selectedMonth: string;
  baseline: string;
  state: string;
  onMonth: (month: string) => void;
}) {
  const valid = createMemo(() =>
    [...props.rows, ...props.national]
      .map((row) => row.price)
      .filter((value): value is number => value !== null),
  );
  const ceiling = createMemo(() => Math.ceil(Math.max(10, ...valid()) / 10) * 10);
  const x = (i: number) => 48 + (i / Math.max(1, props.rows.length - 1)) * 680;
  const y = (value: number) => 222 - (value / ceiling()) * 185;
  const line = (rows: MonthlyObservation[]) => {
    let gap = true;
    return rows
      .map((row, i) => {
        if (row.price === null) {
          gap = true;
          return '';
        }
        const d = `${gap ? 'M' : 'L'}${x(i)},${y(row.price)}`;
        gap = false;
        return d;
      })
      .join(' ');
  };
  return (
    <svg
      class="analysis-history"
      viewBox="0 0 780 275"
      role="group"
      aria-label={`${props.state} and U.S. reported monthly prices, cents per kilowatt-hour. Select a point to inspect a month.`}
    >
      <For each={[0, ceiling() / 2, ceiling()]}>
        {(value) => (
          <g>
            <path d={`M48 ${y(value)}H728`} stroke="currentColor" stroke-opacity=".12" />
            <text x="9" y={y(value) + 4} class="analysis-axis">
              {value}¢
            </text>
          </g>
        )}
      </For>
      <path
        d={line(props.national)}
        fill="none"
        stroke="var(--lab-muted)"
        stroke-width="1.5"
        stroke-dasharray="4 5"
      />
      <path d={line(props.rows)} fill="none" stroke="var(--lab-accent)" stroke-width="2.5" />
      <For each={props.rows}>
        {(row, i) => (
          <g>
            <Show when={row.period === props.selectedMonth || row.period === props.baseline}>
              <path
                d={`M${x(i())} 30V222`}
                stroke={
                  row.period === props.selectedMonth ? 'var(--lab-accent)' : 'var(--lab-muted)'
                }
                stroke-dasharray="2 5"
              />
              <text
                x={x(i())}
                y={row.period === props.selectedMonth ? 18 : 36}
                text-anchor={i() > props.rows.length * 0.8 ? 'end' : 'start'}
                class="analysis-axis"
              >
                {row.period === props.selectedMonth ? 'NOW' : 'BASELINE'}
              </text>
            </Show>
            <Show when={row.price !== null}>
              <circle
                data-history-month={row.period}
                cx={x(i())}
                cy={y(row.price!)}
                r={row.period === props.selectedMonth ? 4 : 2}
                fill="var(--lab-accent)"
                role="button"
                tabindex="0"
                aria-label={`${monthLabel(row.period)}, ${display(row.price, 2)} cents per kWh`}
                onClick={() => props.onMonth(row.period)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    props.onMonth(row.period);
                  }
                }}
              >
                <title>
                  {monthLabel(row.period)}: {display(row.price, 2)} ¢/kWh
                </title>
              </circle>
            </Show>
          </g>
        )}
      </For>
      <text x="48" y="249" class="analysis-axis">
        {props.rows[0]?.period.slice(0, 4)}
      </text>
      <text x="728" y="249" text-anchor="end" class="analysis-axis">
        {props.rows.at(-1)?.period.slice(0, 4)}
      </text>
      <text x="48" y="270" class="analysis-axis">
        SOLID: {props.state} / DASHED: U.S. / NOMINAL ¢ PER kWh
      </text>
    </svg>
  );
}

export function TimeGrid(props: {
  index: Map<string, MonthlyObservation>;
  sector: string;
  months: string[];
  selected: string;
  month: string;
  onPick: (state: string, month: string) => void;
}) {
  return (
    <div
      class="time-grid-scroll"
      role="region"
      aria-label="Scrollable state-by-month year-over-year price-change heatmap"
      tabindex="0"
    >
      <table class="time-grid">
        <thead>
          <tr>
            <th>STATE / YoY %</th>
            <For each={props.months}>
              {(month) => (
                <th>
                  {month.slice(5)}
                  <small>{month.slice(0, 4)}</small>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody>
          <For each={STATES}>
            {(state) => (
              <tr classList={{ focused: state.id === props.selected }}>
                <th>
                  {state.id}
                  <span>{state.name}</span>
                </th>
                <For each={props.months}>
                  {(month) => {
                    const row = () => props.index.get(`${props.sector}:${month}:${state.id}`);
                    const before = () =>
                      props.index.get(`${props.sector}:${offsetMonth(month, -12)}:${state.id}`);
                    const value = () => pct(row()?.price, before()?.price);
                    const change = () => signedValue(value());
                    return (
                      <td>
                        <button
                          data-heatmap-cell={`${state.id}:${month}`}
                          aria-label={`${state.name}, ${monthLabel(month)}, ${change()} percent year over year, ${display(row()?.price, 2)} cents per kWh`}
                          title={`${state.name} · ${monthLabel(month)} · ${change()}% YoY · ${display(row()?.price, 2)}¢/kWh`}
                          aria-pressed={state.id === props.selected && month === props.month}
                          style={{ background: dataColor(value(), 30) }}
                          onClick={() => props.onPick(state.id, month)}
                        >
                          {change()}
                        </button>
                      </td>
                    );
                  }}
                </For>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
