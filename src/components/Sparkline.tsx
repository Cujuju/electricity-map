import { createMemo, For } from 'solid-js';
import type { Observation } from '../types';

export default function Sparkline(props: {
  history: Observation[];
  period: string;
  onPeriod: (period: string) => void;
}) {
  const points = createMemo(() => {
    const values = props.history
      .map((row) => row.price)
      .filter((value): value is number => value !== null);
    const min = Math.min(...values) * 0.9;
    const max = Math.max(...values) * 1.04;
    return props.history.map((row, i) => ({
      ...row,
      x: 4 + (i / Math.max(1, props.history.length - 1)) * 238,
      y: row.price == null ? null : 64 - ((row.price - min) / Math.max(1, max - min)) * 54,
    }));
  });
  const line = createMemo(() => {
    let wasMissing = true;
    return points()
      .map((point) => {
        if (point.y === null) {
          wasMissing = true;
          return '';
        }
        const command = `${wasMissing ? 'M' : 'L'}${point.x},${point.y}`;
        wasMissing = false;
        return command;
      })
      .join(' ');
  });
  return (
    <svg
      class="sparkline"
      viewBox="0 0 246 80"
      aria-label="Historical quarterly price. Select a quarter to explore it."
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop stop-color="#d4fa66" stop-opacity=".13" />
          <stop offset="1" stop-color="#d4fa66" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line()} L242,78 L4,78Z`} fill="url(#spark-fill)" />
      <path d={line()} fill="none" stroke="#c8e889" stroke-width="1.6" />
      <For each={points()}>
        {(point) => (
          <g>
            <rect
              x={point.x - 3}
              y="0"
              width="6"
              height="80"
              fill="transparent"
              onClick={() => props.onPeriod(point.period)}
            />
            <circle
              cx={point.x}
              cy={point.y ?? 78}
              r={props.period === point.period ? 4 : 0}
              fill="#d4fa66"
              stroke="#142019"
              stroke-width="2"
            />
          </g>
        )}
      </For>
    </svg>
  );
}
