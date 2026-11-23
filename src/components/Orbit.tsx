import { createMemo, For } from 'solid-js';
import { price } from '../data';
import type { StateDatum } from '../types';

const REGIONS = ['West', 'Midwest', 'South', 'Northeast'];
export default function Orbit(props: {
  states: StateDatum[];
  selected: string;
  color: (value: number | null | undefined) => string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const stars = createMemo(() => {
    const sorted = [...props.states].sort(
      (a, b) => REGIONS.indexOf(a.region) - REGIONS.indexOf(b.region) || a.id.localeCompare(b.id),
    );
    const maxSales = Math.max(1, ...sorted.map((state) => state.observation?.sales ?? 0));
    return sorted.map((state, i) => {
      const angle = -Math.PI / 2 + (i / sorted.length) * Math.PI * 2;
      const radius =
        state.observation?.price == null ? 300 : 40 + Math.min(50, state.observation.price) * 5;
      return {
        ...state,
        x: 525 + Math.cos(angle) * radius * 1.28,
        y: 325 + Math.sin(angle) * radius,
        size: 4 + Math.sqrt((state.observation?.sales ?? 0) / maxSales) * 15,
      };
    });
  });
  return (
    <svg
      class="orbit-svg"
      data-label-cull
      viewBox="0 0 1050 660"
      aria-label="Price constellation. Distance from the center indicates price; bubble area indicates electricity sales. State order follows Census regions; connections are visual guides, not transmission lines."
    >
      <defs>
        <radialGradient id="orbit-glow">
          <stop stop-color="var(--accent)" stop-opacity=".12" />
          <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="525" cy="325" rx="410" ry="310" fill="url(#orbit-glow)" />
      <For each={[10, 20, 30, 40, 50]}>
        {(value) => (
          <g>
            <ellipse
              cx="525"
              cy="325"
              rx={(40 + value * 5) * 1.28}
              ry={40 + value * 5}
              fill="none"
              stroke="var(--muted-ink)"
              stroke-opacity=".22"
              stroke-dasharray={value === 50 ? '2 7' : undefined}
            />
            <text class="orbit-axis" data-label x="532" y={325 - (40 + value * 5) + 15}>
              {value}¢
            </text>
          </g>
        )}
      </For>
      <path
        d="M130 325H920M525 20V630"
        stroke="var(--muted-ink)"
        stroke-opacity=".14"
        stroke-dasharray="2 8"
      />
      <For each={REGIONS}>
        {(region) => {
          const members = () => stars().filter((state) => state.region === region);
          return (
            <polyline
              points={members()
                .map((state) => `${state.x},${state.y}`)
                .join(' ')}
              fill="none"
              stroke="var(--muted-ink)"
              stroke-opacity=".22"
              stroke-width="1"
            />
          );
        }}
      </For>
      <For each={stars()}>
        {(star) => (
          <g>
            <line
              x1="525"
              y1="325"
              x2={star.x}
              y2={star.y}
              stroke={props.color(star.observation?.price)}
              stroke-opacity={props.selected === star.id ? '.5' : '0'}
              stroke-dasharray="3 5"
              pointer-events="none"
            />
            <g
              class="orbit-star"
              role="button"
              tabindex="0"
              aria-label={`${star.name}, ${price(star.observation?.price)} cents per kilowatt-hour`}
              aria-pressed={props.selected === star.id}
              onClick={() => props.onSelect(star.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  props.onSelect(star.id);
                }
              }}
              onPointerEnter={() => props.onHover(star.id)}
              onPointerLeave={() => props.onHover(null)}
              onFocus={() => props.onHover(star.id)}
              onBlur={() => props.onHover(null)}
            >
              <circle
                cx={star.x}
                cy={star.y}
                r={star.size + 9}
                fill={props.color(star.observation?.price)}
                fill-opacity={props.selected === star.id ? '.13' : '.04'}
                stroke={props.selected === star.id ? 'var(--ink)' : 'transparent'}
                stroke-opacity=".8"
                stroke-dasharray="2 3"
              />
              <circle
                cx={star.x}
                cy={star.y}
                r={star.size}
                fill={props.color(star.observation?.price)}
                fill-opacity=".86"
                stroke={props.color(star.observation?.price)}
              />
              <circle cx={star.x} cy={star.y} r="24" fill="transparent" />
              <text x={star.x} y={star.y - star.size - 9} text-anchor="middle" class="orbit-label" data-label>
                {star.id}
              </text>
              <title>
                {star.name}: {price(star.observation?.price)} ¢/kWh
              </title>
            </g>
          </g>
        )}
      </For>
      <circle cx="525" cy="325" r="27" fill="var(--surface)" stroke="var(--line-color)" />
      <path d="m529 307-14 20h10l-4 17 15-23h-10z" fill="var(--accent)" />
      <text class="region-label" data-label x="800" y="62">
        WEST
      </text>
      <text class="region-label" data-label x="890" y="563">
        MIDWEST
      </text>
      <text class="region-label" data-label x="135" y="563">
        SOUTH
      </text>
      <text class="region-label" data-label x="88" y="100">
        NORTHEAST
      </text>
      {/* em line spacing tracks the screen-pixel font size at any chart width. */}
      <text class="map-inset-label" y="612">
        <tspan x="46">FARTHER OUT = HIGHER PRICE</tspan>
        <tspan x="46" dy="1.4em">
          LARGER AREA = MORE ELECTRICITY SOLD
        </tspan>
      </text>
    </svg>
  );
}
