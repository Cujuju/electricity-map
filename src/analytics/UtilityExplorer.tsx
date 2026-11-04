import { createMemo, createSignal, createEffect, For, Show } from 'solid-js';
import { Search, ArrowUpRight, Building2, MapPin } from 'lucide-solid';
import type { Sector } from '../types';
import type { UtilityDataset, UtilityObservation } from './types';
import { display, signedValue, pct, downloadAnalysis } from './math';

export default function UtilityExplorer(props: {
  data: UtilityDataset;
  state: string;
  sector: Sector;
}) {
  const params = new URLSearchParams(window.location.search);
  const [year, setYear] = createSignal(
    props.data.years.includes(Number(params.get('utilityYear')))
      ? Number(params.get('utilityYear'))
      : props.data.years.at(-1)!,
  );
  const [county, setCounty] = createSignal(params.get('county') ?? '');
  const [search, setSearch] = createSignal(params.get('utilitySearch') ?? '');
  const [selected, setSelected] = createSignal(params.get('utility') ?? '');
  const [limit, setLimit] = createSignal(60);
  const key = (row: UtilityObservation) => `${row.id}:${row.state}:${row.sector}:${row.service}`;
  const current = createMemo(() =>
    props.data.records.filter(
      (row) => row.year === year() && row.state === props.state && row.sector === props.sector,
    ),
  );
  const counties = (row: UtilityObservation) =>
    props.data.territories[`${row.id}:${row.state}`] ?? [];
  const countyOptions = createMemo(() => [...new Set(current().flatMap(counties))].sort());
  const filtered = createMemo(() =>
    current()
      .filter(
        (row) =>
          (!county() || counties(row).includes(county())) &&
          `${row.name} ${row.id} ${counties(row).join(' ')}`
            .toLowerCase()
            .includes(search().toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const focused = createMemo(() => filtered().find((row) => key(row) === selected()));
  const history = createMemo(() => {
    const row = focused();
    return row
      ? props.data.records
          .filter((other) => key(other) === key(row))
          .sort((a, b) => a.year - b.year)
      : [];
  });
  const previous = createMemo(() => history().find((row) => row.year === year() - 1));
  createEffect(() => {
    if (!countyOptions().includes(county())) setCounty('');
  });
  createEffect(() => {
    const list = filtered();
    if (!list.some((row) => key(row) === selected())) setSelected(list[0] ? key(list[0]) : '');
  });
  createEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set('utilityYear', String(year()));
    for (const [name, value] of [
      ['county', county()],
      ['utilitySearch', search()],
      ['utility', selected()],
    ]) {
      if (value) q.set(name, value);
      else q.delete(name);
    }
    window.history.replaceState(null, '', `${window.location.pathname}?${q}`);
  });
  return (
    <>
      <div class="utility-intro">
        <Building2 size={35} />
        <div>
          <h2>Go closer. Follow the utility.</h2>
          <p>
            Annual utility-wide averages, {props.data.years.join(' / ')}. County entries identify
            where a utility reported distribution equipment; they are not measured city prices or an
            address-level service guarantee.
          </p>
        </div>
        <a href={props.data.source.url} target="_blank" rel="noreferrer">
          EIA-861 <ArrowUpRight size={14} />
        </a>
      </div>
      <div class="lab-utility-controls">
        <label>
          REPORT YEAR
          <select
            aria-label="Utility report year"
            value={year()}
            onChange={(e) => setYear(Number(e.currentTarget.value))}
          >
            <For each={props.data.years}>{(y) => <option value={y}>{y}</option>}</For>
          </select>
        </label>
        <label>
          COUNTY INDEX
          <select
            aria-label="Utility county filter"
            value={county()}
            onChange={(e) => {
              setCounty(e.currentTarget.value);
              setLimit(60);
            }}
          >
            <option value="">All reported counties</option>
            <For each={countyOptions()}>{(name) => <option>{name}</option>}</For>
          </select>
        </label>
        <label class="utility-search">
          UTILITY OR COUNTY
          <div>
            <Search size={15} />
            <input
              aria-label="Search utilities or counties"
              placeholder="Name, county, or EIA utility ID"
              value={search()}
              onInput={(e) => {
                setSearch(e.currentTarget.value);
                setLimit(60);
              }}
            />
          </div>
        </label>
        <button
          class="lab-action"
          onClick={() =>
            downloadAnalysis(
              filtered().map((row) => ({
                year: row.year,
                utility_id: row.id,
                name: row.name,
                state: row.state,
                sector: row.sector,
                service: row.service,
                price_cents_kwh: row.price,
                sales_million_kwh: row.sales,
                revenue_million_usd: row.revenue,
                customers: row.customers,
                counties_latest_report: counties(row).join('; '),
              })),
              `utilities-${props.state}-${props.sector}-${year()}.csv`,
            )
          }
        >
          Export utilities
        </button>
      </div>
      <div class="utility-workspace">
        <section class="lab-panel utility-results">
          <div class="lab-panel-title">
            <span>THE LOCAL DIRECTORY</span>
            <p data-testid="utility-count">{filtered().length} utility/service records</p>
          </div>
          <div class="utility-list">
            <For
              each={filtered().slice(0, limit())}
              fallback={
                <p class="lab-empty">
                  No matching bundled utility records for this state, sector and search. Short-form
                  providers appear under All sectors.
                </p>
              }
            >
              {(row) => (
                <button
                  class="utility-result"
                  aria-pressed={key(row) === selected()}
                  aria-label={`Inspect ${row.name}`}
                  onClick={() => setSelected(key(row))}
                >
                  <div>
                    <strong>{row.name}</strong>
                    <span>
                      EIA {row.id} / {row.ownership} / {row.service}
                    </span>
                  </div>
                  <b>
                    {display(row.price, 2)}
                    <small>¢/kWh</small>
                  </b>
                </button>
              )}
            </For>
          </div>
          <Show when={filtered().length > limit()}>
            <button class="lab-action" onClick={() => setLimit(limit() + 60)}>
              Show 60 more
            </button>
          </Show>
        </section>
        <aside class="lab-panel utility-profile">
          <Show when={focused()}>
            {(row) => (
              <>
                <span class="lab-kicker">UTILITY / {row().id}</span>
                <h2>{row().name}</h2>
                <p>
                  {row().state} · {row().service} · {year()} ·{' '}
                  {row().imputed ? 'Includes imputed data' : 'Reported survey data'}
                </p>
                <div class="utility-price" data-testid="utility-price">
                  {display(row().price, 2)}
                  <small>¢ / kWh</small>
                </div>
                <div class="lab-mini-facts">
                  <div>
                    <span>Versus {year() - 1}</span>
                    <b>{signedValue(pct(row().price, previous()?.price))}%</b>
                  </div>
                  <div>
                    <span>Customers</span>
                    <b>{display(row().customers, 0)}</b>
                  </div>
                  <div>
                    <span>Electricity sold</span>
                    <b>{display(row().sales === null ? null : row().sales! / 1000, 2)} TWh</b>
                  </div>
                  <div>
                    <span>Revenue</span>
                    <b>${display(row().revenue, 1)}M</b>
                  </div>
                </div>
                <div class="utility-history">
                  <h3>{history().length} annual observations</h3>
                  <For each={history()}>
                    {(point) => (
                      <div>
                        <span>{point.year}</span>
                        <span class="utility-history-track">
                          <i
                            style={{
                              width: `${Math.min(100, ((point.price ?? 0) / Math.max(1, ...history().map((r) => r.price ?? 0))) * 100)}%`,
                            }}
                          />
                        </span>
                        <b>{display(point.price, 2)}¢</b>
                      </div>
                    )}
                  </For>
                </div>
                <details class="lab-details">
                  <summary>
                    <MapPin size={14} /> {counties(row()).length} county entries (
                    {props.data.years.at(-1)})
                  </summary>
                  <p>
                    {counties(row()).join(', ') ||
                      'No county entries in the latest service-territory file.'}
                  </p>
                </details>
                <p class="utility-coverage-note">
                  Prices are calculated from bundled-service revenue and sales, aggregated across
                  balancing authorities for this utility and state. Short-form totals are listed
                  separately under All sectors. Energy-only and delivery-only records are excluded
                  so unlike services are not combined.
                </p>
              </>
            )}
          </Show>
        </aside>
      </div>
    </>
  );
}
