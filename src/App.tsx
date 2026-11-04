import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  onCleanup,
  Show,
} from 'solid-js';
import {
  Zap,
  Map as MapIcon,
  Orbit as OrbitIcon,
  Shell,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Download,
  ExternalLink,
  X,
  Check,
  ArrowRight,
  Layers,
  CircleHelp,
  Link as LinkIcon,
  RotateCcw,
  Search,
} from 'lucide-solid';
import Atlas from './components/Atlas';
import Orbit from './components/Orbit';
import Spiral from './components/Spiral';
import Sparkline from './components/Sparkline';
import DesignSwitcher from './designs/DesignSwitcher';
import DesignDashboard from './designs/DesignDashboard';
import AnalysisStudio from './analytics/AnalysisStudio';
import { DESIGNS, isDesign, type DashboardId, type DesignId } from './designs/catalog';
import {
  downloadCSV,
  indexDataset,
  observation,
  percentage,
  previousYear,
  price,
  priceColor,
  quarter,
  sales,
  SECTORS,
  signed,
  SOURCE_URL,
  STATES,
} from './data';
import type { Dataset, Sector, StateDatum, View } from './types';

const LENSES = [
  {
    id: 'atlas' as const,
    number: '01',
    name: 'Electric atlas',
    short: 'Atlas',
    icon: MapIcon,
    subtitle: 'The geography of a kilowatt-hour.',
    description: 'A country shaped by the price of power. Higher prices lift states off the map.',
    encoding: 'Elevation + color = price',
    tag: 'GEOGRAPHIC RELIEF',
  },
  {
    id: 'orbit' as const,
    number: '02',
    name: 'Price constellation',
    short: 'Constellation',
    icon: OrbitIcon,
    subtitle: 'Every state, in its own orbit.',
    description: 'A new solar system of electricity. Expensive power drifts toward the outer edge.',
    encoding: 'Distance = price · area = sales',
    tag: 'RADIAL CONSTELLATION',
  },
  {
    id: 'spiral' as const,
    number: '03',
    name: 'Time machine',
    short: 'Time spiral',
    icon: Shell,
    subtitle: 'The current keeps moving.',
    description:
      'Eleven years of electricity, wound into a spiral. Follow a state alongside the nation.',
    encoding: 'Outward = time · color + area = price',
    tag: 'CHRONOLOGICAL SPIRAL',
  },
];
const params = new URLSearchParams(window.location.search);
const initialView = params.get('view');
const initialSector = params.get('sector');
const initialState = params.get('state');

