import { createEffect, createSignal, For, onMount, onCleanup, Show } from 'solid-js';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  X,
  Zap,
  ArrowUpRight,
} from 'lucide-solid';
import { DESIGNS, THEMES, themeById, type DashboardId, type ThemeId } from './catalog';
import IconSettings from '../IconSettings';

export default function DesignSwitcher(props: {
  selected: DashboardId;
  onChange: (id: DashboardId) => void;
  theme: ThemeId;
  onTheme: (id: ThemeId) => void;
  mode: 'overview' | 'changes' | 'utilities';
  onMode: (mode: 'overview' | 'changes' | 'utilities') => void;
}) {
  let gallery!: HTMLDialogElement;
  let header!: HTMLDivElement;
  let themePicker!: HTMLDivElement;
  let themeTrigger!: HTMLButtonElement;
  let themePopover: HTMLDivElement | undefined;
  const [themeOpen, setThemeOpen] = createSignal(false);
  onMount(() => {
    const resize = new ResizeObserver(() =>
      document.documentElement.style.setProperty(
        '--studio-header-height',
        `${header.getBoundingClientRect().height}px`,
      ),
    );
    resize.observe(header);
    const onPointerDown = (event: PointerEvent) => {
      if (themeOpen() && !themePicker.contains(event.target as Node)) {
        setThemeOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && themeOpen()) {
        setThemeOpen(false);
        themeTrigger.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    onCleanup(() => {
      resize.disconnect();
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    });
  });
  const options = ['original', ...DESIGNS.map((design) => design.id)] as DashboardId[];
  const selectedDesign = () => DESIGNS.find((design) => design.id === props.selected);
  const selectedTheme = () => themeById(props.theme);
  const step = (direction: number) =>
    props.onChange(
      options[(options.indexOf(props.selected) + direction + options.length) % options.length],
    );
  createEffect(() => {
    document.documentElement.dataset.dashboard = props.selected;
    document.documentElement.dataset.theme = props.theme;
  });
  const choose = (id: DashboardId) => {
    props.onChange(id);
    gallery.close();
  };
  const toggleThemeOpen = () => {
    const next = !themeOpen();
    setThemeOpen(next);
    if (next) {
      queueMicrotask(() => {
        const active = themePopover?.querySelector<HTMLButtonElement>('[aria-selected="true"]');
        active?.focus();
      });
    }
  };
  const chooseTheme = (id: ThemeId) => {
    props.onTheme(id);
    setThemeOpen(false);
    themeTrigger.focus();
  };
  const onPopoverKeyDown = (event: KeyboardEvent) => {
    const items = Array.from(themePopover?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    if (!items.length) return;
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const stepBy = (delta: number) => {
      event.preventDefault();
      const base = index === -1 ? 0 : index;
      items[(base + delta + items.length) % items.length].focus();
    };
    if (event.key === 'ArrowRight') stepBy(1);
    else if (event.key === 'ArrowLeft') stepBy(-1);
    else if (event.key === 'ArrowDown') stepBy(2);
    else if (event.key === 'ArrowUp') stepBy(-2);
    else if (event.key === 'Home') {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1].focus();
    }
  };
  return (
    <>
      <div ref={header} class="design-switcher" aria-label="Dashboard design controls">
        <div
          ref={themePicker}
          class="theme-picker"
          onFocusOut={(event) => {
            if (themeOpen() && !themePicker.contains(event.relatedTarget as Node | null)) {
              setThemeOpen(false);
            }
          }}
        >
          <button
            ref={themeTrigger}
            type="button"
            class="theme-trigger"
            aria-label={`Theme: ${selectedTheme().name}`}
            aria-haspopup="listbox"
            aria-expanded={themeOpen()}
            onClick={toggleThemeOpen}
          >
            <span class="theme-tri-chip" aria-hidden="true">
              <i style={{ background: selectedTheme().palette[0] }} />
              <i style={{ background: selectedTheme().palette[1] }} />
              <i style={{ background: selectedTheme().palette[2] }} />
            </span>
            <span class="theme-trigger-name">{selectedTheme().name}</span>
            <ChevronDown size={13} aria-hidden="true" />
          </button>
          <Show when={themeOpen()}>
            <div
              ref={themePopover}
              class="theme-popover"
              role="listbox"
              aria-label="Color palette"
              onKeyDown={onPopoverKeyDown}
            >
              <div class="theme-popover-head">
                <span>Color Palette</span>
                <span>{THEMES.length} Themes</span>
              </div>
              <div class="theme-popover-grid">
                <For each={THEMES}>
                  {(theme) => (
                    <button
                      type="button"
                      role="option"
                      class="theme-option"
                      aria-selected={props.theme === theme.id}
                      data-theme-id={theme.id}
                      onClick={() => chooseTheme(theme.id)}
                    >
                      <span class="theme-tri-chip" aria-hidden="true">
                        <i style={{ background: theme.palette[0] }} />
                        <i style={{ background: theme.palette[1] }} />
                        <i style={{ background: theme.palette[2] }} />
                      </span>
                      <span>{theme.name}</span>
                      <small>{theme.tone}</small>
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>
        </div>
        <nav class="data-workspace-nav" aria-label="Data workspace">
          <button aria-pressed={props.mode === 'overview'} onClick={() => props.onMode('overview')}>
            Dashboards
          </button>
          <Show when={props.mode === 'overview'}>
            <div class="dashboard-inline-controls">
              <button class="design-lab-button" onClick={() => gallery.showModal()}>
                <Grid2X2 size={15} />
                <span>DESIGN LAB</span>
                <b>10</b>
              </button>
              <div class="design-current">
                <span>{selectedDesign()?.number ?? '00'}</span>
                <label class="sr-only" for="dashboard-design">
                  Dashboard design
                </label>
                <select
                  id="dashboard-design"
                  aria-label="Dashboard design"
                  value={props.selected}
                  onChange={(event) => props.onChange(event.currentTarget.value as DashboardId)}
                >
                  <option value="original">Original Observatory</option>
                  <For each={DESIGNS}>
                    {(design) => (
                      <option value={design.id}>
                        {design.number} — {design.name}
                      </option>
                    )}
                  </For>
                </select>
              </div>
              <div class="design-step">
                <button aria-label="Previous dashboard design" onClick={() => step(-1)}>
                  <ChevronLeft size={16} />
                </button>
                <button aria-label="Next dashboard design" onClick={() => step(1)}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </Show>
          <button aria-pressed={props.mode === 'changes'} onClick={() => props.onMode('changes')}>
            Change Lab
          </button>
          <button
            aria-pressed={props.mode === 'utilities'}
            onClick={() => props.onMode('utilities')}
          >
            Local Utilities
          </button>
        </nav>
        <Show when={props.mode === 'overview'}>
          <button class="design-browse" onClick={() => gallery.showModal()}>
            Browse collection <ArrowUpRight size={13} />
          </button>
        </Show>
        <div class="design-switcher-end">
          <IconSettings />
        </div>
      </div>
      <dialog
        ref={gallery}
        class="design-gallery"
        aria-labelledby="design-gallery-title"
        onClick={(event) => {
          if (event.target === gallery) gallery.close();
        }}
      >
        <div class="gallery-heading">
          <div>
            <span>THE ELECTRICITY MAP COLLECTION</span>
            <h2 id="design-gallery-title">
              Same current.
              <br />
              <em>Ten new directions.</em>
            </h2>
          </div>
          <button
            class="gallery-close"
            aria-label="Close design collection"
            onClick={() => gallery.close()}
          >
            <X size={22} />
          </button>
        </div>
        <div class="gallery-grid">
          <For each={DESIGNS}>
            {(design) => (
              <button
                class="design-card"
                aria-label={`Choose ${design.name}`}
                aria-pressed={props.selected === design.id}
                onClick={() => choose(design.id)}
                style={{
                  '--card-bg': design.palette[0],
                  '--card-ink': design.palette[1],
                  '--card-accent': design.palette[2],
                }}
              >
                <div class={`design-card-art preview-${design.chart}`} aria-hidden="true">
                  <span class="preview-word">
                    {design.id === 'press'
                      ? 'K.'
                      : design.id === 'candy'
                        ? 'pop!'
                        : design.id === 'analog'
                          ? 'FM'
                          : design.id === 'arcade'
                            ? 'PWR_'
                            : design.number}
                  </span>
                  <svg viewBox="0 0 240 110">
                    <For each={Array.from({ length: 17 }, (_, index) => index)}>
                      {(i) => (
                        <rect
                          x={15 + i * 13}
                          y={105 - (((i * 17) % 53) + 14)}
                          width="8"
                          height={((i * 17) % 53) + 14}
                          rx={design.id === 'candy' ? '4' : '0'}
                          fill="currentColor"
                          opacity={0.35 + i / 30}
                        />
                      )}
                    </For>
                    <circle cx="170" cy="45" r="34" fill="none" stroke="currentColor" />
                    <circle cx="170" cy="45" r="19" fill="none" stroke="currentColor" />
                  </svg>
                </div>
                <div class="design-card-caption">
                  <span>{design.number}</span>
                  <strong>{design.name}</strong>
                  <small>{design.category}</small>
                </div>
              </button>
            )}
          </For>
        </div>
        <button class="original-design" onClick={() => choose('original')}>
          <Zap size={16} /> Return to the original Observatory <ArrowUpRight size={14} />
        </button>
      </dialog>
    </>
  );
}
