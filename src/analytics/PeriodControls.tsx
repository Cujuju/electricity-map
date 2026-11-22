import { For, Show } from 'solid-js';
import type { Grain } from './periods';
import { MONTHS_PER_YEAR, periodDistance, periodLabel } from './periods';

const PRESETS: Record<Grain, { label: string; gap: number }[]> = {
  month: [
    { label: '1 month back', gap: 1 },
    { label: '1 year back', gap: MONTHS_PER_YEAR },
  ],
  year: [{ label: '1 year back', gap: 1 }],
};

/** From → To endpoint pickers. Only the two endpoint periods are compared. */
export default function PeriodControls(props: {
  grain: Grain;
  periods: string[];
  from: string;
  to: string;
  through: number;
  onGrain: (grain: Grain) => void;
  onTo: (period: string) => void;
  onGap: (gap: number) => void;
}) {
  const earlier = () => props.periods.filter((period) => period < props.to);
  const label = (period: string) => periodLabel(period, props.through);
  const gap = () => (props.from ? periodDistance(props.to, props.from) : 0);
  return (
    <>
      <label class="lab-grain">
        COMPARE BY
        <select
          aria-label="Comparison grain"
          value={props.grain}
          onChange={(e) => props.onGrain(e.currentTarget.value as Grain)}
        >
          <option value="month">Month</option>
          <option value="year">Calendar year</option>
        </select>
      </label>
      <label>
        FROM
        <select
          aria-label="Compare from"
          value={props.from}
          onChange={(e) => props.onGap(periodDistance(props.to, e.currentTarget.value))}
        >
          <For each={earlier()}>
            {(period) => (
              <option value={period} selected={period === props.from}>
                {label(period)}
              </option>
            )}
          </For>
          <Show when={!earlier().includes(props.from)}>
            <option value={props.from} selected>
              {props.from ? `${label(props.from)} (no data)` : 'No earlier period available'}
            </option>
          </Show>
        </select>
      </label>
      <label>
        TO
        <select
          aria-label="Compare to"
          value={props.to}
          onChange={(e) => props.onTo(e.currentTarget.value)}
        >
          <For each={props.periods}>
            {(period) => (
              <option value={period} selected={period === props.to}>
                {label(period)}
              </option>
            )}
          </For>
        </select>
      </label>
      <div class="lab-presets" role="group" aria-label="Quick From">
        <For each={PRESETS[props.grain]}>
          {(preset) => (
            <button
              class="lab-action"
              aria-pressed={gap() === preset.gap}
              onClick={() => props.onGap(preset.gap)}
            >
              {preset.label}
            </button>
          )}
        </For>
        <button
          class="lab-action"
          aria-pressed={props.from === props.periods[0]}
          disabled={!earlier().length}
          onClick={() => props.onGap(periodDistance(props.to, props.periods[0]))}
        >
          Earliest
        </button>
      </div>
      <p class="lab-note lab-range-note" data-testid="comparison-note">
        Compares {label(props.from)} with {label(props.to)}; periods in between do not enter the
        change.
        <Show when={props.grain === 'year'}>
          {' '}
          Calendar-year prices are total revenue ÷ total sales across monthly reports; a state
          missing any month has no value.
          <Show when={props.through < MONTHS_PER_YEAR}>
            {' '}
            {props.to.slice(0, 4)} is year-to-date, so both years use the same months.
          </Show>
        </Show>
        <Show when={props.grain === 'month' && gap() % MONTHS_PER_YEAR !== 0}>
          {' '}
          Different calendar months: seasonal price swings are part of this change.
        </Show>
      </p>
    </>
  );
}
