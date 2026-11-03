import { createMemo, For } from 'solid-js';
import { geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, Geometry } from 'geojson';
import topology from '../assets/states.json';
import { priceColor, price } from '../data';
import type { StateDatum } from '../types';

const shapes = feature(
  topology as unknown as Topology<{ states: GeometryCollection }>,
  (topology as unknown as Topology<{ states: GeometryCollection }>).objects.states,
).features;
const path = geoPath().digits(1);

function simplified(feature: Feature<Geometry>) {
  const geometry = feature.geometry;
  if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return feature;
  const simplifyRing = (ring: number[][]) =>
    ring.filter(
      (point, i) =>
        i === 0 ||
        i === ring.length - 1 ||
        Math.hypot(point[0] - ring[i - 1][0], point[1] - ring[i - 1][1]) > 0.8 ||
        i % 4 === 0,
    );
  return {
    ...feature,
    geometry:
      geometry.type === 'Polygon'
        ? { ...geometry, coordinates: geometry.coordinates.map(simplifyRing) }
        : {
            ...geometry,
            coordinates: geometry.coordinates.map((polygon) => polygon.map(simplifyRing)),
          },
  } as Feature<Geometry>;
}
const geography = shapes.map((shape) => {
  const simple = simplified(shape);
  return {
    id: String(shape.id).padStart(2, '0'),
    d: path(simple) || '',
    center: path.centroid(simple),
  };
});

export default function Atlas(props: {
  states: StateDatum[];
  selected: string;
  relief: boolean;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const tiles = createMemo(() =>
    geography
      .map((shape) => ({ ...shape, datum: props.states.find((state) => state.fips === shape.id) }))
      .filter((tile) => tile.datum)
      .sort((a, b) => a.center[1] - b.center[1]),
  );
  const height = (value: number | null | undefined) =>
    props.relief && value != null ? Math.min(145, value * 2.7) : 0;
  return (
    <svg
      class="atlas-svg"
      viewBox="0 0 1050 660"
      aria-label="Raised geographic atlas. State elevation and color represent electricity price in cents per kilowatt-hour."
    >
      <defs>
        <pattern id="atlas-grid" width="44" height="44" patternUnits="userSpaceOnUse">
          <path
            d="M44 0H0V44"
            fill="none"
            stroke="#a0bba3"
            stroke-opacity=".10"
            stroke-width=".6"
          />
        </pattern>
        <radialGradient id="atlas-light">
          <stop stop-color="#c5e78d" stop-opacity=".09" />
          <stop offset="1" stop-color="#c5e78d" stop-opacity="0" />
        </radialGradient>
        <filter id="map-shadow" x="-20%" y="-50%" width="150%" height="200%">
          <feDropShadow dx="0" dy="18" stdDeviation="16" flood-opacity=".28" />
        </filter>
      </defs>
      <ellipse cx="530" cy="363" rx="490" ry="260" fill="url(#atlas-light)" />
      <g transform="matrix(.91 -.10 .18 .64 20 190)">
        <rect x="-60" y="-90" width="1140" height="840" fill="url(#atlas-grid)" />
        <For each={geography}>
          {(shape) => (
            <path
              d={shape.d}
              fill="#1b2922"
              stroke="#6e876f"
              stroke-opacity=".23"
              stroke-width="1"
            />
          )}
        </For>
        <g filter="url(#map-shadow)">
          <For each={tiles()}>
            {(tile) => {
              const datum = () => tile.datum!;
              const elevation = () => height(datum().observation?.price);
              return (
                <g class="state-tile" classList={{ 'is-selected': props.selected === datum().id }}>
                  <For each={[0.22, 0.44, 0.66, 0.88]}>
                    {(level) => (
                      <path
                        class="map-side"
                        d={tile.d}
                        transform={`translate(0 ${-elevation() * level})`}
                        fill={priceColor(datum().observation?.price)}
                        stroke="#15231c"
                        stroke-width="1.2"
                      />
                    )}
                  </For>
                  <path
                    data-state={datum().id}
                    class="state-face"
                    d={tile.d}
                    transform={`translate(0 ${-elevation()})`}
                    fill={priceColor(datum().observation?.price)}
                    stroke={props.selected === datum().id ? '#f5ffd9' : '#182c21'}
                    stroke-width={props.selected === datum().id ? 3 : 1.2}
                    tabindex="0"
                    role="button"
                    aria-label={`${datum().name}, ${price(datum().observation?.price)} cents per kilowatt-hour`}
                    aria-pressed={props.selected === datum().id}
                    onClick={() => props.onSelect(datum().id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        props.onSelect(datum().id);
                      }
                    }}
                    onPointerEnter={() => props.onHover(datum().id)}
                    onPointerLeave={() => props.onHover(null)}
                    onFocus={() => props.onHover(datum().id)}
                    onBlur={() => props.onHover(null)}
                  >
                    <title>
                      {datum().name}: {price(datum().observation?.price)} ¢/kWh
                    </title>
                  </path>
                  <text
                    class="state-label"
                    x={tile.center[0]}
                    y={tile.center[1] - elevation() + 4}
                    text-anchor="middle"
                    transform={`rotate(5 ${tile.center[0]} ${tile.center[1] - elevation()})`}
                  >
                    {datum().id}
                  </text>
                </g>
              );
            }}
          </For>
        </g>
      </g>
      <g class="map-coordinates">
        <text x="45" y="588">
          24° N
        </text>
        <text x="960" y="588">
          66° W
        </text>
        <path d="M48 570v-30m-15 15h30" />
        <path d="M991 112v30m-15-15h30" />
        <text x="974" y="101">
          N
        </text>
        <text x="45" y="105">
          THE UNITED STATES / ALBERS USA
        </text>
      </g>
      <text class="map-inset-label" x="130" y="575">
        ALASKA & HAWAII REPOSITIONED
      </text>
    </svg>
  );
}
