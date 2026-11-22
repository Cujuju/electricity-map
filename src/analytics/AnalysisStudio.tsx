import {
  createResource,
  createMemo,
  createSignal,
  createEffect,
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
import type { DashboardId } from '../designs/catalog';
import { DESIGNS } from '../designs/catalog';
import type { MonthlyDataset, UtilityDataset, AnalysisMode, Metric } from './types';
import {
  METRICS,
  indexMonthly,
  getMonth,
  offsetMonth,
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
import { ChangeMap, HistoryPlot, TimeGrid, dataColor } from './AnalysisCharts';
import UtilityExplorer from './UtilityExplorer';
import { shareURL } from '../desktop/links';

async function snapshot<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`Data service returned ${response.status}`);
  const data = await response.json();
  if (data.schemaVersion !== 1) throw new Error('Unrecognized data snapshot');
  return data;
}
export default function AnalysisStudio(props: {
  design: DashboardId;
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
  const [month, setMonth] = createSignal('');
  const [custom, setCustom] = createSignal(q.get('since') ?? '');
  const [comparison, setComparison] = createSignal(
    ['year', 'month', 'custom', 'start'].includes(q.get('compare') ?? '')
      ? q.get('compare')!
      : 'year',
  );
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
  const index = createMemo(() => indexMonthly(data()?.rows ?? []));
  const baseline = createMemo(() =>
    comparison() === 'year'
      ? offsetMonth(month(), -12)
      : comparison() === 'month'
        ? offsetMonth(month(), -1)
        : comparison() === 'start'
          ? months()[0]
          : custom(),
  );
  const get = (date: string, state = props.state) => getMonth(index(), props.sector, date, state);
  const now = createMemo(() => get(month()));
  const before = createMemo(() => get(baseline()));
  const national = createMemo(() => get(month(), 'US'));
  const info = createMemo(() => METRICS.find((item) => item.id === metric())!);
  const stateName = () => STATES.find((state) => state.id === props.state)?.name ?? props.state;
  const values = createMemo(
    () =>
      new Map(
        STATES.map((state) => [
          state.id,
          metricValue(
            metric(),
            get(month(), state.id),
            get(baseline(), state.id),
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
  const currentRows = createMemo(() => STATES.map((state) => get(month(), state.id)));
  const baseRows = createMemo(() => STATES.map((state) => get(baseline(), state.id)));
  const nationalDelta = createMemo(() => pct(national()?.price, get(baseline(), 'US')?.price));
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
      delta: delta(get(month(), state.id)?.price, get(baseline(), state.id)?.price),
      pct: pct(get(month(), state.id)?.price, get(baseline(), state.id)?.price),
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
    const all = months();
    if (all.length && !month()) {
      setMonth(all.includes(q.get('month') ?? '') ? q.get('month')! : all.at(-1)!);
    }
  });
  createEffect(() => {
    if (!month()) return;
    const eligible = months().filter((date) => date < month());
    if (!eligible.includes(custom())) {
      const yearAgo = offsetMonth(month(), -12);
      setCustom(eligible.includes(yearAgo) ? yearAgo : (eligible.at(-1) ?? ''));
    }
  });
  createEffect(() => {
    if (!month()) return;
    const params = new URLSearchParams(window.location.search);
    params.set('month', month());
    params.set('compare', comparison());
    params.set('since', custom());
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
      const next = months().indexOf(month()) + 1;
      if (next >= months().length) {
        setPlaying(false);
        return;
      }
      setMonth(months()[next]);
    }, 750);
    onCleanup(() => clearInterval(timer));
  });
  function selectMonth(date: string) {
    setPlaying(false);
    setMonth(date);
  }
  function toggle() {
    if (!playing() && month() === months().at(-1))
      setMonth(months()[Math.min(12, months().length - 1)]);
    setPlaying(!playing());
  }
  function exportRows() {
    downloadAnalysis(
      STATES.map((state) => ({
        month: month(),
        baseline: baseline(),
        state: state.id,
        state_name: state.name,
        sector: props.sector,
        price_cents_kwh: get(month(), state.id)?.price ?? null,
        baseline_price_cents_kwh: get(baseline(), state.id)?.price ?? null,
        change_percent: pct(get(month(), state.id)?.price, get(baseline(), state.id)?.price),
        change_cents_kwh: delta(get(month(), state.id)?.price, get(baseline(), state.id)?.price),
        customers: get(month(), state.id)?.customers ?? null,
        sales_million_kwh: get(month(), state.id)?.sales ?? null,
        revenue_million_usd: get(month(), state.id)?.revenue ?? null,
        kwh_per_customer: perCustomer(
          get(month(), state.id)?.sales,
          get(month(), state.id)?.customers,
        ),
        revenue_per_customer_usd: perCustomer(
          get(month(), state.id)?.revenue,
          get(month(), state.id)?.customers,
        ),
        scenario_kwh: kwh(),
        metric: info().name,
        metric_unit: info().unit,
        value: values().get(state.id) ?? null,
      })),
      `electricity-analysis-${props.sector}-${month()}.csv`,
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
      class={`design-dashboard skin-${props.design} analysis-studio`}
      data-testid="analysis-studio"
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
                    Every place
                    <br />
                    <em>has a provider.</em>
                  </>
                ) : (
                  <>
                    Where did
                    <br />
                    <em>the current shift?</em>
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
              <label>
                OBSERVED MONTH
                <select
                  aria-label="Analysis month"
                  value={month()}
                  onChange={(e) => selectMonth(e.currentTarget.value)}
                >
                  <For each={months()}>
                    {(date) => <option value={date}>{monthLabel(date)}</option>}
                  </For>
                </select>
              </label>
              <label>
                COMPARE WITH
                <select
                  aria-label="Comparison period"
                  value={comparison()}
                  onChange={(e) => setComparison(e.currentTarget.value)}
                >
                  <option value="year">Same month last year</option>
                  <option value="month">Previous month</option>
                  <option value="start">Start of history</option>
                  <option value="custom">Choose a month</option>
                </select>
              </label>
              <Show when={comparison() === 'custom'}>
                <label>
                  BASELINE MONTH
                  <select
                    aria-label="Baseline month"
                    value={custom()}
                    onChange={(e) => setCustom(e.currentTarget.value)}
                  >
                    <For each={months().filter((date) => date < month())}>
                      {(date) => (
                        <option value={date} selected={date === custom()}>
                          {monthLabel(date)}
                        </option>
                      )}
                    </For>
                    <Show when={!custom()}>
                      <option value="">No earlier month available</option>
                    </Show>
                  </select>
                </label>
              </Show>
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
                <span>U.S. AVERAGE / {monthLabel(month())}</span>
                <strong data-testid="monthly-national-price">
                  {display(national()?.price, 2)}
                  <small>¢/kWh</small>
                </strong>
                <p>
                  {signedValue(nationalDelta())}% since {monthLabel(baseline())}
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
                  {monthLabel(baseline())} → {monthLabel(month())}
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
                  <p>Scale for the selected comparison. Alaska and Hawaii are inset.</p>
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
                  {info().name} / {monthLabel(month())}
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
                  Positive rank movement means moving toward the more expensive end. Customer
                  metrics are monthly account averages.
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
                aria-label={playing() ? 'Pause monthly timeline' : 'Play monthly timeline'}
                onClick={toggle}
              >
                {playing() ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <strong>{monthLabel(month())}</strong>
              <div>
                <input
                  aria-label="Monthly timeline"
                  type="range"
                  min="0"
                  max={months().length - 1}
                  value={Math.max(0, months().indexOf(month()))}
                  onInput={(e) => selectMonth(months()[Number(e.currentTarget.value)])}
                />
                <span>
                  <i>{months()[0]}</i>
                  <i>{months().at(-1)}</i>
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
                <p>Solid: {props.state} · dashed: U.S.</p>
              </header>
              <HistoryPlot
                rows={history()}
                national={usHistory()}
                state={props.state}
                selectedMonth={month()}
                baseline={baseline()}
                onMonth={selectMonth}
              />
            </section>
            <p class="lab-note">
              Historical records cover January 2015 through {monthLabel(month())}.
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
                    For the selected sector, +24 means the average electricity price per kWh was
                    about 24% higher than in the same month a year earlier. Select a cell to inspect
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
                  setComparison('year');
                }}
              />
              <p class="lab-heat-note">
                Colors: teal = lower, orange = higher; saturation caps at ±30%. Exact values remain
                available on each cell. Gray = missing comparison. Scroll to explore all 51
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
