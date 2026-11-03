import type { JSX } from 'solid-js';
import { price, quarter } from '../data';
import type { StateDatum } from '../types';

export function StateMark(props: {
  state: StateDatum;
  selected: string;
  onSelect: (id: string) => void;
  children: JSX.Element;
}) {
  return (
    <g
      class="design-state-mark"
      classList={{ 'is-picked': props.selected === props.state.id }}
      data-chart-state={props.state.id}
      role="button"
      tabindex="0"
      aria-pressed={props.selected === props.state.id}
      aria-label={`${props.state.name}, ${price(props.state.observation?.price)} cents per kilowatt-hour`}
      onClick={() => props.onSelect(props.state.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          props.onSelect(props.state.id);
        }
      }}
    >
      {props.children}
      <title>
        {props.state.name}: {price(props.state.observation?.price)} ¢/kWh
      </title>
    </g>
  );
}

export function quarterEvents(period: string, onPeriod: (period: string) => void) {
  return {
    role: 'button' as const,
    tabindex: 0,
    'data-chart-period': period,
    'aria-label': `Explore ${quarter(period)}`,
    onClick: () => onPeriod(period),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPeriod(period);
      }
    },
  };
}
