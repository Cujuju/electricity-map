import { createEffect, For } from 'solid-js';
import { ChevronLeft, ChevronRight, Grid2X2, X, Zap, ArrowUpRight } from 'lucide-solid';
import { DESIGNS, type DashboardId } from './catalog';

export default function DesignSwitcher(props: {
  selected: DashboardId;
  onChange: (id: DashboardId) => void;
}) {
  let gallery!: HTMLDialogElement;
  const options = ['original', ...DESIGNS.map((design) => design.id)] as DashboardId[];
  const selectedDesign = () => DESIGNS.find((design) => design.id === props.selected);
  const step = (direction: number) =>
    props.onChange(
      options[(options.indexOf(props.selected) + direction + options.length) % options.length],
    );
  createEffect(() => {
    document.documentElement.dataset.dashboard = props.selected;
  });
  const choose = (id: DashboardId) => {
    props.onChange(id);
    gallery.close();
  };
  return (
    <>
      <div class="design-switcher" aria-label="Dashboard design controls">
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
        <span class="design-lab-note">ONE DATASET. TEN OTHER WORLDS.</span>
        <button class="design-browse" onClick={() => gallery.showModal()}>
          Browse collection <ArrowUpRight size={13} />
        </button>
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
