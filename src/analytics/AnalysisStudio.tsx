import {
  createResource,
  createMemo,
  createSignal,
  createEffect,
  batch,
  onCleanup,
  For,
  Show,
} from 'solid-js';
import {
  ArrowUpRight,
  ArrowUp,
  ArrowDown,
  Play,
  Pause,
  Download,
  Activity,
  Radio,
  Telescope,
  Link,
  Check,
} from 'lucide-solid';
import { STATES, SECTORS } from '../data';
import type { Sector } from '../types';
import type { ThemeId } from '../designs/catalog';
import type { MonthlyDataset, UtilityDataset, AnalysisMode, Metric } from './types';
import {
  METRICS,
  indexMonthly,
  getMonth,
  monthLabel,
  display,
  signedValue,
  pct,
  delta,
  metricValue,
  historyStats,
  priceRank,
  monthNumber,
  cagr,
  perCustomer,
  spendingDrivers,
  downloadAnalysis,
} from './math';
import { ChangeMap, TimeGrid, dataColor } from './AnalysisCharts';
import { HistoryPlot } from './HistoryPlot';
import UtilityExplorer from './UtilityExplorer';
import PeriodControls from './PeriodControls';
import type { Grain } from './periods';
import {
  DEFAULT_GAP,
  aggregateYear,
  comparisonThrough,
  grainOf,
  initialRange,
  offsetPeriod,
  periodEnd,
  periodLabel,
  periodStart,
  yearsOf,
} from './periods';
import { shareURL } from '../desktop/links';

