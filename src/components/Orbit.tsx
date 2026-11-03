import { createMemo, For } from 'solid-js';
import { price, priceColor } from '../data';
import type { StateDatum } from '../types';

const REGIONS = ['West', 'Midwest', 'South', 'Northeast'];
export default function Orbit(props: {
  states: StateDatum[];
  selected: string;
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
      viewBox="0 0 1050 660"
      aria-label="Price constellation. Distance from the center indicates price; bubble area indicates electricity sales. State order follows Census regions; connections are visual guides, not transmission lines."
    >
      <defs>
        <radialGradient id="orbit-glow">
          <stop stop-color="#c6f882" stop-opacity=".12" />
          <stop offset="1" stop-color="#c6f882" stop-opacity="0" />
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
              stroke="#8ea58f"
              stroke-opacity=".19"
              stroke-dasharray={value === 50 ? '2 7' : undefined}
            />
            <text class="orbit-axis" x="532" y={325 - (40 + value * 5) + 15}>
              {value}¢
            </text>
          </g>
        )}
      </For>
      <path
        d="M130 325H920M525 20V630"
        stroke="#88a38b"
        stroke-opacity=".1"
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
              stroke="#a2c08d"
              stroke-opacity=".18"
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
              stroke={priceColor(star.observation?.price)}
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
                fill={priceColor(star.observation?.price)}
                fill-opacity={props.selected === star.id ? '.13' : '.04'}
                stroke={props.selected === star.id ? '#e2f9bc' : 'transparent'}
                stroke-opacity=".8"
                stroke-dasharray="2 3"
              />
              <circle
                cx={star.x}
                cy={star.y}
                r={star.size}
                fill={priceColor(star.observation?.price)}
                fill-opacity=".86"
                stroke={priceColor(star.observation?.price)}
              />
              <circle cx={star.x} cy={star.y} r="24" fill="transparent" />
              <text x={star.x} y={star.y - star.size - 9} text-anchor="middle" class="orbit-label">
                {star.id}
              </text>
              <title>
                {star.name}: {price(star.observation?.price)} ¢/kWh
              </title>
            </g>
          </g>
        )}
      </For>
      <circle cx="525" cy="325" r="27" fill="#16251c" stroke="#8aa374" stroke-opacity=".4" />
      <path d="m529 307-14 20h10l-4 17 15-23h-10z" fill="#d4fa66" />
      <text class="region-label" x="800" y="62">
        WEST
      </text>
      <text class="region-label" x="890" y="563">
        MIDWEST
      </text>
      <text class="region-label" x="135" y="563">
        SOUTH
      </text>
      <text class="region-label" x="88" y="100">
        NORTHEAST
      </text>
      <text class="map-inset-label" x="46" y="626">
        FARTHER OUT = HIGHER PRICE · LARGER AREA = MORE ELECTRICITY SOLD
      </text>
    </svg>
  );
}
