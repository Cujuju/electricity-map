import { createMemo, createSignal, createUniqueId, For, Show } from 'solid-js';
import { geoIdentity, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import topology from '../assets/states.json';
import { STATES } from '../data';
import type { MonthlyObservation } from './types';
import { display, monthLabel, offsetMonth, pct, signedValue } from './math';

const topo = topology as unknown as Topology<{ states: GeometryCollection }>;
const path = geoPath().digits(1);
const dcFips = STATES.find((state) => state.id === 'DC')!.fips;
// DC is too small to see or click at map scale; draw it enlarged offshore, east of MD and VA.
const DC_INSET_SCALE = 16;
const DC_INSET_CENTER: [number, number] = [925, 300];
// Space between the leader's end and the enlarged DC shape, in map units.
const DC_LEADER_GAP = 6;

type Point = [number, number];

/** Point where the segment from `from` toward the box centre first meets the box edge. */
function boxEntry(from: Point, [[x0, y0], [x1, y1]]: [Point, Point]): Point {
  const to: Point = [(x0 + x1) / 2, (y0 + y1) / 2];
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const tx = dx > 0 ? (x0 - from[0]) / dx : dx < 0 ? (x1 - from[0]) / dx : 0;
  const ty = dy > 0 ? (y0 - from[1]) / dy : dy < 0 ? (y1 - from[1]) / dy : 0;
  const t = Math.max(0, Math.min(1, Math.max(tx, ty)));
  return [from[0] + dx * t, from[1] + dy * t];
}

const shapes = feature(topo, topo.objects.states).features.map((shape) => {
  const id = String(shape.id).padStart(2, '0');
  let shapePath = path;
  let leader: { from: Point; to: Point } | undefined;

  if (id === dcFips) {
    const [x, y] = path.centroid(shape);
    const projection = geoIdentity()
      .scale(DC_INSET_SCALE)
      .translate([
        DC_INSET_CENTER[0] - x * DC_INSET_SCALE,
        DC_INSET_CENTER[1] - y * DC_INSET_SCALE,
      ]);
    shapePath = geoPath(projection).digits(1);
    const [[bx0, by0], [bx1, by1]] = shapePath.bounds(shape);
    leader = {
      from: [x, y],
      to: boxEntry(
        [x, y],
        [
          [bx0 - DC_LEADER_GAP, by0 - DC_LEADER_GAP],
          [bx1 + DC_LEADER_GAP, by1 + DC_LEADER_GAP],
        ],
      ),
    };
  }

  return {
    id,
    d: shapePath(shape) ?? '',
    center: shapePath.centroid(shape),
    area: shapePath.area(shape),
    leader,
  };
});
const dcLeader = shapes.find((shape) => shape.leader)?.leader;
// Shapes keyed by state code, in map draw order; shapes with no matching state are dropped.
const mapStates = new Map(
  shapes.flatMap((shape) => {
    const state = STATES.find((item) => item.fips === shape.id);
    return state ? [[state.id, { state, shape }] as const] : [];
  }),
);
const isDc = (geometry: { id?: string | number }) =>
  String(geometry.id).padStart(2, '0') === dcFips;
// DC is drawn relocated, so its edges are left out of the shared border lines.
const borders = path(mesh(topo, topo.objects.states, (a, b) => !isDc(a) && !isDc(b))) ?? '';
// Shapes smaller than this (square map units) are unlabelled unless selected.
const MIN_LABEL_AREA = 600;
// Label shifts from the shape centroid, in map units. MD's centroid sits on DC's true
// location, where the DC leader starts; the shift moves the label north-east, toward Baltimore.
const LABEL_OFFSETS: Record<string, Point> = { MD: [8, -8] };
// Moves the text baseline down so the label is vertically centred on its anchor.
const LABEL_BASELINE_SHIFT = 4;
const labelAnchor = (stateId: string, [x, y]: Point): Point => {
  const [dx, dy] = LABEL_OFFSETS[stateId] ?? [0, 0];
  return [x + dx, y + dy + LABEL_BASELINE_SHIFT];
};

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
  const clipPrefix = `lab-clip-${createUniqueId()}-`;
  // Pointer-hovered or keyboard-focused state; drawn with the lighter outline.
  const [active, setActive] = createSignal<string | null>(null);
  const outlines = createMemo(() => {
    const list = [{ id: props.selected, kind: 'selected' }];
    const hot = active();
    if (hot && hot !== props.selected) list.push({ id: hot, kind: 'active' });
    return list.filter((item) => mapStates.has(item.id));
  });
  return (
    <svg
      class="change-map"
      viewBox="0 0 975 610"
      role="group"
      aria-label="United States monthly electricity metrics by state. Alaska, Hawaii, and DC are repositioned. DC is enlarged; a line marks its location."
    >
      <defs>
        <pattern id="lab-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="currentColor" stroke-opacity=".05" />
        </pattern>
      </defs>
      <rect width="975" height="610" fill="url(#lab-map-grid)" />
      <For each={[...mapStates.values()]}>
        {({ state, shape }) => (
          <g
            data-analysis-state={state.id}
            role="button"
            tabindex="0"
            aria-label={`${state.name}: ${display(props.values.get(state.id))} ${props.unit}`}
            aria-pressed={props.selected === state.id}
            onClick={() => props.onSelect(state.id)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                props.onSelect(state.id);
              }
            }}
            onPointerEnter={() => setActive(state.id)}
            onPointerLeave={() => setActive(null)}
            onFocus={(event) => {
              if (event.currentTarget.matches(':focus-visible')) setActive(state.id);
            }}
            onBlur={() => setActive(null)}
          >
            <title>
              {state.name}: {display(props.values.get(state.id))} {props.unit}
            </title>
            <path
              class="analysis-map-shape"
              d={shape.d}
              fill={dataColor(props.values.get(state.id) ?? null, props.limit, props.diverging)}
            />
          </g>
        )}
      </For>
      {/* One line per shared edge, so every border has the same width. */}
      <path class="analysis-map-borders" d={borders} />
      {/* Outlines are clipped to their shape, so they sit inside it and borders never cover them. */}
      <For each={outlines()}>
        {(item) => {
          const shape = mapStates.get(item.id)!.shape;
          return (
            <g class={`analysis-map-outline is-${item.kind}`}>
              <clipPath id={clipPrefix + item.id}>
                <path d={shape.d} />
              </clipPath>
              <path d={shape.d} clip-path={`url(#${clipPrefix}${item.id})`} />
            </g>
          );
        }}
      </For>
      <For each={[...mapStates.values()]}>
        {({ state, shape }) => (
          <Show when={shape.area > MIN_LABEL_AREA || props.selected === state.id}>
            <text
              x={labelAnchor(state.id, shape.center)[0]}
              y={labelAnchor(state.id, shape.center)[1]}
              text-anchor="middle"
              class="analysis-map-label"
              data-map-label={state.id}
              aria-hidden="true"
            >
              {state.id}
            </text>
          </Show>
        )}
      </For>
      <Show when={dcLeader}>
        {(leader) => (
          <g class="analysis-map-leader" aria-hidden="true">
            <path d={`M${leader().from.join(',')}L${leader().to.join(',')}`} />
            <circle cx={leader().from[0]} cy={leader().from[1]} r="2" />
          </g>
        )}
      </Show>
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
