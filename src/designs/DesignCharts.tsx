import { createMemo, createSignal, For, Show, Switch, Match, onMount, onCleanup } from 'solid-js';
import { price, quarter } from '../data';
import type { Observation, StateDatum } from '../types';
import { contrastInk, interpolateColor, type Design, type ThemeId } from './catalog';
import { StateMark, quarterEvents as periodEvents } from './ChartMark';
import PortraitCharts from './PortraitCharts';

export interface ChartProps {
  design: Design;
  theme: ThemeId;
  states: StateDatum[];
  selected: string;
  period: string;
  periods: string[];
  history: Observation[];
  nationalHistory: Observation[];
  allHistory: Observation[];
  ceiling: number;
  onSelect: (id: string) => void;
  onPeriod: (period: string) => void;
}

const grid: Record<string, [number, number]> = {
  AK: [0, 0],
  ME: [11, 0],
  WI: [6, 1],
  VT: [9, 1],
  NH: [10, 1],
  WA: [1, 2],
  ID: [2, 2],
  MT: [3, 2],
  ND: [4, 2],
  MN: [5, 2],
  IL: [6, 2],
  MI: [7, 2],
  NY: [9, 2],
  MA: [10, 2],
  OR: [1, 3],
  NV: [2, 3],
  WY: [3, 3],
  SD: [4, 3],
  IA: [5, 3],
  IN: [6, 3],
  OH: [7, 3],
  PA: [8, 3],
  NJ: [9, 3],
  CT: [10, 3],
  RI: [11, 3],
  CA: [1, 4],
  UT: [2, 4],
  CO: [3, 4],
  NE: [4, 4],
  MO: [5, 4],
  KY: [6, 4],
  WV: [7, 4],
  VA: [8, 4],
  MD: [9, 4],
  DE: [10, 4],
  AZ: [2, 5],
  NM: [3, 5],
  KS: [4, 5],
  AR: [5, 5],
  TN: [6, 5],
  NC: [7, 5],
  SC: [8, 5],
  DC: [9, 5],
  OK: [4, 6],
  LA: [5, 6],
  MS: [6, 6],
  AL: [7, 6],
  GA: [8, 6],
  HI: [0, 7],
  TX: [4, 7],
  FL: [9, 7],
};

const CITY_COLUMNS = 9;
const CITY_FIRST_COLUMN_X = 128;
const CITY_COLUMN_PITCH = 68;
const CITY_ROW_PITCH = 54;
const CITY_ROOF_FRONT_WIDTH = 32;
const CITY_ROOF_FRONT_DROP = 16;
const CITY_ROOF_SIDE_WIDTH = 21;
const CITY_ROOF_BACK_RISE = 12;