async function snapshot<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Data service returned ${response.status}`);
  const data = await response.json();
  if (data.schemaVersion !== 1) throw new Error('Unrecognized data snapshot');
  return data;
}
export default function AnalysisStudio(props: {
  theme: ThemeId;
  mode: AnalysisMode;
  state: string;
  sector: Sector;
  onState: (state: string) => void;
  onSector: (sector: Sector) => void;
}) {
  const q = new URLSearchParams(window.location.search);
  const [error, setError] = createSignal<string | null>(null);
  const [data, { refetch }] = createResource(async () => {
    try {
      setError(null);
      return await snapshot<MonthlyDataset>('/api/monthly');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to load monthly data');
      return undefined;
    }
  });
  const [utilityError, setUtilityError] = createSignal<string | null>(null);
  const [utilities, { refetch: retryUtilities }] = createResource(
    () => props.mode === 'utilities',
    async (active) => {
      if (!active) return undefined;
      try {
        setUtilityError(null);
        return await snapshot<UtilityDataset>('/api/utilities');
      } catch (e) {
        setUtilityError(e instanceof Error ? e.message : 'Utility data unavailable');
        return undefined;
      }
    },
  );
  const [grain, setGrain] = createSignal<Grain>(q.get('grain') === 'year' ? 'year' : 'month');
  const [to, setTo] = createSignal('');
  /** Periods between From and To; kept when To moves so playback stays like-for-like. */
  const [gap, setGap] = createSignal(DEFAULT_GAP[grain()]);
  const [metric, setMetric] = createSignal<Metric>(
    METRICS.some((item) => item.id === q.get('metric')) ? (q.get('metric') as Metric) : 'change',
  );
  const [kwh, setKwh] = createSignal(
    Number(q.get('kwh')) > 0 ? Math.min(100000, Number(q.get('kwh'))) : 1000,
  );
  const [heatWindow, setHeatWindow] = createSignal(24);
  const [playing, setPlaying] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const months = createMemo(() => [...new Set(data()?.rows.map((row) => row.period) ?? [])].sort());
  const periods = createMemo(() => (grain() === 'year' ? yearsOf(months()) : months()));
  const index = createMemo(() => indexMonthly(data()?.rows ?? []));
  const through = createMemo(() => comparisonThrough(to(), months()));
  const from = createMemo(() => (to() ? offsetPeriod(to(), -gap()) : ''));
  // Last month of each endpoint; anchors the month-only history, records and chronicle.
  const month = createMemo(() => (to() ? periodEnd(to(), through()) : ''));
  const baseline = createMemo(() => (from() ? periodEnd(from(), through()) : ''));
  const label = (period: string) => periodLabel(period, through());
  const get = (period: string, state = props.state) =>
    grainOf(period) === 'year'
      ? aggregateYear(index(), props.sector, state, period, through())
      : getMonth(index(), props.sector, period, state);
  const now = createMemo(() => get(to()));
  const before = createMemo(() => get(from()));
  const national = createMemo(() => get(to(), 'US'));
  const info = createMemo(() => METRICS.find((item) => item.id === metric())!);
  const stateName = () => STATES.find((state) => state.id === props.state)?.name ?? props.state;
  const values = createMemo(
    () =>
      new Map(
        STATES.map((state) => [
          state.id,
          metricValue(
            metric(),
            get(to(), state.id),
            get(from(), state.id),
            national(),
            kwh(),
          ),
        ]),
      ),
  );
  const range = createMemo(() =>
    Math.max(
      1,
      ...[...values().values()].filter((value): value is number => value !== null).map(Math.abs),
    ),
  );
  const currentRows = createMemo(() => STATES.map((state) => get(to(), state.id)));
  const baseRows = createMemo(() => STATES.map((state) => get(from(), state.id)));
  const nationalDelta = createMemo(() => pct(national()?.price, get(from(), 'US')?.price));
  const history = createMemo(() =>
    months()
      .map((date) => get(date))
      .filter((row) => row !== undefined),
  );
  const usHistory = createMemo(() =>
    months()
      .map((date) => get(date, 'US'))
      .filter((row) => row !== undefined),
  );
  const stats = createMemo(() => historyStats(history(), month()));
  const drivers = createMemo(() => spendingDrivers(now(), before()));
  const changes = createMemo(() =>
    STATES.map((state) => ({
      ...state,
      delta: delta(get(to(), state.id)?.price, get(from(), state.id)?.price),
      pct: pct(get(to(), state.id)?.price, get(from(), state.id)?.price),
    })),
  );
  const movers = createMemo(() =>
    changes()
      .filter((state) => state.pct !== null)
      .sort((a, b) => b.pct! - a.pct!),
  );
  const heatMonths = createMemo(() =>
    months()
      .filter((date) => date <= month())
      .slice(-heatWindow()),
  );
  const rankChange = () =>
    delta(priceRank(baseRows(), props.state), priceRank(currentRows(), props.state));
  createEffect(() => {
    const all = periods();
    if (!all.length || to()) return;
    const range = initialRange(q, grain(), all);
    batch(() => {
      setTo(range.to);
      setGap(range.gap);
    });
  });
  createEffect(() => {
    if (!to()) return;
    const params = new URLSearchParams(window.location.search);
    for (const legacy of ['month', 'compare', 'since']) params.delete(legacy);
    params.set('grain', grain());
    params.set('from', from());
    params.set('to', to());
    params.set('metric', metric());
    params.set('kwh', String(kwh()));
    window.history.replaceState(null, '', `${window.location.pathname}?${params}`);
  });
  createEffect(() => {
    if (props.mode !== 'changes') {
      setPlaying(false);
      return;
    }
    if (!playing()) return;
    const timer = setInterval(() => {
      const next = periods().indexOf(to()) + 1;
      if (next >= periods().length) {
        setPlaying(false);
        return;
      }
      setTo(periods()[next]);
    }, 750);
    onCleanup(() => clearInterval(timer));
  });
  function selectTo(period: string) {
    setPlaying(false);
    setTo(period);
  }
  /** Picks a single month with a same-month-last-year baseline (map and chronicle clicks). */
  function selectMonth(date: string) {
    batch(() => {
      setPlaying(false);
      setGrain('month');
      setTo(date);
      setGap(DEFAULT_GAP.month);
    });
  }
  function selectGrain(next: Grain) {
    if (next === grain()) return;
    const end = month();
    batch(() => {
      setPlaying(false);
      setGrain(next);
      setTo(next === 'year' ? end.slice(0, 4) : end);
      setGap(DEFAULT_GAP[next]);
    });
  }
  function toggle() {
    // Restart at the first period that has a baseline.
    if (!playing() && to() === periods().at(-1))
      setTo(periods()[Math.min(gap(), periods().length - 1)]);
    setPlaying(!playing());
  }
  function exportRows() {
    downloadAnalysis(
      STATES.map((state) => ({
        grain: grain(),
        from: from(),
        to: to(),
        months_per_period: grain() === 'year' ? through() : 1,
        state: state.id,
        state_name: state.name,
        sector: props.sector,
        price_cents_kwh: get(to(), state.id)?.price ?? null,
        baseline_price_cents_kwh: get(from(), state.id)?.price ?? null,
        change_percent: pct(get(to(), state.id)?.price, get(from(), state.id)?.price),
        change_cents_kwh: delta(get(to(), state.id)?.price, get(from(), state.id)?.price),
        customers: get(to(), state.id)?.customers ?? null,
        sales_million_kwh: get(to(), state.id)?.sales ?? null,
        revenue_million_usd: get(to(), state.id)?.revenue ?? null,
        kwh_per_customer: perCustomer(get(to(), state.id)?.sales, get(to(), state.id)?.customers),
        revenue_per_customer_usd: perCustomer(
          get(to(), state.id)?.revenue,
          get(to(), state.id)?.customers,
        ),
        scenario_kwh: kwh(),
        metric: info().name,
        metric_unit: info().unit,
        value: values().get(state.id) ?? null,
      })),
      `electricity-analysis-${props.sector}-${from()}-to-${to()}.csv`,
    );
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(shareURL());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <div
      class={`design-dashboard theme-${props.theme} analysis-studio`}
      data-testid="analysis-studio"
      data-theme={props.theme}
    >
      <main class="analysis-main">
        <header class="analysis-masthead">
          <a href="/" class="analysis-brand">
            <Activity size={22} /> ELECTRICITY / INTELLIGENCE
          </a>
          <span>{props.mode === 'utilities' ? 'THE LOCAL LENS' : 'THE CHANGE LAB'}</span>
          <button class="lab-action" onClick={share}>
            {copied() ? <Check size={14} /> : <Link size={14} />}{' '}
            {copied() ? 'Copied' : 'Share analysis'}
          </button>
        </header>
        <Show
          when={data()}
          fallback={
            <section class="lab-loading" role={error() ? 'alert' : 'status'}>
              <Radio size={32} />
              <h1>{error() ? 'A break in the signal.' : 'Tuning into the monthly signal.'}</h1>
              <p>{error() ?? 'Loading reported monthly prices, sales, revenue and customers.'}</p>
              <Show when={error()}>
                <button class="lab-action" onClick={() => refetch()}>
                  Try again
                </button>
              </Show>
            </section>
          }
        >
          <section class="analysis-hero">
            <div>
              <span class="lab-kicker">
                {props.mode === 'utilities'
                  ? 'UTILITY DATA / GEOGRAPHY WITH CONTEXT'
                  : 'PRICE MOVEMENT / TIME / CONSEQUENCES'}
              </span>
              <h1>
                {props.mode === 'utilities' ? (
                  <>
                    Every place <em>has a provider.</em>
                  </>
                ) : (
                  <>
                    Where did <em>the current shift?</em>
                  </>
                )}
              </h1>
              <p>
                {props.mode === 'utilities'
                  ? 'Find utility-wide prices and reported county coverage. Explore the provider behind the place.'
                  : 'Follow prices across the country, find the turning points, and put a dollar value on the change.'}
              </p>
            </div>
            <div class="analysis-orbit" aria-hidden="true">
              <div />
              <Telescope size={55} />
              <span>
                {(props.mode === 'utilities'
                  ? utilities()?.records.length
                  : data()!.rows.length
                )?.toLocaleString() ?? '…'}
                <small>
                  {props.mode === 'utilities' ? 'ANNUAL UTILITY RECORDS' : 'MONTHLY OBSERVATIONS'}
                </small>
              </span>
            </div>
          </section>
          <section class="lab-controls">
            <label>
              SECTOR
              <select
                aria-label="Analysis sector"
                value={props.sector}
                onChange={(e) => props.onSector(e.currentTarget.value as Sector)}
              >
                <For each={SECTORS}>
                  {(sector) => <option value={sector.id}>{sector.name}</option>}
                </For>
              </select>
            </label>
            <label>
              STATE
              <select
                aria-label="Analysis state"
                value={props.state}
                onChange={(e) => props.onState(e.currentTarget.value)}
              >
                <For each={STATES}>{(state) => <option value={state.id}>{state.name}</option>}</For>
              </select>
            </label>
            <Show when={props.mode === 'changes'}>
              <PeriodControls
                grain={grain()}
                periods={periods()}
                from={from()}
                to={to()}
                through={through()}
                onGrain={selectGrain}
                onTo={selectTo}
                onGap={setGap}
              />
            </Show>
          </section>
          <Show
            when={props.mode === 'changes'}
            fallback={
              <Show
                when={utilities()}
                fallback={
                  <div class="lab-loading" role={utilityError() ? 'alert' : 'status'}>
                    <p>{utilityError() ?? 'Loading annual utility survey…'}</p>
                    <Show when={utilityError()}>
                      <button class="lab-action" onClick={() => retryUtilities()}>
                        Retry utility data
                      </button>
                    </Show>
                  </div>
                }
              >
                {(utility) => (
                  <UtilityExplorer data={utility()} state={props.state} sector={props.sector} />
                )}
              </Show>
            }
          >
            <section class="lab-kpis">
              <div>
                <span>U.S. AVERAGE / {label(to())}</span>
                <strong data-testid="monthly-national-price">
                  {display(national()?.price, 2)}
                  <small>¢/kWh</small>
                </strong>
                <p>
                  {signedValue(nationalDelta())}% since {label(from())}
                </p>
              </div>
              <div>
                <span>THE COUNTRY MOVED</span>
                <strong>
                  {changes().filter((state) => (state.delta ?? 0) > 0).length}
                  <small>rose</small>
                  <b>/</b>
                  {changes().filter((state) => (state.delta ?? 0) < 0).length}
                  <small>fell</small>
                </strong>
                <p>
                  {changes().filter((state) => state.delta === null).length} unavailable comparisons
                  · 50 states + DC
                </p>
              </div>
              <div>
                <span>{props.state} / CHANGE IN PRICE</span>
                <strong data-testid="analysis-state-change">
                  {signedValue(pct(now()?.price, before()?.price))}
                  <small>%</small>
                </strong>
                <p>
                  {signedValue(delta(now()?.price, before()?.price), 2)}¢/kWh ·{' '}
                  {label(from())} → {label(to())}
                </p>
              </div>
            </section>
            <div class="lab-map-layout">
              <section class="lab-panel lab-map-panel">
                <header class="lab-panel-title">
                  <div>
                    <span>01 / THE CHANGE ATLAS</span>
                    <h2>
                      {info().name}
                      <em> by state.</em>
                    </h2>
                  </div>
                  <select
                    aria-label="Map metric"
                    value={metric()}
                    onChange={(e) => setMetric(e.currentTarget.value as Metric)}
                  >
                    <For each={METRICS}>
                      {(item) => <option value={item.id}>{item.name}</option>}
                    </For>
                  </select>
                </header>
                <ChangeMap
                  values={values()}
                  selected={props.state}
                  limit={range()}
                  diverging={info().diverging}
                  unit={info().unit}
                  onSelect={props.onState}
                />
                <footer class="lab-map-legend">
                  <div>
                    <span
                      style={{
                        background: dataColor(
                          info().diverging ? -range() : 0,
                          range(),
                          info().diverging,
                        ),
                      }}
                    />
                    <b>
                      {display(info().diverging ? -range() : 0)} {info().unit}
                    </b>
                    <span
                      style={{
                        background: dataColor(range(), range(), info().diverging),
                      }}
                    />
                    <b>
                      {display(range())} {info().unit}
                    </b>
                    <i /> Unavailable
                  </div>
                  <p>Scale for the selected comparison. 
                    Alaska and Hawaii are inset. DC is enlarged; the line marks its location.
                  </p>
                </footer>
              </section>
              <aside class="lab-panel lab-state-panel">
                <span class="lab-kicker">IN FOCUS / {props.state}</span>
                <h2>{stateName()}</h2>
                <div class="lab-state-value" data-testid="analysis-metric-value">
                  <span title={display(values().get(props.state), 2)}>
                    {Math.abs(values().get(props.state) ?? 0) >= 100000
                      ? values().get(props.state)!.toLocaleString('en-US', {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        })
                      : display(
                          values().get(props.state),
                          metric() === 'price' || metric() === 'delta' ? 2 : 1,
                        )}
                  </span>
                  <small>{info().unit}</small>
                </div>
                <p>
                  {info().name} / {label(to())}
                </p>
                <div class="lab-mini-facts">
                  <div>
                    <span>Reported price</span>
                    <b>{display(now()?.price, 2)}¢ / kWh</b>
                  </div>
                  <div>
                    <span>Customers</span>
                    <b data-testid="analysis-customers">{display(now()?.customers, 0)}</b>
                  </div>
                  <div>
                    <span>kWh per customer</span>
                    <b>{display(perCustomer(now()?.sales, now()?.customers), 0)}</b>
                  </div>
                  <div>
                    <span>Revenue per customer</span>
                    <b>${display(perCustomer(now()?.revenue, now()?.customers), 2)}</b>
                  </div>
                  <div>
                    <span>Price rank (1 = highest)</span>
                    <b>{priceRank(currentRows(), props.state) ?? '—'} / 51</b>
                  </div>
                  <div>
                    <span>Rank movement</span>
                    <b>{signedValue(rankChange(), 0)} places</b>
                  </div>
                </div>
                <p class="lab-note">
                  Positive rank movement means moving toward the more expensive end.{' '}
                  {grain() === 'year'
                    ? 'Per-customer values are period totals over the average monthly account count.'
                    : 'Customer metrics are monthly account averages.'}
                </p>
                <label class="lab-usage">
                  CHOSEN MONTHLY USAGE
                  <input
                    aria-label="Monthly usage kWh"
                    type="number"
                    min="1"
                    max="100000"
                    step="50"
                    value={kwh()}
                    onInput={(e) => {
                      const value = Number(e.currentTarget.value);
                      if (Number.isFinite(value) && value > 0) setKwh(Math.min(100000, value));
                    }}
                  />
                  <span>kWh / scenario</span>
                </label>
                <div class="lab-scenario">
                  <b>${display(metricValue('cost', now(), before(), national(), kwh()), 2)}</b>
                  <span>
                    {signedValue(metricValue('costChange', now(), before(), national(), kwh()), 2)}{' '}
                    USD versus baseline
                  </span>
                </div>
                <p class="lab-note">
                  Illustrative cost at a fixed usage, calculated from the average retail price. Your
                  actual bill depends on your tariff and usage.
                </p>
              </aside>
            </div>
            <section class="lab-timeline">
              <button
                aria-label={`${playing() ? 'Pause' : 'Play'} ${grain() === 'year' ? 'yearly' : 'monthly'} timeline`}
                onClick={toggle}
              >
                {playing() ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <strong>{label(to())}</strong>
              <div>
                <input
                  aria-label="Comparison timeline"
                  type="range"
                  min="0"
                  max={periods().length - 1}
                  value={Math.max(0, periods().indexOf(to()))}
                  onInput={(e) => selectTo(periods()[Number(e.currentTarget.value)])}
                />
                <span>
                  <i>{periods()[0]}</i>
                  <i>{periods().at(-1)}</i>
                </span>
              </div>
              <button class="lab-action" onClick={exportRows}>
                <Download size={14} /> Export comparison
              </button>
            </section>
            <section class="lab-panel lab-history-panel">
              <header class="lab-panel-title">
                <div>
                  <span>02 / FOLLOW THE SIGNAL</span>
                  <h2>
                    {stateName()} <em>through time.</em>
                  </h2>
                </div>
                <p>
                  Solid: {props.state} · dashed: U.S. · bold: compared periods · nominal ¢ per kWh
                </p>
              </header>
              <HistoryPlot
                rows={history()}
                national={usHistory()}
                state={props.state}
                theme={props.theme}
                from={{
                  start: periodStart(from()),
                  end: baseline(),
                  price: before()?.price ?? null,
                }}
                to={{ start: periodStart(to()), end: month(), price: now()?.price ?? null }}
                onMonth={(date) => (grain() === 'month' ? selectTo(date) : selectMonth(date))}
              />
            </section>
            <p class="lab-note">
              Historical records cover {monthLabel(months()[0])} through{' '}
              {monthLabel(months().at(-1)!)}.
            </p>
            <section class="lab-records">
              <div>
                <span>BIGGEST MONTHLY RISE</span>
                <strong>
                  {stats().biggestRise ? signedValue(stats().biggestRise!.delta, 2) : '—'}
                  <small>¢/kWh</small>
                </strong>
                <p>
                  {stats().biggestRise
                    ? monthLabel(stats().biggestRise!.period)
                    : 'No observed rise'}
                </p>
              </div>
              <div>
                <span>BIGGEST MONTHLY DROP</span>
                <strong>
                  {stats().biggestDrop ? signedValue(stats().biggestDrop!.delta, 2) : '—'}
                  <small>¢/kWh</small>
                </strong>
                <p>
                  {stats().biggestDrop
                    ? monthLabel(stats().biggestDrop!.period)
                    : 'No observed drop'}
                </p>
              </div>
              <div>
                <span>CURRENT PRICE STREAK</span>
                <strong>
                  {stats().streak}
                  <small>
                    months {stats().direction > 0 ? '↑' : stats().direction < 0 ? '↓' : '—'}
                  </small>
                </strong>
                <p>Consecutive month-to-month moves</p>
              </div>
              <div>
                <span>YoY VOLATILITY / 36 MONTHS</span>
                <strong>
                  {display(stats().volatility)}
                  <small>pp</small>
                </strong>
                <p>Sample standard deviation of YoY changes</p>
              </div>
              <div>
                <span>HIGHEST PRICE SINCE 2015</span>
                <strong>
                  {display(stats().high?.price, 2)}
                  <small>¢</small>
                </strong>
                <p>{stats().high ? monthLabel(stats().high!.period) : 'Unavailable'}</p>
              </div>
              <div>
                <span>LOWEST PRICE SINCE 2015</span>
                <strong>
                  {display(stats().low?.price, 2)}
                  <small>¢</small>
                </strong>
                <p>{stats().low ? monthLabel(stats().low!.period) : 'Unavailable'}</p>
              </div>
              <div>
                <span>GROWTH / ANNUALIZED</span>
                <strong>
                  {display(
                    cagr(
                      now()?.price,
                      before()?.price,
                      monthNumber(month()) - monthNumber(baseline()),
                    ),
                  )}
                  <small>%</small>
                </strong>
                <p>Over the selected comparison period</p>
              </div>
              <div>
                <span>YoY ACCELERATION</span>
                <strong>
                  {signedValue(stats().acceleration)}
                  <small>pp</small>
                </strong>
                <p>Current YoY change less previous month's YoY</p>
              </div>
            </section>
            <div class="lab-bottom-grid">
              <section class="lab-panel">
                <header class="lab-panel-title">
                  <div>
                    <span>03 / THE MOVERS</span>
                    <h2>
                      Climbing. <em>Cooling.</em>
                    </h2>
                  </div>
                  <p>% change from baseline</p>
                </header>
                <For each={[...movers().slice(0, 5), ...movers().slice(-5)]}>
                  {(state) => (
                    <button
                      class="lab-mover"
                      aria-label={`Explore ${state.name} change`}
                      onClick={() => props.onState(state.id)}
                    >
                      <span>{state.id}</span>
                      <b>{state.name}</b>
                      <i style={{ background: dataColor(state.pct, 30) }} />
                      <strong>{signedValue(state.pct)}%</strong>
                      <small>{signedValue(state.delta, 2)}¢</small>
                    </button>
                  )}
                </For>
              </section>
              <section class="lab-panel lab-drivers">
                <span class="lab-kicker">04 / WHAT MOVED SPENDING?</span>
                <h2>
                  Price pressure.
                  <br />
                  <em>Volume pressure.</em>
                </h2>
                <Show
                  when={drivers()}
                  fallback={<p>Sales or price data are missing for this comparison.</p>}
                >
                  {(value) => (
                    <>
                      <div>
                        <span>Price contribution</span>
                        <strong>
                          {signedValue(value().price)}
                          <small> million USD</small>
                        </strong>
                      </div>
                      <div>
                        <span>Sales-volume contribution</span>
                        <strong>
                          {signedValue(value().volume)}
                          <small> million USD</small>
                        </strong>
                      </div>
                      <div>
                        <span>Reported revenue change</span>
                        <strong>
                          {signedValue(value().reported)}
                          <small> million USD</small>
                        </strong>
                      </div>
                      <p>
                        Midpoint decomposition of aggregate spending, not a causal explanation. EIA
                        price rounding leaves a residual of {signedValue(value().residual, 2)}{' '}
                        million USD.
                      </p>
                    </>
                  )}
                </Show>
              </section>
            </div>
            <section class="lab-panel lab-time-panel">
              <header class="lab-panel-title">
                <div>
                  <span>05 / THE CHANGE CHRONICLE</span>
                  <h2>
                    Every state. <em>Every turning point.</em>
                  </h2>
                  <p>
                    For the selected sector, +23.9 means the average electricity price per kWh was
                    about 23.9% higher than in the same month a year earlier. Select a cell to inspect
                    that state and month.
                  </p>
                </div>
                <label>
                  VISIBLE MONTHS
                  <select
                    aria-label="Heatmap window"
                    value={heatWindow()}
                    onChange={(e) => setHeatWindow(Number(e.currentTarget.value))}
                  >
                    <option value="12">12 months</option>
                    <option value="24">24 months</option>
                    <option value="60">60 months</option>
                    <option value="240">Entire history</option>
                  </select>
                </label>
              </header>
              <TimeGrid
                index={index()}
                sector={props.sector}
                months={heatMonths()}
                selected={props.state}
                month={month()}
                onPick={(state, date) => {
                  props.onState(state);
                  selectMonth(date);
                }}
              />
              <p class="lab-heat-note">
                Colors: teal = lower, orange = higher; saturation caps at ±30%. Cell details include
                the average price per kWh. Gray = missing comparison. Scroll to explore all 51
                jurisdictions.
              </p>
            </section>
          </Show>
          <footer class="analysis-footer">
            <span>
              {props.mode === 'utilities'
                ? `ANNUAL UTILITY SNAPSHOT / ${utilities()?.records.length.toLocaleString() ?? '…'} RECORDS / ${utilities()?.years.join(' · ') ?? ''}`
                : `MONTHLY SNAPSHOT / ${data()!.rows.length.toLocaleString()} OBSERVATIONS / ${months()[0]} → ${months().at(-1)}`}
            </span>
            <a
              href={
                props.mode === 'utilities'
                  ? 'https://www.eia.gov/electricity/data/eia861/'
                  : 'https://www.eia.gov/electricity/data/browser/'
              }
              target="_blank"
              rel="noreferrer"
            >
              EIA SOURCE <ArrowUpRight size={13} />
            </a>
            <p>
              {props.mode === 'utilities'
                ? `Utility/state annual averages. County coverage uses ${utilities()?.years.at(-1) ?? 'the latest'} service-territory reports. Fetched ${utilities() ? new Date(utilities()!.fetchedAt).toLocaleDateString() : '…'}.`
                : `Nominal average retail prices. Timing identifies the reporting month, not an exact tariff-change date. Fetched ${new Date(data()!.fetchedAt).toLocaleDateString()}.`}
            </p>
          </footer>
        </Show>
      </main>
    </div>
  );
}
