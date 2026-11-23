import { createMemo, For, Show } from 'solid-js';
import {
  ArrowUpRight,
  ArrowRight,
  Download,
  Play,
  Pause,
  Link,
  Check,
  Zap,
  Plus,
  Minus,
  ChevronLeft,
  ChevronRight,
  Radio,
  Waves,
  Sparkles,
} from 'lucide-solid';
import type { Dataset, Observation, Sector, StateDatum } from '../types';
import { price, quarter, sales, signed, percentage, SECTORS, SOURCE_URL, STATES } from '../data';
import { DESIGNS, interpolateColor, themeGradient, type DesignId, type ThemeId } from './catalog';
import DesignCharts from './DesignCharts';

export interface DashboardProps {
  design: DesignId;
  theme: ThemeId;
  dataset?: Dataset;
  error: string | null;
  loading: boolean;
  sector: Sector;
  period: string;
  periods: string[];
  selected: string;
  states: StateDatum[];
  national?: Observation;
  nationalChange: number | null;
  history: Observation[];
  nationalHistory: Observation[];
  playing: boolean;
  copied: boolean;
  copyError: boolean;
  onSelect: (state: string) => void;
  onSector: (sector: Sector) => void;
  onPeriod: (period: string) => void;
  onPlay: () => void;
  onShare: () => void;
  onDownload: () => void;
  onRetry: () => void;
}