export default function DesignCharts(props: ChartProps) {
  const media = window.matchMedia('(max-width: 700px)');
  const [compact, setCompact] = createSignal(media.matches);
  const updateCompact = (event: MediaQueryListEvent) => setCompact(event.matches);
  onMount(() => media.addEventListener('change', updateCompact));
  onCleanup(() => media.removeEventListener('change', updateCompact));
  const color = (value: number | null | undefined) =>
    interpolateColor(value, props.theme, props.ceiling);
  const ranked = createMemo(() =>
    [...props.states].sort((a, b) => (b.observation?.price ?? -1) - (a.observation?.price ?? -1)),
  );
  const point = (index: number, radius: number, offset = -Math.PI / 2) => {
    const angle = (index / props.states.length) * Math.PI * 2 + offset;
    return [450 + Math.cos(angle) * radius, 270 + Math.sin(angle) * radius];
  };
  const ratio = (value: number | null | undefined) =>
    Math.min(1, Math.max(0, (value ?? 0) / props.ceiling));
  const nationalPrice = () =>
    props.nationalHistory.find((row) => row.period === props.period)?.price;
  const historyPath = (
    rows: Observation[],
    x: number,
    y: number,
    width: number,
    height: number,
  ) => {
    let missing = true;
    return rows
      .map((row, i) => {
        if (row.price == null) {
          missing = true;
          return '';
        }
        const segment = `${missing ? 'M' : 'L'}${x + (i / Math.max(1, rows.length - 1)) * width},${y - (row.price / props.ceiling) * height}`;
        missing = false;
        return segment;
      })
      .join(' ');
  };
  const quarterEvents = (period: string) => periodEvents(period, props.onPeriod);
  const candyStates = createMemo(() => {
    const top = ranked().slice(0, 11);
    return top.some((state) => state.id === props.selected)
      ? top
      : [...top, props.states.find((state) => state.id === props.selected)!];
  });
  const candyAxis = () => 85 + (candyStates().length - 1) * 38;
  return (
    <Show
      when={compact()}
      fallback={
        <svg
          class={`design-chart chart-${props.design.chart}`}
          viewBox={
            props.design.chart === 'petals'
              ? '90 0 720 540'
              : props.design.chart === 'calendar'
                ? '0 35 900 435'
                : '0 0 900 540'
          }
          role="group"
          aria-label={`${props.design.chartTitle}. ${props.design.encoding}`}
        >
          <defs>
            <linearGradient id="design-signal-fill" x1="0" x2="0" y1="0" y2="1">
              <stop stop-color="var(--accent)" stop-opacity=".22" />
              <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
            <pattern
              id="design-engineering-grid"
              width="30"
              height="30"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M30 0H0V30"
                stroke="currentColor"
                stroke-opacity=".1"
                fill="none"
                stroke-width=".6"
              />
            </pattern>
          </defs>
          <Switch>
            <Match when={props.design.chart === 'petals'}>
              <For each={[100, 160, 220]}>
                {(radius) => (
                  <circle
                    cx="450"
                    cy="270"
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    stroke-opacity=".1"
                    stroke-dasharray="2 6"
                  />
                )}
              </For>
              <For each={props.states}>
                {(state, i) => {
                  const angle = () => (i() / props.states.length) * 360;
                  const length = () => 35 + ratio(state.observation?.price) * 120;
                  const label = () => point(i(), 100 + length());
                  return (
                    <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                      <path
                        class="data-mark petal"
                        d={`M445,185 Q424,${185 - length() * 0.6} 450,${185 - length()} Q476,${185 - length() * 0.6} 455,185Z`}
                        transform={`rotate(${angle()} 450 270)`}
                        fill={color(state.observation?.price)}
                        stroke="var(--paper)"
                        stroke-width="1.5"
                      />
                      <text
                        x={label()[0]}
                        y={label()[1] + 3}
                        text-anchor="middle"
                        class="chart-state-label"
                      >
                        {state.id}
                      </text>
                    </StateMark>
                  );
                }}
              </For>
              <circle
                cx="450"
                cy="270"
                r="84"
                fill="var(--paper)"
                stroke="currentColor"
                stroke-width="1"
              />
              <circle
                cx="450"
                cy="270"
                r="75"
                fill="none"
                stroke="currentColor"
                stroke-opacity=".17"
                stroke-dasharray="1 5"
              />
              <text x="450" y="251" text-anchor="middle" class="chart-micro">
                THE NATIONAL CENTER
              </text>
              <text x="450" y="290" text-anchor="middle" class="chart-center-number">
                {price(nationalPrice())}
              </text>
              <text x="450" y="311" text-anchor="middle" class="chart-micro">
                CENTS / kWh
              </text>
            </Match>
            <Match when={props.design.chart === 'bars'}>
              <For each={[0, 15, 30, 45, 60]}>
                {(value) => (
                  <g>
                    <path
                      d={`M50 ${445 - (value / props.ceiling) * 340}H870`}
                      stroke="currentColor"
                      stroke-opacity=".16"
                    />
                    <text x="15" y={450 - (value / props.ceiling) * 340} class="chart-axis">
                      {value}¢
                    </text>
                  </g>
                )}
              </For>
              <For each={ranked()}>
                {(state, i) => (
                  <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                    <rect
                      class="data-mark"
                      x={54 + i() * 15.7}
                      y={445 - ratio(state.observation?.price) * 340}
                      width="12"
                      height={Math.max(2, ratio(state.observation?.price) * 340)}
                      fill={
                        props.selected === state.id
                          ? 'var(--accent)'
                          : color(state.observation?.price)
                      }
                    />
                    <text
                      transform={`translate(${63 + i() * 15.7} 462) rotate(90)`}
                      class="chart-bar-label"
                    >
                      {state.id}
                    </text>
                  </StateMark>
                )}
              </For>
              <text x="50" y="45" class="chart-big-annotation">
                51 PRICE TAGS*
              </text>
              <text x="52" y="66" class="chart-micro">
                *51 GEOGRAPHIES: 50 STATES AND THE DISTRICT OF COLUMBIA
              </text>
              <text x="52" y="514" class="chart-micro">
                EXPENSIVE ← ELECTRICITY PRICE RANK → LESS EXPENSIVE
              </text>
            </Match>
            <Match when={props.design.chart === 'city'}>
              <path
                d="M0 420 450 160 900 420M0 480 450 220 900 480M0 540 450 280 900 540M0 360 450 100 900 360"
                fill="none"
                stroke="var(--accent)"
                stroke-opacity=".13"
              />
              <For each={props.states}>
                {(state, i) => {
                  const row = () => Math.floor(i() / CITY_COLUMNS);
                  const col = () => i() % CITY_COLUMNS;
                  const x = () => CITY_FIRST_COLUMN_X + (col() + row() / 2) * CITY_COLUMN_PITCH;
                  const baseY = () => 205 + row() * CITY_ROW_PITCH - col() * 5;
                  const height = () => 15 + ratio(state.observation?.price) * 190;
                  const roofY = () => baseY() - height();
                  return (
                    <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                      <path
                        d={`M${x()},${baseY()}v${-height()}l${CITY_ROOF_FRONT_WIDTH} ${CITY_ROOF_FRONT_DROP}v${height()}Z`}
                        fill={color(state.observation?.price)}
                        opacity=".65"
                        stroke="var(--ink)"
                        stroke-opacity=".4"
                      />
                      <path
                        d={`M${x() + CITY_ROOF_FRONT_WIDTH},${baseY() + CITY_ROOF_FRONT_DROP}v${-height()}l${CITY_ROOF_SIDE_WIDTH} ${-CITY_ROOF_BACK_RISE}v${height()}Z`}
                        fill={color(state.observation?.price)}
                        opacity=".3"
                        stroke="var(--ink)"
                        stroke-opacity=".35"
                      />
                      <path
                        class="data-mark"
                        d={`M${x()},${roofY()}l${CITY_ROOF_SIDE_WIDTH} ${-CITY_ROOF_BACK_RISE} ${CITY_ROOF_FRONT_WIDTH} ${CITY_ROOF_FRONT_DROP} ${-CITY_ROOF_SIDE_WIDTH} ${CITY_ROOF_BACK_RISE}Z`}
                        fill={color(state.observation?.price)}
                        stroke="var(--ink)"
                        stroke-width=".8"
                      />
                      <path
                        d={`M${x() + 7} ${roofY() + 20}l17 8M${x() + 7} ${roofY() + 29}l17 8`}
                        stroke="var(--accent)"
                        stroke-opacity=".7"
                      />
                      <text
                        x={x() + (CITY_ROOF_FRONT_WIDTH + CITY_ROOF_SIDE_WIDTH) / 2}
                        y={roofY() + (CITY_ROOF_FRONT_DROP - CITY_ROOF_BACK_RISE) / 2}
                        text-anchor="middle"
                        dominant-baseline="central"
                        class="chart-city-label"
                      >
                        {state.id}
                      </text>
                    </StateMark>
                  );
                }}
              </For>
              <text x="54" y="60" class="chart-micro">
                BUILD 051 / QUARTERLY EDITION
              </text>
              <text x="56" y="494" class="chart-city-message">
                NO COINS REQUIRED.
              </text>
              <text x="720" y="494" class="chart-micro">
                PRESS A TOWER →
              </text>
            </Match>
            <Match when={props.design.chart === 'circuit'}>
              <rect width="900" height="540" fill="url(#design-engineering-grid)" />
              <For each={props.states}>
                {(state) => {
                  const position = grid[state.id];
                  const x = () => 62 + position[0] * 64;
                  const y = () => 37 + position[1] * 57;
                  return (
                    <g>
                      <path
                        d={`M${x() + 26} ${y() + 24}h37v57h27`}
                        fill="none"
                        stroke="var(--ink)"
                        stroke-opacity=".15"
                        stroke-width="1"
                      />
                      <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                        <rect
                          class="data-mark"
                          x={x()}
                          y={y()}
                          width="54"
                          height="46"
                          rx="2"
                          fill={color(state.observation?.price)}
                          fill-opacity=".75"
                          stroke="var(--ink)"
                          stroke-width=".8"
                        />
                        <text
                          x={x() + 7}
                          y={y() + 16}
                          class="chart-circuit-state"
                          style={{
                            fill: contrastInk(color(state.observation?.price)),
                          }}
                        >
                          {state.id}
                        </text>
                        <text
                          x={x() + 7}
                          y={y() + 35}
                          class="chart-circuit-value"
                          style={{
                            fill: contrastInk(color(state.observation?.price)),
                          }}
                        >
                          {price(state.observation?.price)}
                        </text>
                        <circle cx={x() + 46} cy={y() + 8} r="2" fill="var(--ink)" />
                      </StateMark>
                    </g>
                  );
                }}
              </For>
              <text x="62" y="521" class="chart-micro">
                FIG. 051-A / GEOGRAPHIC ARRANGEMENT APPROXIMATE / INSETS: AK + HI
              </text>
            </Match>
            <Match when={props.design.chart === 'thermal'}>
              <For each={[95, 145, 195, 245]}>
                {(radius) => (
                  <g>
                    <circle
                      cx="450"
                      cy="270"
                      r={radius}
                      stroke="currentColor"
                      stroke-opacity=".18"
                      fill="none"
                    />
                  </g>
                )}
              </For>
              <For each={props.states}>
                {(state, i) => {
                  const a = () => (i() / props.states.length) * Math.PI * 2 - Math.PI / 2;
                  const radius = () => 75 + ratio(state.observation?.price) * 170;
                  const from = () => [450 + Math.cos(a()) * 75, 270 + Math.sin(a()) * 75];
                  const to = () => [450 + Math.cos(a()) * radius(), 270 + Math.sin(a()) * radius()];
                  const label = () => [450 + Math.cos(a()) * 265, 270 + Math.sin(a()) * 265];
                  return (
                    <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                      <path
                        class="data-mark"
                        d={`M${from().join(' ')}L${to().join(' ')}`}
                        stroke={color(state.observation?.price)}
                        stroke-width="13"
                        stroke-linecap="butt"
                      />
                      <text
                        x={label()[0]}
                        y={label()[1] + 3}
                        text-anchor="middle"
                        class="chart-state-label"
                      >
                        {state.id}
                      </text>
                    </StateMark>
                  );
                }}
              </For>
              <circle cx="450" cy="270" r="61" fill="var(--paper)" />
              <text x="450" y="256" text-anchor="middle" class="chart-micro">
                U.S. READING
              </text>
              <text x="450" y="290" text-anchor="middle" class="chart-center-number">
                {price(nationalPrice())}
              </text>
              <g pointer-events="none">
                <For each={[95, 145, 195, 245]}>
                  {(radius) => (
                    <g>
                      <path
                        d={`M${450 + radius * 0.707} ${270 - radius * 0.707}H768`}
                        stroke="currentColor"
                        stroke-opacity=".22"
                        stroke-dasharray="2 4"
                      />
                      <text x="779" y={274 - radius * 0.707} class="chart-axis">
                        {Math.round(((radius - 75) / 170) * props.ceiling)}¢
                      </text>
                    </g>
                  )}
                </For>
              </g>
            </Match>
            <Match when={props.design.chart === 'scatter'}>
              <For each={[0.01, 0.1, 1, 10, 100, 1000]}>
                {(value) => {
                  const x = 95 + ((Math.log10(value) + 2) / 5) * 720;
                  return (
                    <g>
                      <path
                        d={`M${x} 55V455`}
                        stroke="currentColor"
                        stroke-opacity=".12"
                        stroke-dasharray="2 6"
                      />
                      <text x={x} y="483" text-anchor="middle" class="chart-axis">
                        {value} TWh
                      </text>
                    </g>
                  );
                }}
              </For>
              <For each={[0, 15, 30, 45, 60]}>
                {(value) => (
                  <g>
                    <path
                      d={`M95 ${455 - (value / props.ceiling) * 385}H815`}
                      stroke="currentColor"
                      stroke-opacity=".12"
                      stroke-dasharray="2 6"
                    />
                    <text x="50" y={459 - (value / props.ceiling) * 385} class="chart-axis">
                      {value}¢
                    </text>
                  </g>
                )}
              </For>
              <For
                each={props.states.filter(
                  (state) =>
                    state.observation?.price != null &&
                    state.observation.sales != null &&
                    state.observation.sales > 0,
                )}
              >
                {(state) => {
                  const x = () =>
                    95 +
                    (Math.max(
                      0,
                      Math.min(
                        5,
                        Math.log10(Math.max(0.01, (state.observation?.sales ?? 0) / 1000)) + 2,
                      ),
                    ) /
                      5) *
                      720;
                  const y = () => 455 - ratio(state.observation?.price) * 385;
                  const radius = () => 5 + Math.sqrt((state.observation?.sales ?? 0) / 1000) * 2;
                  return (
                    <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                      <circle
                        cx={x()}
                        cy={y()}
                        r={radius() + 7}
                        fill={color(state.observation?.price)}
                        opacity=".08"
                      />
                      <circle
                        class="data-mark"
                        cx={x()}
                        cy={y()}
                        r={radius()}
                        fill={color(state.observation?.price)}
                        fill-opacity=".85"
                        stroke="var(--accent)"
                        stroke-opacity=".7"
                      />
                      <Show
                        when={props.selected === state.id || (state.observation?.price ?? 0) > 28}
                      >
                        <text
                          x={x()}
                          y={y() - radius() - 9}
                          text-anchor="middle"
                          class="chart-state-label"
                        >
                          {state.id}
                        </text>
                      </Show>
                    </StateMark>
                  );
                }}
              </For>
              <text x="95" y="520" class="chart-micro">
                ELECTRICITY SOLD / LOGARITHMIC SCALE
              </text>
              <text x="95" y="30" class="chart-micro">
                ↑ PRICE / CENTS PER kWh
              </text>
              <text x="815" y="30" text-anchor="end" class="chart-micro">
                {
                  props.states.filter(
                    (state) =>
                      state.observation?.price == null ||
                      state.observation.sales == null ||
                      state.observation.sales <= 0,
                  ).length
                }{' '}
                STATES WITH UNPLOTTABLE DATA OMITTED
              </text>
            </Match>
            <Match when={props.design.chart === 'signal'}>
              <rect
                x="65"
                y="48"
                width="770"
                height="400"
                fill="url(#design-engineering-grid)"
                stroke="currentColor"
                stroke-opacity=".2"
              />
              <For each={[0, 15, 30, 45, 60]}>
                {(value) => (
                  <g>
                    <path
                      d={`M65 ${448 - (value / props.ceiling) * 370}H835`}
                      stroke="currentColor"
                      stroke-opacity=".18"
                    />
                    <text x="18" y={453 - (value / props.ceiling) * 370} class="chart-axis">
                      {value}¢
                    </text>
                  </g>
                )}
              </For>
              <path
                d={historyPath(props.nationalHistory, 65, 448, 770, 370)}
                fill="none"
                stroke="var(--secondary-signal)"
                stroke-width="2"
                stroke-dasharray="6 6"
              />
              <path
                d={historyPath(props.history, 65, 448, 770, 370)}
                fill="none"
                stroke="var(--accent)"
                stroke-width="3"
              />
              <For each={props.history}>
                {(row, i) => (
                  <g {...quarterEvents(row.period)}>
                    <rect
                      x={65 + (i() / Math.max(1, props.history.length - 1)) * 770 - 7}
                      y="48"
                      width="14"
                      height="400"
                      fill="transparent"
                    />
                    <Show when={row.price !== null}>
                      <circle
                        cx={65 + (i() / Math.max(1, props.history.length - 1)) * 770}
                        cy={448 - ratio(row.price) * 370}
                        r={props.period === row.period ? 6 : 2.5}
                        fill="var(--accent)"
                      />
                    </Show>
                    <Show when={props.period === row.period}>
                      <path
                        d={`M${65 + (i() / Math.max(1, props.history.length - 1)) * 770} 48V448`}
                        stroke="var(--accent)"
                        stroke-width="1"
                        stroke-dasharray="3 5"
                      />
                    </Show>
                    <title>
                      {quarter(row.period)}: {price(row.price)} ¢/kWh
                    </title>
                  </g>
                )}
              </For>
              <text x="65" y="478" class="chart-axis">
                2015
              </text>
              <text x="805" y="478" class="chart-axis">
                {props.periods.at(-1)?.slice(0, 4)}
              </text>
              <text x="65" y="516" class="chart-micro">
                ● {props.selected} SIGNAL
              </text>
              <text x="240" y="516" class="chart-micro">
                ┄ U.S. SIGNAL
              </text>
              <text x="665" y="516" class="chart-micro">
                SELECT A QUARTER TO TUNE
              </text>
            </Match>
            <Match when={props.design.chart === 'lollipops'}>
              <For each={[0, 15, 30, 45, 60]}>
                {(value) => (
                  <g>
                    <path
                      d={`M${140 + (value / props.ceiling) * 635} 30V${candyAxis() - 18}`}
                      stroke="currentColor"
                      stroke-opacity=".1"
                      stroke-dasharray="2 5"
                    />
                    <text
                      x={140 + (value / props.ceiling) * 635}
                      y={candyAxis()}
                      text-anchor="middle"
                      class="chart-axis"
                    >
                      {value}¢
                    </text>
                  </g>
                )}
              </For>
              <For each={candyStates()}>
                {(state, i) => {
                  const x = () => 140 + ratio(state.observation?.price) * 635;
                  const y = () => 50 + i() * 38;
                  return (
                    <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                      <text x="92" y={y() + 5} text-anchor="end" class="chart-lollipop-state">
                        {state.id}
                      </text>
                      <path d={`M140 ${y()}H${x()}`} stroke="currentColor" stroke-width="2" />
                      <circle
                        class="data-mark"
                        cx={x()}
                        cy={y()}
                        r="14"
                        fill={
                          props.selected === state.id
                            ? 'var(--accent)'
                            : color(state.observation?.price)
                        }
                        stroke="currentColor"
                        stroke-width="1.5"
                      />
                      <text x={x() + 24} y={y() + 4} class="chart-lollipop-value">
                        {price(state.observation?.price)}¢
                      </text>
                    </StateMark>
                  );
                }}
              </For>
            </Match>
            <Match when={props.design.chart === 'ridges'}>
              <For
                each={[
                  props.selected,
                  ...['HI', 'CA', 'NY', 'TX', 'WA', 'FL'].filter((id) => id !== props.selected),
                ].slice(0, 6)}
              >
                {(id, i) => {
                  const rows = () =>
                    props.allHistory
                      .filter((row) => row.state === id)
                      .sort((a, b) => a.period.localeCompare(b.period));
                  const baseline = () => 150 + i() * 66;
                  const d = () => historyPath(rows(), 100, baseline(), 700, 110);
                  const state = () => props.states.find((state) => state.id === id)!;
                  return (
                    <g>
                      <path
                        d={`M100 ${baseline()}H800`}
                        stroke="currentColor"
                        stroke-opacity=".14"
                      />
                      <StateMark
                        state={state()}
                        selected={props.selected}
                        onSelect={props.onSelect}
                      >
                        <path
                          class="data-mark"
                          d={`${d()}L800 ${baseline()}H100Z`}
                          fill={color(state().observation?.price)}
                          fill-opacity=".58"
                          stroke={
                            props.selected === id ? 'var(--ink)' : color(state().observation?.price)
                          }
                          stroke-width="1.5"
                        />
                        <text x="55" y={baseline() - 5} class="chart-ridge-label">
                          {id}
                        </text>
                        <text x="820" y={baseline() - 5} class="chart-axis">
                          {price(state().observation?.price)}¢
                        </text>
                      </StateMark>
                    </g>
                  );
                }}
              </For>
              <text x="100" y="515" class="chart-axis">
                2015
              </text>
              <text x="765" y="515" class="chart-axis">
                {props.periods.at(-1)?.slice(0, 4)}
              </text>
              <text x="100" y="35" class="chart-micro">
                SIX HORIZONS / EACH RIDGE STARTS AT ZERO
              </text>
            </Match>
            <Match when={props.design.chart === 'calendar'}>
              <For each={Array.from(new Set(props.periods.map((period) => period.slice(0, 4))))}>
                {(year, i) => (
                  <text x={78 + i() * 64} y="69" text-anchor="middle" class="chart-calendar-year">
                    {year.slice(2)}
                  </text>
                )}
              </For>
              <For each={[1, 2, 3, 4]}>
                {(q) => (
                  <text x="20" y={132 + (q - 1) * 74} class="chart-axis">
                    Q{q}
                  </text>
                )}
              </For>
              <For each={props.history}>
                {(row) => {
                  const year = Number(row.period.slice(0, 4)) - 2015;
                  const q = Number(row.period.at(-1));
                  const x = 48 + year * 64;
                  const y = 95 + (q - 1) * 74;
                  return (
                    <g
                      {...quarterEvents(row.period)}
                      class="design-quarter-mark"
                      aria-pressed={props.period === row.period}
                    >
                      <rect
                        class="data-mark"
                        x={x}
                        y={y}
                        width="58"
                        height="65"
                        fill={color(row.price)}
                        stroke={props.period === row.period ? 'var(--ink)' : 'var(--paper)'}
                        stroke-width={props.period === row.period ? 3 : 1}
                      />
                      <text
                        x={x + 29}
                        y={y + 37}
                        text-anchor="middle"
                        class="chart-calendar-value"
                        style={{ fill: contrastInk(color(row.price)) }}
                      >
                        {price(row.price)}
                      </text>
                      <title>
                        {quarter(row.period)}: {price(row.price)} ¢/kWh
                      </title>
                    </g>
                  );
                }}
              </For>
              <text x="48" y="424" class="chart-micro">
                {props.selected} / QUARTERLY RECORD / NOMINAL CENTS PER kWh
              </text>
              <text x="48" y="449" class="chart-micro">
                UNSHADED FUTURE QUARTERS HAVE NOT YET BEEN REPORTED.
              </text>
            </Match>
          </Switch>
        </svg>
      }
    >
      <PortraitCharts {...props} />
    </Show>
  );
}