async function loadDataset(): Promise<Dataset> {
  const response = await fetch('/api/electricity', {
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`The data service returned ${response.status}.`);
  const data = await response.json();
  if (data.schemaVersion !== 1 || !Array.isArray(data.rows) || !data.rows.length)
    throw new Error('The electricity snapshot is incomplete.');
  return data;
}

export default function App() {
  const [workspace, setWorkspace] = createSignal<'overview' | 'changes' | 'utilities'>(
    params.get('lab') === 'changes' || params.get('lab') === 'utilities'
      ? (params.get('lab') as 'changes' | 'utilities')
      : 'overview',
  );
  const [design, setDesign] = createSignal<DashboardId>(
    isDesign(params.get('design')) ? (params.get('design') as DesignId) : 'original',
  );
  const [dataError, setDataError] = createSignal<string | null>(null);
  const [dataset, { refetch }] = createResource(async () => {
    setDataError(null);
    try {
      return await loadDataset();
    } catch (error) {
      setDataError(
        error instanceof Error ? error.message : 'The electricity data could not be loaded.',
      );
      return undefined;
    }
  });
  const [view, setView] = createSignal<View>(
    LENSES.some((lens) => lens.id === initialView) ? (initialView as View) : 'atlas',
  );
  const [sector, setSector] = createSignal<Sector>(
    SECTORS.some((item) => item.id === initialSector) ? (initialSector as Sector) : 'RES',
  );
  const [period, setPeriod] = createSignal('');
  const [selected, setSelected] = createSignal(
    STATES.some((state) => state.id === initialState) ? initialState! : 'CA',
  );
  const [hovered, setHovered] = createSignal<string | null>(null);
  const [hoveredPeriod, setHoveredPeriod] = createSignal<string | null>(null);
  const [relief, setRelief] = createSignal(true);
  const [playing, setPlaying] = createSignal(false);
  const [copied, setCopied] = createSignal(false);
  const [copyError, setCopyError] = createSignal(false);
  const [search, setSearch] = createSignal('');
  const [ranking, setRanking] = createSignal<'high' | 'low'>('high');
  let methods!: HTMLDialogElement;
  let copiedTimer: ReturnType<typeof setTimeout>;

  const periods = createMemo(() =>
    [...new Set(dataset()?.rows.map((row) => row.period) ?? [])].sort(),
  );
  const index = createMemo(() => indexDataset(dataset() ?? ({ rows: [] } as unknown as Dataset)));
  const lens = createMemo(() => LENSES.find((lens) => lens.id === view())!);
  const currentIndex = createMemo(() => Math.max(0, periods().indexOf(period())));
  const national = createMemo(() => observation(index(), sector(), period(), 'US'));
  const nationalChange = createMemo(() =>
    percentage(
      national()?.price,
      observation(index(), sector(), previousYear(period()), 'US')?.price,
    ),
  );
  const stateData = createMemo<StateDatum[]>(() =>
    STATES.map((state) => {
      const row = observation(index(), sector(), period(), state.id);
      const previous = observation(index(), sector(), previousYear(period()), state.id);
      return {
        ...state,
        observation: row,
        previous,
        change: percentage(row?.price, previous?.price),
      };
    }),
  );
  const pricedStates = createMemo(() =>
    stateData()
      .filter((state) => state.observation?.price != null)
      .sort((a, b) => b.observation!.price! - a.observation!.price!),
  );
  const focused = createMemo(() => stateData().find((state) => state.id === selected())!);
  const detail = createMemo(() =>
    stateData().find((state) => state.id === (hovered() ?? selected()))!,
  );
  const history = createMemo(() =>
    periods()
      .map((date) => observation(index(), sector(), date, selected()))
      .filter((row) => row !== undefined),
  );
  const nationalHistory = createMemo(() =>
    periods()
      .map((date) => observation(index(), sector(), date, 'US'))
      .filter((row) => row !== undefined),
  );
  const visibleRanking = createMemo(() => {
    const sorted = ranking() === 'high' ? pricedStates() : [...pricedStates()].reverse();
    return sorted
      .filter((state) => `${state.name} ${state.id}`.toLowerCase().includes(search().toLowerCase()))
      .slice(0, search() ? 51 : 5);
  });
  const selectedRank = createMemo(
    () => pricedStates().findIndex((state) => state.id === detail().id) + 1,
  );
  const spread = createMemo(() => {
    const rows = pricedStates();
    return rows.length ? rows[0].observation!.price! - rows.at(-1)!.observation!.price! : null;
  });
  const hoverHistory = createMemo(() =>
    hoveredPeriod() ? history().find((row) => row.period === hoveredPeriod()) : undefined,
  );

  createEffect(() => {
    const available = periods();
    if (available.length && !period())
      setPeriod(
        available.includes(params.get('period') ?? '') ? params.get('period')! : available.at(-1)!,
      );
  });
  createEffect(() => {
    if (!period()) return;
    const query = new URLSearchParams(window.location.search);
    query.set('view', view());
    query.set('sector', sector());
    query.set('period', period());
    query.set('state', selected());
    if (design() !== 'original') query.set('design', design());
    else query.delete('design');
    if (workspace() === 'overview') query.delete('lab');
    else query.set('lab', workspace());
    window.history.replaceState(null, '', `${window.location.pathname}?${query}`);
  });
  createEffect(() => {
    document.title =
      workspace() !== 'overview'
        ? `Electricity Intelligence — ${workspace() === 'changes' ? 'Change Lab' : 'Local Utilities'}`
        : design() === 'original'
          ? 'Electricity Map — A different kind of current'
          : `${DESIGNS.find((item) => item.id === design())!.name} — Electricity Map`;
  });
  createEffect(() => {
    if (workspace() !== 'overview') {
      setPlaying(false);
      return;
    }
    if (!playing() || !periods().length) return;
    const timer = setInterval(() => {
      const next = currentIndex() + 1;
      if (next >= periods().length) {
        setPlaying(false);
        return;
      }
      setPeriod(periods()[next]);
    }, 950);
    onCleanup(() => clearInterval(timer));
  });
  onCleanup(() => clearTimeout(copiedTimer));

  function choosePeriod(value: string) {
    setPlaying(false);
    setPeriod(value);
  }
  function step(direction: number) {
    choosePeriod(
      periods()[Math.max(0, Math.min(periods().length - 1, currentIndex() + direction))],
    );
  }
  function togglePlayback() {
    if (!playing() && currentIndex() === periods().length - 1) setPeriod(periods()[0]);
    setPlaying(!playing());
  }
  function chooseState(id: string) {
    setSelected(id);
    setHovered(null);
  }
  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => {
      setCopied(false);
      setCopyError(false);
    }, 3500);
  }

  return (
    <>
      <DesignSwitcher
        selected={design()}
        onChange={setDesign}
        mode={workspace()}
        onMode={setWorkspace}
      />
      <Show
        when={workspace() === 'overview'}
        fallback={
          <AnalysisStudio
            design={design()}
            mode={workspace() as 'changes' | 'utilities'}
            state={selected()}
            sector={sector()}
            onState={chooseState}
            onSector={setSector}
          />
        }
      >
        <Show
          when={design() === 'original'}
          fallback={
            <DesignDashboard
              design={design() as DesignId}
              dataset={dataset()}
              loading={dataset.loading}
              error={dataError()}
              sector={sector()}
              period={period()}
              periods={periods()}
              selected={selected()}
              states={stateData()}
              national={national()}
              nationalChange={nationalChange()}
              history={history()}
              nationalHistory={nationalHistory()}
              playing={playing()}
              copied={copied()}
              copyError={copyError()}
              onSelect={chooseState}
              onSector={setSector}
              onPeriod={choosePeriod}
              onPlay={togglePlayback}
              onShare={share}
              onDownload={() =>
                downloadCSV(
                  dataset()!.rows.filter(
                    (row) => row.period === period() && row.sector === sector(),
                  ),
                  sector(),
                  period(),
                )
              }
              onRetry={() => refetch()}
            />
          }
        >
          <div class="app-shell">
            <aside class="sidebar">
              <a class="brand" href="/" aria-label="Electricity Map home">
                <span class="brand-mark">
                  <Zap size={22} fill="currentColor" />
                </span>
                <span>
                  electricity
                  <span class="brand-line">
                    map<span class="brand-dot">.</span>
                  </span>
                </span>
              </a>
              <div class="sidebar-intro">
                <span class="eyebrow">AN EXPERIMENT IN ENERGY</span>
                <p>
                  A different
                  <br />
                  kind of <em>current.</em>
                </p>
              </div>
              <div class="nav-label">
                CHOOSE YOUR LENS <span>03</span>
              </div>
              <nav class="lens-navigation" aria-label="Visualization mode">
                <For each={LENSES}>
                  {(item) => (
                    <button
                      class="lens-nav"
                      classList={{ active: view() === item.id }}
                      aria-label={`${item.name}, experiment ${item.number}`}
                      aria-pressed={view() === item.id}
                      onClick={() => {
                        setView(item.id);
                        setHovered(null);
                      }}
                    >
                      <span class="lens-nav-icon">
                        <item.icon size={19} strokeWidth={1.5} />
                      </span>
                      <span>
                        <strong>{item.name}</strong>
                        <small>EXPERIMENT {item.number}</small>
                      </span>
                      <ArrowRight size={14} class="nav-arrow" />
                    </button>
                  )}
                </For>
              </nav>
              <div class="sidebar-bottom">
                <div class="power-sketch" aria-hidden="true">
                  <svg viewBox="0 0 160 75">
                    <path
                      d="M0 45h25l9-21 15 42 16-57 16 42 12-21 12 15h55"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.2"
                    />
                    <circle cx="105" cy="45" r="4" fill="currentColor" />
                  </svg>
                </div>
                <p>
                  Same data.
                  <br />
                  Different dimensions.
                </p>
                <div class="sidebar-source">
                  <span class="status-dot" /> REAL DATA, REAL CURRENT
                </div>
                <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                  Powered by U.S. EIA <ArrowUpRight size={13} />
                </a>
              </div>
            </aside>

            <main class="workspace">
              <header class="topbar">
                <div class="breadcrumb">
                  THE ENERGY OBSERVATORY <span>/</span> <strong>UNITED STATES</strong>
                </div>
                <div class="topbar-actions">
                  <span class="snapshot-label">
                    <span class="status-dot" /> EIA DATA SNAPSHOT
                  </span>
                  <button
                    class="icon-button"
                    aria-label="About the data and visualizations"
                    onClick={() => methods.showModal()}
                  >
                    <CircleHelp size={18} />
                  </button>
                  <button class="share-button" onClick={share}>
                    {copied() ? <Check size={14} /> : <LinkIcon size={14} />}
                    <span>{copied() ? 'Link copied' : 'Share view'}</span>
                  </button>
                </div>
              </header>
              <Show when={copyError()}>
                <div class="notice" role="status">
                  Copy the address in your browser to share this view.
                </div>
              </Show>

              <Show
                when={!dataset.loading && dataset()}
                fallback={
                  <Show when={!dataError()}>
                    <section class="loading-state" aria-live="polite">
                      <span class="loading-orbit">
                        <Zap size={30} />
                      </span>
                      <h1>Finding the current.</h1>
                      <p>Loading the EIA electricity snapshot…</p>
                    </section>
                  </Show>
                }
              >
                <section class="page-heading">
                  <div>
                    <div class="eyebrow">
                      <span class="tiny-line" /> FIELD NOTES / {lens().number}
                    </div>
                    <h1>
                      {lens().name}
                      <span class="heading-period">.</span>
                    </h1>
                    <p>{lens().subtitle}</p>
                  </div>
                  <div class="data-controls">
                    <label>
                      END-USE SECTOR
                      <select
                        aria-label="End-use sector"
                        value={sector()}
                        onChange={(event) => setSector(event.currentTarget.value as Sector)}
                      >
                        <For each={SECTORS}>
                          {(item) => <option value={item.id}>{item.name}</option>}
                        </For>
                      </select>
                    </label>
                    <label>
                      GEOGRAPHY
                      <select
                        aria-label="Selected state"
                        value={selected()}
                        onChange={(event) => chooseState(event.currentTarget.value)}
                      >
                        <For each={STATES}>
                          {(state) => <option value={state.id}>{state.name}</option>}
                        </For>
                      </select>
                    </label>
                  </div>
                </section>

                <section class="metrics" aria-label="National electricity statistics">
                  <div class="metric">
                    <span class="metric-label">
                      U.S. AVERAGE PRICE <span class="metric-dot" />
                    </span>
                    <div>
                      <strong data-testid="national-price">{price(national()?.price)}</strong>
                      <span class="metric-unit">¢ / kWh</span>
                      <span
                        class="metric-change"
                        classList={{ decreasing: (nationalChange() ?? 0) < 0 }}
                      >
                        {signed(nationalChange())}
                        <small>vs. year ago</small>
                      </span>
                    </div>
                  </div>
                  <div class="metric">
                    <span class="metric-label">ELECTRICITY SOLD</span>
                    <div>
                      <strong>
                        {national()?.sales == null ? '—' : (national()!.sales! / 1000).toFixed(1)}
                      </strong>
                      <span class="metric-unit">TWh</span>
                      <small class="metric-note">
                        {SECTORS.find((item) => item.id === sector())?.name}
                        <br />
                        {quarter(period())}
                      </small>
                    </div>
                  </div>
                  <div class="metric">
                    <span class="metric-label">STATE PRICE SPREAD</span>
                    <div>
                      <strong>{price(spread())}</strong>
                      <span class="metric-unit">¢ / kWh</span>
                      <small class="metric-note">
                        {pricedStates().at(-1)?.id ?? '—'} <span>→</span>{' '}
                        {pricedStates()[0]?.id ?? '—'}
                        <br />
                        lowest to highest
                      </small>
                    </div>
                  </div>
                </section>

                <div class="exploration-layout">
                  <section class="visualization-panel" aria-label={lens().name}>
                    <div class="visualization-header">
                      <div>
                        <span class="panel-number">{lens().number}</span>
                        <span class="eyebrow">{lens().tag}</span>
                      </div>
                      <div class="visualization-tools">
                        <span class="quarter-badge">{quarter(period())}</span>
                        <Show when={view() === 'atlas'}>
                          <button
                            class="relief-button"
                            aria-pressed={relief()}
                            onClick={() => setRelief(!relief())}
                          >
                            <Layers size={14} />
                            {relief() ? '3D relief' : 'Flat map'}
                          </button>
                        </Show>
                      </div>
                    </div>
                    <div class="visualization-stage" data-testid="visualization-stage">
                      <Show when={view() === 'atlas'}>
                        <Atlas
                          states={stateData()}
                          selected={selected()}
                          relief={relief()}
                          onSelect={chooseState}
                          onHover={setHovered}
                        />
                      </Show>
                      <Show when={view() === 'orbit'}>
                        <Orbit
                          states={stateData()}
                          selected={selected()}
                          onSelect={chooseState}
                          onHover={setHovered}
                        />
                      </Show>
                      <Show when={view() === 'spiral'}>
                        <Spiral
                          history={history()}
                          national={nationalHistory()}
                          period={period()}
                          name={focused().name}
                          onPeriod={choosePeriod}
                          onHoverPeriod={setHoveredPeriod}
                        />
                      </Show>
                      <Show when={hovered()}>
                        <div class="hover-readout" aria-live="polite">
                          <span
                            style={{
                              background: priceColor(detail().observation?.price),
                            }}
                          />
                          {detail().name}
                          <strong>
                            {price(detail().observation?.price)}
                            <small>¢/kWh</small>
                          </strong>
                        </div>
                      </Show>
                      <Show when={hoverHistory()}>
                        <div class="hover-readout">
                          <span
                            style={{
                              background: priceColor(hoverHistory()?.price),
                            }}
                          />
                          {quarter(hoveredPeriod()!)}
                          <strong>
                            {price(hoverHistory()?.price)}
                            <small>¢/kWh</small>
                          </strong>
                        </div>
                      </Show>
                      <div class="stage-annotation">
                        <span class="annotation-cross">+</span>
                        <p>{lens().description}</p>
                      </div>
                    </div>
                    <div class="visualization-footer">
                      <div class="legend">
                        <div class="legend-label">PRICE / ¢ PER kWh</div>
                        <div class="legend-gradient" />
                        <div class="legend-ticks">
                          <span>≤5</span>
                          <span>20</span>
                          <span>35</span>
                          <span>≥50</span>
                        </div>
                      </div>
                      <span class="encoding-note">
                        {lens().encoding}
                        <br />
                        <small>
                          {view() === 'spiral'
                            ? 'Select any dot to travel through time'
                            : 'Select a state to follow its story'}
                        </small>
                      </span>
                    </div>
                  </section>

                  <aside class="detail-panel" aria-label="State electricity details">
                    <div class="detail-topline">
                      <span class="eyebrow">UNDER THE MICROSCOPE</span>
                      <span class="selection-indicator">{hovered() ? 'HOVERING' : 'SELECTED'}</span>
                    </div>
                    <div class="state-heading">
                      <span
                        class="state-monogram"
                        style={{
                          color: priceColor(detail().observation?.price),
                        }}
                      >
                        {detail().id}
                      </span>
                      <div>
                        <h2>{detail().name}</h2>
                        <span>
                          {detail().region} <span class="dot-divider">·</span> {quarter(period())}
                        </span>
                      </div>
                    </div>
                    <div class="state-price">
                      <strong data-testid="state-price">
                        {price(detail().observation?.price)}
                      </strong>
                      <span>¢ / kWh</span>
                    </div>
                    <div class="state-comparison">
                      <span
                        classList={{
                          above: (detail().observation?.price ?? 0) > (national()?.price ?? 0),
                        }}
                      >
                        {signed(percentage(detail().observation?.price, national()?.price))}
                      </span>{' '}
                      vs. U.S. average
                    </div>
                    <div class="state-facts">
                      <div>
                        <span>Year-over-year</span>
                        <strong>{signed(detail().change)}</strong>
                      </div>
                      <div>
                        <span>Electricity sold</span>
                        <strong>{sales(detail().observation?.sales)}</strong>
                      </div>
                      <div>
                        <span>Price rank</span>
                        <strong>
                          {selectedRank() || '—'}
                          <small> / {pricedStates().length}</small>
                        </strong>
                      </div>
                    </div>
                    <div class="history-heading">
                      <span class="eyebrow">{focused().id} THROUGH TIME</span>
                      <span>¢/kWh</span>
                    </div>
                    <Sparkline history={history()} period={period()} onPeriod={choosePeriod} />
                    <div class="history-range">
                      <span>2015</span>
                      <span>{periods().at(-1)?.slice(0, 4)}</span>
                    </div>
                    <div class="ranking-heading">
                      <h3>Power rankings</h3>
                      <button
                        onClick={() => setRanking(ranking() === 'high' ? 'low' : 'high')}
                        aria-label={`Sort ${ranking() === 'high' ? 'lowest' : 'highest'} prices first`}
                      >
                        {ranking() === 'high' ? 'Highest first' : 'Lowest first'}
                        <RotateCcw size={11} />
                      </button>
                    </div>
                    <label class="state-search">
                      <Search size={13} />
                      <input
                        aria-label="Find a state in rankings"
                        placeholder="Find a state"
                        value={search()}
                        onInput={(event) => setSearch(event.currentTarget.value)}
                      />
                    </label>
                    <div class="rankings">
                      <For
                        each={visibleRanking()}
                        fallback={<p class="empty-ranking">No states match “{search()}”.</p>}
                      >
                        {(state) => (
                          <button
                            class="ranking-row"
                            classList={{ selected: selected() === state.id }}
                            onClick={() => chooseState(state.id)}
                          >
                            <span class="ranking-state">{state.id}</span>
                            <span class="ranking-track">
                              <span
                                style={{
                                  width: `${Math.min(100, (state.observation!.price! / 50) * 100)}%`,
                                  background: priceColor(state.observation?.price),
                                }}
                              />
                            </span>
                            <strong>{price(state.observation?.price)}</strong>
                            <ChevronRight size={11} />
                          </button>
                        )}
                      </For>
                    </div>
                  </aside>
                </div>

                <section class="timeline-panel" aria-label="Quarter timeline">
                  <button
                    class="play-button"
                    aria-label={playing() ? 'Pause timeline' : 'Play timeline'}
                    aria-pressed={playing()}
                    onClick={togglePlayback}
                  >
                    {playing() ? (
                      <Pause size={16} fill="currentColor" />
                    ) : (
                      <Play size={16} fill="currentColor" />
                    )}
                  </button>
                  <div class="timeline-current">
                    <span class="eyebrow">TIME TRAVEL</span>
                    <strong aria-live="polite">{quarter(period())}</strong>
                  </div>
                  <div class="timeline-track">
                    <input
                      type="range"
                      aria-label="Quarter"
                      min="0"
                      max={periods().length - 1}
                      value={currentIndex()}
                      onInput={(event) =>
                        choosePeriod(periods()[Number(event.currentTarget.value)])
                      }
                      style={{
                        '--progress': `${(currentIndex() / Math.max(1, periods().length - 1)) * 100}%`,
                      }}
                    />
                    <div class="timeline-years">
                      <span>2015</span>
                      <span>2018</span>
                      <span>2021</span>
                      <span>2024</span>
                      <span>{periods().at(-1)?.slice(0, 4)}</span>
                    </div>
                  </div>
                  <div class="timeline-stepper">
                    <button
                      class="icon-button"
                      aria-label="Previous quarter"
                      disabled={currentIndex() === 0}
                      onClick={() => step(-1)}
                    >
                      <ChevronLeft size={17} />
                    </button>
                    <button
                      class="icon-button"
                      aria-label="Next quarter"
                      disabled={currentIndex() === periods().length - 1}
                      onClick={() => step(1)}
                    >
                      <ChevronRight size={17} />
                    </button>
                  </div>
                </section>
                <footer class="workspace-footer">
                  <p>
                    <span class="status-dot" /> 50 states + DC <span class="dot-divider">·</span>{' '}
                    {periods().length} quarters <span class="dot-divider">·</span>{' '}
                    {SECTORS.find((item) => item.id === sector())?.name}{' '}
                    <span class="dot-divider">·</span> Snapshot{' '}
                    {new Date(dataset()!.fetchedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                  <div>
                    <button
                      onClick={() =>
                        downloadCSV(
                          dataset()!.rows.filter(
                            (row) => row.period === period() && row.sector === sector(),
                          ),
                          sector(),
                          period(),
                        )
                      }
                    >
                      <Download size={13} /> Download quarter
                    </button>
                    <a href={SOURCE_URL} target="_blank" rel="noreferrer">
                      Explore the source <ExternalLink size={12} />
                    </a>
                  </div>
                </footer>
              </Show>
              <Show when={dataError()}>
                <section class="error-state" role="alert">
                  <Zap size={28} />
                  <h1>A break in the circuit.</h1>
                  <p>
                    {dataError()} Start the Node service with <code>npm run dev</code>.
                  </p>
                  <button class="primary-button" onClick={() => refetch()}>
                    Try again <RotateCcw size={14} />
                  </button>
                </section>
              </Show>
            </main>

            <dialog
              class="methods-dialog"
              ref={methods}
              aria-labelledby="methods-title"
              onClick={(event) => {
                if (event.target === methods) methods.close();
              }}
            >
              <div class="methods-content">
                <button
                  class="icon-button dialog-close"
                  aria-label="Close data notes"
                  onClick={() => methods.close()}
                >
                  <X size={20} />
                </button>
                <span class="eyebrow">BEHIND THE CURRENT</span>
                <h2 id="methods-title">
                  Real data.
                  <br />
                  <em>Unusual perspectives.</em>
                </h2>
                <p>
                  Electricity Map reimagines average retail electricity prices from the U.S. Energy
                  Information Administration. The default is the residential quarterly series in
                  your original EIA link.
                </p>
                <dl>
                  <dt>What you’re seeing</dt>
                  <dd>
                    50 states plus DC, quarterly since 2015. Prices are nominal cents per
                    kilowatt-hour. Sales are converted from million kWh to TWh. The national price
                    is EIA’s reported U.S. total, rather than an average of state prices.
                  </dd>
                  <dt>The electric atlas</dt>
                  <dd>
                    Albers USA geography. Elevation is linear in price (capped at 145 SVG units);
                    color uses a fixed 5–50¢ scale across every view and quarter. Alaska and Hawaii
                    are inset. Select “Flat map” to remove elevation.
                  </dd>
                  <dt>The price constellation</dt>
                  <dd>
                    Radial distance is linear in price, capped at 50¢. Beyond-cap values remain
                    visible in details. Bubble area increases with electricity sold. States are
                    ordered by Census region. Connecting lines are visual guides, not power
                    transmission connections.
                  </dd>
                  <dt>The time machine</dt>
                  <dd>
                    Each successive marker is one quarter, spiraling outward from 2015. Color and
                    marker area indicate price. Solid dots track your state; hollow dots track the
                    U.S. Missing values appear in gray and are never replaced with zero.
                  </dd>
                  <dt>Data freshness</dt>
                  <dd>
                    This is a dated snapshot, not a live grid feed. Fetched{' '}
                    {dataset() ? new Date(dataset()!.fetchedAt).toLocaleString() : 'from EIA'};
                    latest quarter {periods().length ? quarter(periods().at(-1)!) : 'loading'}. Run{' '}
                    <code>npm run data:refresh</code> to update the snapshot, then restart the Node
                    server.
                  </dd>
                </dl>
                <a class="source-link" href={SOURCE_URL} target="_blank" rel="noreferrer">
                  Open the original EIA data browser <ArrowUpRight size={15} />
                </a>
              </div>
            </dialog>
          </div>
        </Show>
      </Show>
    </>
  );
}