export default function DesignDashboard(props: DashboardProps) {
  const design = createMemo(() => DESIGNS.find((design) => design.id === props.design)!);
  const selected = createMemo(() => props.states.find((state) => state.id === props.selected)!);
  const ranked = createMemo(() =>
    [...props.states]
      .filter((state) => state.observation?.price != null)
      .sort((a, b) => b.observation!.price! - a.observation!.price!),
  );
  const ceiling = createMemo(
    () =>
      Math.ceil(Math.max(60, ...(props.dataset?.rows.map((row) => row.price ?? 0) ?? [])) / 10) *
      10,
  );
  const allHistory = createMemo(
    () =>
      props.dataset?.rows.filter((row) => row.sector === props.sector && row.state !== 'US') ?? [],
  );
  const periodIndex = () => Math.max(0, props.periods.indexOf(props.period));
  const color = (value: number | null | undefined) => interpolateColor(value, props.theme, ceiling());
  const gap = () => percentage(selected().observation?.price, props.national?.price);
  const rank = () => ranked().findIndex((state) => state.id === props.selected) + 1;
  const comparison = () =>
    gap() === null
      ? 'No national comparison available.'
      : `${Math.abs(gap()!).toFixed(1)}% ${gap()! >= 0 ? 'above' : 'below'} the U.S. average.`;
  const sectorName = () => SECTORS.find((sector) => sector.id === props.sector)?.name;
  return (
    <div
      class={`design-dashboard design-${props.design} theme-${props.theme}`}
      data-testid="experimental-dashboard"
      data-design={props.design}
      data-theme={props.theme}
    >
      <main class="experiment-main">
        <header class="experiment-masthead">
          <a href="/" class="experiment-brand" aria-label="Electricity Map home">
            <span class="experiment-brand-icon">
              <Zap size={20} />
            </span>
            {design().brand}
          </a>
          <span class="experiment-edition">ELECTRICITY MAP / DESIGN {design().number}</span>
          <div class="experiment-masthead-actions">
            <button aria-label="Share this dashboard" onClick={props.onShare}>
              {props.copied ? <Check size={15} /> : <Link size={15} />}
              <span>{props.copied ? 'COPIED' : 'SHARE'}</span>
            </button>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              SOURCE <ArrowUpRight size={15} />
            </a>
          </div>
        </header>
        <Show when={props.copyError}>
          <p class="experiment-notice" role="status">
            Copy the browser address to share this dashboard.
          </p>
        </Show>
        <Show
          when={props.dataset && !props.loading}
          fallback={
            <section class="experiment-loading">
              <Zap size={32} />
              <h1>{props.error ? 'A break in the circuit.' : 'Finding the current.'}</h1>
              <p>{props.error ?? 'Loading the EIA snapshot…'}</p>
              <Show when={props.error}>
                <button onClick={props.onRetry}>
                  Try again <ArrowRight size={16} />
                </button>
              </Show>
            </section>
          }
        >
          <section class="experiment-hero">
            <div class="experiment-hero-copy">
              <div class="experiment-kicker">
                <span />
                {design().category}
              </div>
              <h1>{design().title}</h1>
              <p>{design().intro}</p>
            </div>
            <div class="experiment-hero-emblem" aria-hidden="true">
              <Show
                when={props.design === 'analog'}
                fallback={
                  <Show
                    when={props.design === 'tidal'}
                    fallback={
                      <Show
                        when={props.design === 'candy'}
                        fallback={<span>{design().number}</span>}
                      >
                        <Sparkles size={90} />
                      </Show>
                    }
                  >
                    <Waves size={100} />
                  </Show>
                }
              >
                <Radio size={100} />
              </Show>
              <small>
                {props.design === 'press'
                  ? 'THE QUARTERLY EDITION'
                  : props.design === 'arcade'
                    ? 'LEVEL 051 / ENERGY'
                    : props.design === 'solar'
                      ? 'GROWN IN THE UNITED STATES'
                      : '50 STATES + DC'}
              </small>
            </div>
          </section>

          <div class="experiment-toolbar">
            <div class="experiment-filter">
              <label for={`sector-${props.design}`}>SECTOR</label>
              <select
                id={`sector-${props.design}`}
                aria-label="End-use sector"
                value={props.sector}
                onChange={(event) => props.onSector(event.currentTarget.value as Sector)}
              >
                <For each={SECTORS}>
                  {(sector) => <option value={sector.id}>{sector.name}</option>}
                </For>
              </select>
            </div>
            <div class="experiment-filter">
              <label for={`state-${props.design}`}>STATE</label>
              <select
                id={`state-${props.design}`}
                aria-label="Selected state"
                value={props.selected}
                onChange={(event) => props.onSelect(event.currentTarget.value)}
              >
                <For each={STATES}>{(state) => <option value={state.id}>{state.name}</option>}</For>
              </select>
            </div>
            <div class="experiment-filter">
              <label for={`quarter-${props.design}`}>QUARTER</label>
              <select
                id={`quarter-${props.design}`}
                aria-label="Selected quarter"
                value={props.period}
                onChange={(event) => props.onPeriod(event.currentTarget.value)}
              >
                <For each={props.periods}>
                  {(period) => <option value={period}>{quarter(period)}</option>}
                </For>
              </select>
            </div>
            <span class="experiment-snapshot">
              <span /> EIA SNAPSHOT / QUARTERLY
            </span>
            <button class="experiment-export" onClick={props.onDownload}>
              <Download size={14} />
              EXPORT CSV
            </button>
          </div>

          <section class="experiment-metrics" aria-label="National electricity statistics">
            <div class="experiment-metric metric-national">
              <span>01 / U.S. AVERAGE PRICE</span>
              <p>
                <strong data-testid="national-price">{price(props.national?.price)}</strong>
                <small>¢ / kWh</small>
              </p>
              <div>
                {signed(props.nationalChange)}
                <span>versus the same quarter last year</span>
              </div>
            </div>
            <div class="experiment-metric metric-sales">
              <span>02 / ELECTRICITY SOLD</span>
              <p>
                <strong>
                  {props.national?.sales == null ? '—' : (props.national.sales / 1000).toFixed(1)}
                </strong>
                <small>TWh</small>
              </p>
              <div>
                {sectorName()}
                <span>in {quarter(props.period)}</span>
              </div>
            </div>
            <div class="experiment-metric metric-range">
              <span>03 / THE STATE SPREAD</span>
              <p>
                <strong>
                  {ranked().length
                    ? price(ranked()[0].observation!.price! - ranked().at(-1)!.observation!.price!)
                    : '—'}
                </strong>
                <small>¢ / kWh</small>
              </p>
              <div>
                {ranked().at(-1)?.id} <ArrowRight size={13} /> {ranked()[0]?.id}
                <span>lowest price to highest price</span>
              </div>
            </div>
          </section>

          <div class="experiment-content">
            <section class="experiment-chart-panel">
              <header class="experiment-chart-heading">
                <div>
                  <span class="experiment-section-label">
                    FIG. {design().number} /{' '}
                    {props.design === 'press' ? 'THE RECORD' : 'THE BIG PICTURE'}
                  </span>
                  <h2>{design().chartTitle}</h2>
                  <p>{design().chartSubtitle}</p>
                </div>
                <span class="experiment-chart-stamp">
                  {quarter(props.period)}
                  <small>{sectorName()}</small>
                </span>
              </header>
              <DesignCharts
                design={design()}
                theme={props.theme}
                states={props.states}
                selected={props.selected}
                period={props.period}
                periods={props.periods}
                history={props.history}
                nationalHistory={props.nationalHistory}
                allHistory={allHistory()}
                ceiling={ceiling()}
                onSelect={props.onSelect}
                onPeriod={props.onPeriod}
              />
              <div class="experiment-chart-caption">
                <div class="experiment-color-key">
                  <span>PRICE / ¢ PER kWh</span>
                  <div
                    style={{
                      background: themeGradient(props.theme),
                    }}
                  />
                  <p>
                    <span>0</span>
                    <span>{ceiling() / 2}</span>
                    <span>{ceiling()}</span>
                  </p>
                </div>
                <p>{design().encoding}</p>
              </div>
            </section>

            <aside class="experiment-specimen" aria-label="State electricity details">
              <div class="experiment-specimen-top">
                <span class="experiment-section-label">IN FOCUS / {props.selected}</span>
                <Plus size={17} />
              </div>
              <div class="experiment-state-name">
                <span>{props.selected}</span>
                <div>
                  <h2>{selected().name}</h2>
                  <p>
                    {selected().region} / {quarter(props.period)}
                  </p>
                </div>
              </div>
              <div class="experiment-state-price">
                <strong data-testid="state-price">{price(selected().observation?.price)}</strong>
                <span>¢ / kWh</span>
              </div>
              <p class="experiment-comparison">{comparison()}</p>
              <div class="experiment-state-facts">
                <div>
                  <span>Year over year</span>
                  <strong>{signed(selected().change)}</strong>
                </div>
                <div>
                  <span>Electricity sold</span>
                  <strong>{sales(selected().observation?.sales)}</strong>
                </div>
                <div>
                  <span>Price rank</span>
                  <strong>
                    {rank() || '—'} / {ranked().length}
                  </strong>
                </div>
              </div>
              <div class="experiment-state-note">
                <span class="experiment-section-label">THE {props.selected} STORY</span>
                <p>
                  One state. {props.history.length} quarters.{' '}
                  {props.design === 'press'
                    ? 'A small piece of a much larger American story.'
                    : 'A different way to look at the same current.'}
                </p>
                <div class="experiment-mini-history" aria-hidden="true">
                  <For each={props.history}>
                    {(row) => (
                      <span
                        classList={{ current: props.period === row.period }}
                        style={{
                          height:
                            row.price == null
                              ? '2px'
                              : `${Math.max(3, (row.price / ceiling()) * 55)}px`,
                          background: color(row.price),
                        }}
                      />
                    )}
                  </For>
                </div>
                <div class="experiment-mini-years">
                  <span>2015</span>
                  <span>{props.periods.at(-1)?.slice(0, 4)}</span>
                </div>
              </div>
            </aside>

            <section class="experiment-rankings">
              <div class="experiment-ranking-heading">
                <span class="experiment-section-label">THE HIGH FIVE</span>
                <ArrowUpRight size={18} />
              </div>
              <h2>At the upper end.</h2>
              <For each={ranked().slice(0, 5)}>
                {(state, i) => (
                  <button
                    class="experiment-ranking-row"
                    aria-label={`Select ${state.name}`}
                    onClick={() => props.onSelect(state.id)}
                    aria-pressed={props.selected === state.id}
                  >
                    <span>{String(i() + 1).padStart(2, '0')}</span>
                    <b>{state.id}</b>
                    <span class="experiment-ranking-meter">
                      <i
                        style={{
                          width: `${((state.observation?.price ?? 0) / ceiling()) * 100}%`,
                          background: color(state.observation?.price),
                        }}
                      />
                    </span>
                    <strong>
                      {price(state.observation?.price)}
                      <small>¢</small>
                    </strong>
                    <ArrowUpRight size={12} />
                  </button>
                )}
              </For>
              <p>
                Highest reported prices this quarter.
                <br />
                Rankings include all 50 states and DC.
              </p>
            </section>
          </div>

          <section class="experiment-timeline" aria-label="Quarter timeline">
            <button
              class="experiment-play"
              aria-label={props.playing ? 'Pause timeline' : 'Play timeline'}
              aria-pressed={props.playing}
              onClick={props.onPlay}
            >
              {props.playing ? (
                <Pause size={18} fill="currentColor" />
              ) : (
                <Play size={18} fill="currentColor" />
              )}
            </button>
            <div class="experiment-timeline-label">
              <span>TRAVEL THROUGH TIME</span>
              <strong aria-live="polite">{quarter(props.period)}</strong>
            </div>
            <div class="experiment-timeline-track">
              <input
                type="range"
                aria-label="Quarter"
                min="0"
                max={props.periods.length - 1}
                value={periodIndex()}
                onInput={(event) =>
                  props.onPeriod(props.periods[Number(event.currentTarget.value)])
                }
                style={{
                  '--progress': `${(periodIndex() / Math.max(1, props.periods.length - 1)) * 100}%`,
                }}
              />
              <div>
                <span>2015</span>
                <span>2018</span>
                <span>2021</span>
                <span>2024</span>
                <span>{props.periods.at(-1)?.slice(0, 4)}</span>
              </div>
            </div>
            <div class="experiment-timeline-step">
              <button
                aria-label="Previous quarter"
                disabled={periodIndex() === 0}
                onClick={() => props.onPeriod(props.periods[periodIndex() - 1])}
              >
                <ChevronLeft size={18} />
              </button>
              <button
                aria-label="Next quarter"
                disabled={periodIndex() === props.periods.length - 1}
                onClick={() => props.onPeriod(props.periods[periodIndex() + 1])}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </section>

          <details class="experiment-data-notes">
            <summary>
              Read the data & visual encoding notes <Plus size={15} />
            </summary>
            <div>
              <p>{design().encoding}</p>
              <p>
                All prices are nominal cents per kilowatt-hour. The national average is EIA’s
                reported U.S. total. Sales are converted from million kWh to TWh. This is a dated
                snapshot, not a live grid feed; missing values remain unavailable. Colors use the
                displayed 0–{ceiling()}¢ scale across quarters.
              </p>
              <p>
                Snapshot fetched{' '}
                {new Date(props.dataset!.fetchedAt).toLocaleDateString('en-US', {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
                . Latest available quarter: {quarter(props.periods.at(-1)!)}. Source: EIA
                electricity retail sales.
              </p>
            </div>
          </details>
          <footer class="experiment-footer">
            <span>
              <Zap size={12} /> ELECTRICITY MAP / {design().name.toUpperCase()}
            </span>
            <p>
              50 STATES + DC <span>•</span> {props.periods.length} QUARTERS <span>•</span> REAL EIA
              DATA
            </p>
            <a href={SOURCE_URL} target="_blank" rel="noreferrer">
              FOLLOW THE SOURCE <ArrowUpRight size={13} />
            </a>
          </footer>
        </Show>
      </main>
    </div>
  );
}
