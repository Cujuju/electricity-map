import { createMemo, For } from 'solid-js';
import { price, quarter } from '../data';
import type { Observation } from '../types';

export default function Spiral(props: {
  history: Observation[];
  national: Observation[];
  period: string;
  name: string;
  color: (value: number | null | undefined) => string;
  onPeriod: (period: string) => void;
  onHoverPeriod: (period: string | null) => void;
}) {
  const points = createMemo(() =>
    props.history.map((row, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI) / 2 + index * 0.065;
      const radius = 30 + index * 5.4;
      const us = props.national.find((national) => national.period === row.period);
      return {
        row,
        us,
        x: 525 + Math.cos(angle) * radius * 1.3,
        y: 326 + Math.sin(angle) * radius,
        nx: 525 + Math.cos(angle) * (radius - 8) * 1.3,
        ny: 326 + Math.sin(angle) * (radius - 8),
      };
    }),
  );
  return (
    <svg
      class="spiral-svg"
      data-label-cull
      viewBox="0 0 1050 660"
      aria-label={`Time spiral comparing ${props.name} with the U.S. Each step is a quarter, moving outward through time. Color and marker area indicate price. Solid dots are the selected state; hollow dots are U.S. totals.`}
    >
      <defs>
        <radialGradient id="spiral-glow">
          <stop stop-color="var(--accent)" stop-opacity=".10" />
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="525" cy="326" rx="390" ry="290" fill="url(#spiral-glow)" />
      <For each={[80, 140, 200, 260]}>
        {(radius) => (
          <ellipse
            cx="525"
            cy="326"
            rx={radius * 1.3}
            ry={radius}
            fill="none"
            stroke="var(--muted-ink)"
            stroke-opacity=".14"
            stroke-dasharray="2 6"
          />
        )}
      </For>
      <polyline
        points={points()
          .map((point) => `${point.nx},${point.ny}`)
          .join(' ')}
        fill="none"
        stroke="var(--ink)"
        stroke-opacity=".24"
        stroke-width="1"
        stroke-dasharray="3 4"
      />
      <For each={points()}>
        {(point, index) => {
          const next = () => points()[index() + 1];
          const selected = () => props.period === point.row.period;
          return (
            <g>
              <path
                d={next() ? `M${point.x} ${point.y}L${next().x} ${next().y}` : ''}
                stroke={props.color(point.row.price)}
                stroke-opacity=".55"
                stroke-width="1.5"
              />
              <circle
                cx={point.nx}
                cy={point.ny}
                r={point.us?.price == null ? 2 : 2 + Math.sqrt(point.us.price) * 0.65}
                fill="var(--paper)"
                stroke={props.color(point.us?.price)}
                stroke-opacity=".7"
              >
                <title>
                  U.S., {quarter(point.row.period)}: {price(point.us?.price)} ¢/kWh
                </title>
              </circle>
              <g
                role="button"
                tabindex="0"
                class="spiral-point"
                aria-label={`${quarter(point.row.period)}, ${props.name}, ${price(point.row.price)} cents per kilowatt-hour`}
                aria-pressed={selected()}
                onClick={() => props.onPeriod(point.row.period)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    props.onPeriod(point.row.period);
                  }
                }}
                onPointerEnter={() => props.onHoverPeriod(point.row.period)}
                onPointerLeave={() => props.onHoverPeriod(null)}
                onFocus={() => props.onHoverPeriod(point.row.period)}
                onBlur={() => props.onHoverPeriod(null)}
              >
                <circle cx={point.x} cy={point.y} r="19" fill="transparent" />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={selected() ? 16 : 0}
                  fill="none"
                  stroke="var(--ink)"
                  stroke-width="1"
                  stroke-dasharray="3 3"
                />
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={point.row.price == null ? 2 : 2 + Math.sqrt(point.row.price) * 1.1}
                  fill={props.color(point.row.price)}
                  stroke={selected() ? 'var(--ink)' : 'var(--paper)'}
                  stroke-width={selected() ? 2 : 1}
                />
                <title>
                  {quarter(point.row.period)}: {price(point.row.price)} ¢/kWh
                </title>
              </g>
              {point.row.period.endsWith('Q1') && (
                <text class="spiral-year" data-label x={point.x + 13} y={point.y - 12}>
                  {point.row.period.slice(0, 4)}
                </text>
              )}
            </g>
          );
        }}
      </For>
      <text class="spiral-origin" y="325" text-anchor="middle">
        <tspan x="525">2015</tspan>
        <tspan x="525" dy="1.2em">
          START
        </tspan>
      </text>
      <g class="spiral-key">
        <circle cx="49" cy="613" r="4" fill="var(--accent)" />
        <text x="62" y="617">
          {props.name.toUpperCase()}
        </text>
        <circle cx="255" cy="613" r="4" fill="none" stroke="var(--muted-ink)" />
        <text x="268" y="617">
          U.S. TOTAL
        </text>
      </g>
      <text class="map-inset-label" x="1010" y="617" text-anchor="end">
        CENTER → EDGE / 2015 → {props.history.at(-1)?.period.slice(0, 4)}
      </text>
    </svg>
  );
}
