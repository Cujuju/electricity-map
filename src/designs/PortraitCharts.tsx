import { createMemo, For, Match, Show, Switch } from 'solid-js';
import { price, quarter } from '../data';
import type { Observation } from '../types';
import type { ChartProps } from './DesignCharts';
import { interpolateColor } from './catalog';
import { StateMark, quarterEvents } from './ChartMark';

const CITY_COLUMNS = 6;
const CITY_FIRST_BASELINE = 98;
const CITY_ROW_PITCH = 84;
const CITY_ROOF_FRONT_WIDTH = 23;
const CITY_ROOF_SIDE_WIDTH = 13;
const CITY_ROOF_BACK_RISE = 8;
const CITY_FOOTER_GAP = 30;
const CITY_BOTTOM_MARGIN = 16;

export default function PortraitCharts(props: ChartProps) {
  const ratio = (value: number | null | undefined) =>
    Math.min(1, Math.max(0, (value ?? 0) / props.ceiling));
  const color = (value: number | null | undefined) =>
    interpolateColor(value, props.design, props.ceiling);
  const ranked = createMemo(() =>
    [...props.states].sort((a, b) => (b.observation?.price ?? -1) - (a.observation?.price ?? -1)),
  );
  const cityFooterY = () =>
    CITY_FIRST_BASELINE +
    (Math.ceil(props.states.length / CITY_COLUMNS) - 1) * CITY_ROW_PITCH +
    CITY_FOOTER_GAP;
  const height = () =>
    props.design.chart === 'bars'
      ? 590
      : props.design.chart === 'city'
        ? cityFooterY() + CITY_BOTTOM_MARGIN
        : props.design.chart === 'circuit'
          ? 520
          : props.design.chart === 'calendar'
            ? 480
            : props.design.chart === 'ridges'
              ? 520
              : props.design.chart === 'lollipops'
                ? 510
                : 400;
  const around = (i: number, r: number) => {
    const a = (i / props.states.length) * Math.PI * 2 - Math.PI / 2;
    return [180 + Math.cos(a) * r, 190 + Math.sin(a) * r];
  };
  const line = (
    rows: Observation[],
    bottom: number,
    amplitude: number,
    start = 48,
    width = 280,
  ) => {
    let gap = true;
    return rows
      .map((row, i) => {
        if (row.price === null) {
          gap = true;
          return '';
        }
        const d = `${gap ? 'M' : 'L'}${start + (i / Math.max(1, rows.length - 1)) * width},${bottom - ratio(row.price) * amplitude}`;
        gap = false;
        return d;
      })
      .join(' ');
  };
  const national = () => props.nationalHistory.find((row) => row.period === props.period)?.price;
  const popStates = createMemo(() => {
    const top = ranked().slice(0, 11);
    return top.some((state) => state.id === props.selected)
      ? top
      : [...top, props.states.find((state) => state.id === props.selected)!];
  });
  return (
    <svg
      class={`design-chart portrait-chart chart-${props.design.chart}`}
      viewBox={`0 0 360 ${height()}`}
      width="360"
      height={height()}
      data-chart-compact="true"
      role="group"
      aria-label={`${props.design.chartTitle}. Phone layout. ${props.design.encoding}`}
    >
      <Switch>
        <Match when={props.design.chart === 'petals'}>
          <For each={[80, 115, 145]}>
            {(radius) => (
              <circle
                cx="180"
                cy="190"
                r={radius}
                fill="none"
                stroke="currentColor"
                stroke-opacity=".13"
                stroke-dasharray="2 5"
              />
            )}
          </For>
          <For each={props.states}>
            {(state, i) => {
              const length = () => 25 + ratio(state.observation?.price) * 78;
              const label = () => around(i(), 158);
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <path
                    class="data-mark"
                    d={`M177,142Q169,${142 - length() * 0.6} 180,${142 - length()}Q191,${142 - length() * 0.6} 183,142Z`}
                    transform={`rotate(${(i() / props.states.length) * 360} 180 190)`}
                    fill={color(state.observation?.price)}
                    stroke="var(--paper)"
                    stroke-width=".8"
                  />
                  <text
                    x={label()[0]}
                    y={label()[1] + 4}
                    text-anchor="middle"
                    class="portrait-state-code"
                    data-readable="true"
                  >
                    {state.id}
                  </text>
                </StateMark>
              );
            }}
          </For>
          <circle
            cx="180"
            cy="190"
            r="47"
            fill="var(--paper)"
            stroke="currentColor"
            stroke-width=".8"
          />
          <text x="180" y="176" text-anchor="middle" class="portrait-note">
            U.S. PRICE
          </text>
          <text x="180" y="207" text-anchor="middle" class="portrait-center">
            {price(national())}
          </text>
          <text x="180" y="224" text-anchor="middle" class="portrait-note">
            ¢ / kWh
          </text>
          <text x="180" y="383" text-anchor="middle" class="portrait-note">
            51 PETALS / ALPHABETICAL CLOCKWISE
          </text>
        </Match>
        <Match when={props.design.chart === 'bars'}>
          <text x="16" y="22" class="portrait-note">
            01—26 / HIGHER
          </text>
          <text x="198" y="22" class="portrait-note">
            27—51 / LOWER
          </text>
          <For each={ranked()}>
            {(state, i) => {
              const col = () => Math.floor(i() / 26);
              const row = () => i() % 26;
              const x = () => 16 + col() * 182;
              const y = () => 46 + row() * 20;
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <text x={x()} y={y() + 4} class="portrait-state-code" data-readable="true">
                    {state.id}
                  </text>
                  <rect
                    class="data-mark"
                    x={x() + 29}
                    y={y() - 7}
                    width={Math.max(2, ratio(state.observation?.price) * 91)}
                    height="12"
                    fill={
                      props.selected === state.id
                        ? 'var(--accent)'
                        : color(state.observation?.price)
                    }
                  />
                  <text
                    x={x() + 143}
                    y={y() + 4}
                    text-anchor="end"
                    class="portrait-value"
                    data-readable="true"
                  >
                    {price(state.observation?.price)}
                  </text>
                </StateMark>
              );
            }}
          </For>
          <text x="16" y="579" class="portrait-note">
            RANKED PRICE / CENTS PER kWh
          </text>
        </Match>
        <Match when={props.design.chart === 'city'}>
          <text x="24" y="23" class="portrait-note">
            CITY INVENTORY / 51 STATE TOWERS
          </text>
          <For each={props.states}>
            {(state, i) => {
              const x = () => 24 + (i() % CITY_COLUMNS) * 52;
              const y = () => CITY_FIRST_BASELINE + Math.floor(i() / CITY_COLUMNS) * CITY_ROW_PITCH;
              const h = () => 10 + ratio(state.observation?.price) * 45;
              const roofY = () => y() - h();
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <path
                    d={`M${x()},${y()}v${-h()}l${CITY_ROOF_FRONT_WIDTH} 9v${h()}Z`}
                    fill={color(state.observation?.price)}
                    fill-opacity=".8"
                    stroke="var(--ink)"
                    stroke-width=".6"
                  />
                  <path
                    d={`M${x() + CITY_ROOF_FRONT_WIDTH},${y() + 9}v${-h()}l${CITY_ROOF_SIDE_WIDTH} ${-CITY_ROOF_BACK_RISE}v${h()}Z`}
                    fill={color(state.observation?.price)}
                    fill-opacity=".4"
                  />
                  <path
                    class="data-mark"
                    d={`M${x()},${roofY()}l${CITY_ROOF_SIDE_WIDTH} ${-CITY_ROOF_BACK_RISE} ${CITY_ROOF_FRONT_WIDTH} 9 ${-CITY_ROOF_SIDE_WIDTH} ${CITY_ROOF_BACK_RISE}Z`}
                    fill={color(state.observation?.price)}
                    stroke="var(--ink)"
                    stroke-width=".8"
                  />
                  <text
                    x={x() + (CITY_ROOF_FRONT_WIDTH + CITY_ROOF_SIDE_WIDTH) / 2}
                    y={roofY() - CITY_ROOF_BACK_RISE}
                    text-anchor="middle"
                    class="portrait-state-code"
                    data-readable="true"
                  >
                    {state.id}
                  </text>
                </StateMark>
              );
            }}
          </For>
          <text x="24" y={cityFooterY()} class="portrait-note">
            ALPHABETICAL / HEIGHT = PRICE
          </text>
        </Match>
        <Match when={props.design.chart === 'circuit'}>
          <text x="20" y="22" class="portrait-note">
            COMPONENT INVENTORY / ALPHABETICAL
          </text>
          <For each={props.states}>
            {(state, i) => {
              const x = () => 20 + (i() % 6) * 54;
              const y = () => 40 + Math.floor(i() / 6) * 51;
              const ink = () => (ratio(state.observation?.price) > 0.5 ? '#102c47' : '#effaff');
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <rect
                    class="data-mark"
                    x={x()}
                    y={y()}
                    width="49"
                    height="44"
                    rx="2"
                    fill={color(state.observation?.price)}
                    stroke="var(--ink)"
                    stroke-width=".7"
                  />
                  <text
                    x={x() + 6}
                    y={y() + 17}
                    class="portrait-state-code"
                    style={{ fill: ink(), stroke: 'none' }}
                    data-readable="true"
                  >
                    {state.id}
                  </text>
                  <text
                    x={x() + 6}
                    y={y() + 35}
                    class="portrait-value"
                    style={{ fill: ink() }}
                    data-readable="true"
                  >
                    {price(state.observation?.price)}
                  </text>
                </StateMark>
              );
            }}
          </For>
          <text x="20" y="514" class="portrait-note">
            EXACT PRICES / CENTS PER kWh
          </text>
        </Match>
        <Match when={props.design.chart === 'thermal'}>
          <For each={[65, 95, 125]}>
            {(r) => (
              <circle
                cx="180"
                cy="190"
                r={r}
                fill="none"
                stroke="currentColor"
                stroke-opacity=".18"
              />
            )}
          </For>
          <For each={props.states}>
            {(state, i) => {
              const a = () => (i() / props.states.length) * Math.PI * 2 - Math.PI / 2;
              const r = () => 52 + ratio(state.observation?.price) * 78;
              const from = () => around(i(), 52);
              const to = () => around(i(), r());
              const label = () => around(i(), 156);
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <path
                    class="data-mark"
                    d={`M${from().join(' ')}L${to().join(' ')}`}
                    stroke={color(state.observation?.price)}
                    stroke-width="6"
                  />
                  <text
                    x={label()[0]}
                    y={label()[1] + 4}
                    text-anchor="middle"
                    class="portrait-state-code"
                    data-readable="true"
                  >
                    {state.id}
                  </text>
                </StateMark>
              );
            }}
          </For>
          <circle cx="180" cy="190" r="43" fill="var(--paper)" />
          <text x="180" y="177" text-anchor="middle" class="portrait-note">
            U.S. READING
          </text>
          <text x="180" y="207" text-anchor="middle" class="portrait-center">
            {price(national())}
          </text>
          <text x="180" y="383" text-anchor="middle" class="portrait-note">
            RADIAL EXTENSION = PRICE / 0–{props.ceiling}¢
          </text>
        </Match>
        <Match when={props.design.chart === 'scatter'}>
          <For each={[0, 20, 40, 60]}>
            {(value) => (
              <g>
                <path
                  d={`M48 ${320 - (value / props.ceiling) * 265}H328`}
                  stroke="currentColor"
                  stroke-opacity=".16"
                  stroke-dasharray="2 4"
                />
                <text x="12" y={324 - (value / props.ceiling) * 265} class="portrait-value">
                  {value}¢
                </text>
              </g>
            )}
          </For>
          <For each={[0.01, 0.1, 1, 10, 100, 1000]}>
            {(value) => {
              const x = 48 + ((Math.log10(value) + 2) / 5) * 280;
              return (
                <g>
                  <path d={`M${x} 55V320`} stroke="currentColor" stroke-opacity=".1" />
                  <text x={x} y="345" text-anchor="middle" class="portrait-small">
                    {value}
                  </text>
                </g>
              );
            }}
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
              const x = () => 48 + ((Math.log10(state.observation!.sales! / 1000) + 2) / 5) * 280;
              const y = () => 320 - ratio(state.observation?.price) * 265;
              const r = () => 3 + Math.sqrt(state.observation!.sales! / 1000) * 1.3;
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <circle
                    class="data-mark"
                    cx={x()}
                    cy={y()}
                    r={r()}
                    fill={color(state.observation?.price)}
                    fill-opacity=".8"
                    stroke="var(--accent)"
                    stroke-width=".8"
                  />
                  <Show when={state.id === props.selected || (state.observation?.price ?? 0) > 40}>
                    <text
                      x={x()}
                      y={y() - r() - 10}
                      text-anchor="middle"
                      class="portrait-state-code"
                      data-readable="true"
                    >
                      {state.id}
                    </text>
                  </Show>
                </StateMark>
              );
            }}
          </For>
          <text x="48" y="28" class="portrait-note">
            PRICE / ¢ PER kWh
          </text>
          <text x="180" y="376" text-anchor="middle" class="portrait-note">
            SALES / TWh / LOG SCALE
          </text>
          <text x="180" y="394" text-anchor="middle" class="portrait-small">
            {
              props.states.filter(
                (state) =>
                  state.observation?.price == null ||
                  state.observation.sales == null ||
                  state.observation.sales <= 0,
              ).length
            }{' '}
            STATES WITH INCOMPLETE DATA OMITTED
          </text>
        </Match>
        <Match when={props.design.chart === 'signal'}>
          <For each={[0, 20, 40, 60]}>
            {(value) => (
              <g>
                <path
                  d={`M48 ${305 - (value / props.ceiling) * 245}H328`}
                  stroke="currentColor"
                  stroke-opacity=".2"
                />
                <text x="12" y={309 - (value / props.ceiling) * 245} class="portrait-value">
                  {value}¢
                </text>
              </g>
            )}
          </For>
          <path
            d={line(props.nationalHistory, 305, 245)}
            fill="none"
            stroke="var(--secondary-signal)"
            stroke-width="2"
            stroke-dasharray="5 5"
          />
          <path
            d={line(props.history, 305, 245)}
            fill="none"
            stroke="var(--accent)"
            stroke-width="2.3"
          />
          <For each={props.history}>
            {(row, i) => (
              <g {...quarterEvents(row.period, props.onPeriod)}>
                <rect
                  x={48 + (i() / Math.max(1, props.history.length - 1)) * 280 - 3}
                  y="50"
                  width="6"
                  height="255"
                  fill="transparent"
                />
                <Show when={row.price !== null}>
                  <circle
                    cx={48 + (i() / Math.max(1, props.history.length - 1)) * 280}
                    cy={305 - ratio(row.price) * 245}
                    r={props.period === row.period ? 4 : 1.8}
                    fill="var(--accent)"
                  />
                </Show>
                <Show when={props.period === row.period}>
                  <path
                    d={`M${48 + (i() / Math.max(1, props.history.length - 1)) * 280} 50V305`}
                    stroke="var(--accent)"
                    stroke-width="1"
                    stroke-dasharray="2 4"
                  />
                </Show>
                <title>
                  {quarter(row.period)}: {price(row.price)}¢
                </title>
              </g>
            )}
          </For>
          <text x="48" y="335" class="portrait-value" data-readable="true">
            2015
          </text>
          <text x="328" y="335" text-anchor="end" class="portrait-value" data-readable="true">
            {props.periods.at(-1)?.slice(0, 4)}
          </text>
          <text x="48" y="367" class="portrait-note">
            ● {props.selected} SIGNAL
          </text>
          <text x="205" y="367" class="portrait-note">
            ┄ U.S. SIGNAL
          </text>
          <text x="48" y="30" class="portrait-note">
            PRICE / NOMINAL CENTS PER kWh
          </text>
        </Match>
        <Match when={props.design.chart === 'lollipops'}>
          <For each={popStates()}>
            {(state, i) => {
              const x = () => 67 + ratio(state.observation?.price) * 216;
              const y = () => 38 + i() * 36;
              return (
                <StateMark state={state} selected={props.selected} onSelect={props.onSelect}>
                  <text x="22" y={y() + 4} class="portrait-state-code" data-readable="true">
                    {state.id}
                  </text>
                  <path d={`M67 ${y()}H${x()}`} stroke="currentColor" stroke-width="1.4" />
                  <circle
                    class="data-mark"
                    cx={x()}
                    cy={y()}
                    r="9"
                    fill={
                      props.selected === state.id
                        ? 'var(--accent)'
                        : color(state.observation?.price)
                    }
                    stroke="currentColor"
                    stroke-width="1.1"
                  />
                  <text x={x() + 18} y={y() + 4} class="portrait-value" data-readable="true">
                    {price(state.observation?.price)}¢
                  </text>
                </StateMark>
              );
            }}
          </For>
          <path
            d={`M67 ${popStates().length * 36 + 24}H283`}
            stroke="currentColor"
            stroke-opacity=".3"
          />
          <text x="67" y={popStates().length * 36 + 43} class="portrait-value">
            0¢
          </text>
          <text x="283" y={popStates().length * 36 + 43} text-anchor="end" class="portrait-value">
            {props.ceiling}¢
          </text>
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
              const baseline = () => 105 + i() * 65;
              const state = () => props.states.find((state) => state.id === id)!;
              return (
                <g>
                  <path d={`M80 ${baseline()}H328`} stroke="currentColor" stroke-opacity=".17" />
                  <StateMark state={state()} selected={props.selected} onSelect={props.onSelect}>
                    <path
                      class="data-mark"
                      d={`${line(rows(), baseline(), 70, 80, 248)}L328 ${baseline()}H80Z`}
                      fill={color(state().observation?.price)}
                      fill-opacity=".36"
                      stroke={
                        props.selected === id ? 'var(--ink)' : color(state().observation?.price)
                      }
                      stroke-width="1.6"
                    />
                    <text
                      x="14"
                      y={baseline() - 15}
                      class="portrait-state-code"
                      data-readable="true"
                    >
                      {id}
                    </text>
                    <text x="14" y={baseline() + 2} class="portrait-value">
                      {price(state().observation?.price)}¢
                    </text>
                  </StateMark>
                </g>
              );
            }}
          </For>
          <text x="48" y="25" class="portrait-note">
            SIX STATE HISTORIES / SHARED SCALE
          </text>
          <text x="48" y="492" class="portrait-value">
            2015
          </text>
          <text x="328" y="492" text-anchor="end" class="portrait-value">
            {props.periods.at(-1)?.slice(0, 4)}
          </text>
        </Match>
        <Match when={props.design.chart === 'calendar'}>
          <For each={[1, 2, 3, 4]}>
            {(q) => (
              <text
                x={90 + (q - 1) * 69}
                y="25"
                text-anchor="middle"
                class="portrait-state-code"
                data-readable="true"
              >
                Q{q}
              </text>
            )}
          </For>
          <For each={Array.from(new Set(props.periods.map((period) => period.slice(0, 4))))}>
            {(year, i) => (
              <g>
                <text x="12" y={61 + i() * 32} class="portrait-value">
                  {year.slice(2)}
                </text>
                <For each={[1, 2, 3, 4]}>
                  {(q) => {
                    const period = `${year}-Q${q}`;
                    const row = () => props.history.find((row) => row.period === period);
                    const x = 57 + (q - 1) * 69;
                    const y = 42 + i() * 32;
                    return (
                      <Show
                        when={row()}
                        fallback={
                          <rect
                            x={x}
                            y={y}
                            width="64"
                            height="27"
                            fill="none"
                            stroke="currentColor"
                            stroke-opacity=".14"
                            stroke-dasharray="2 3"
                          />
                        }
                      >
                        <g
                          {...quarterEvents(period, props.onPeriod)}
                          class="design-quarter-mark"
                          aria-pressed={props.period === period}
                        >
                          <rect
                            class="data-mark"
                            x={x}
                            y={y}
                            width="64"
                            height="27"
                            fill={color(row()?.price)}
                            stroke={props.period === period ? 'var(--ink)' : 'var(--paper)'}
                            stroke-width={props.period === period ? 2.5 : 1}
                          />
                          <text
                            x={x + 32}
                            y={y + 18}
                            text-anchor="middle"
                            class="portrait-value"
                            style={{ fill: ratio(row()?.price) > 0.65 ? '#fff9ec' : '#211f1a' }}
                            data-readable="true"
                          >
                            {price(row()?.price)}
                          </text>
                          <title>
                            {quarter(period)}: {price(row()?.price)}¢
                          </title>
                        </g>
                      </Show>
                    );
                  }}
                </For>
              </g>
            )}
          </For>
          <text x="14" y="454" class="portrait-note">
            {props.selected} / QUARTERLY PRICE / ¢ PER kWh
          </text>
          <text x="14" y="474" class="portrait-small">
            EMPTY CELLS = QUARTERS NOT YET REPORTED
          </text>
        </Match>
      </Switch>
    </svg>
  );
}
