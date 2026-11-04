import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { Copy, Menu, Minus, Square, X } from 'lucide-solid';
import { DESIGNS, type DashboardId } from '../designs/catalog';
import { appIconURL } from '../app-icon';

// Adapted from Spillway's Solid title bar; native macOS traffic lights stay native.
export default function TitleBar(props: { design: DashboardId }) {
  const desktop = window.electricityDesktop;
  if (!desktop) return null;
  const [maximized, setMaximized] = createSignal(false);
  const palette = createMemo(() => DESIGNS.find((design) => design.id === props.design)?.palette);
  onMount(() => {
    document.documentElement.dataset.desktop = desktop.platform;
    let received = false;
    const unsubscribe = desktop.onMaximized((value) => {
      received = true;
      setMaximized(value);
    });
    void desktop
      .getWindowState()
      .then((state) => {
        if (!received) setMaximized(state.maximized);
      })
      .catch(() => {});
    onCleanup(unsubscribe);
  });
  return (
    <header
      class="desktop-titlebar"
      aria-label="Application title bar"
      style={{
        '--desktop-chrome-bg': palette()?.[0] ?? '#111916',
        '--desktop-chrome-fg': palette()?.[1] ?? '#e8eddf',
      }}
    >
      <img src={appIconURL()} alt="" width="22" height="22" />
      <span>ELECTRICITY MAP</span>
      <div class="desktop-window-controls">
        <button aria-label="Application menu" title="Application menu" onClick={desktop.showMenu}>
          <Menu size={15} />
        </button>
        <Show when={desktop.platform !== 'darwin'}>
          <button aria-label="Minimize window" title="Minimize" onClick={desktop.minimize}>
            <Minus size={14} />
          </button>
          <button
            aria-label={maximized() ? 'Restore window' : 'Maximize window'}
            title={maximized() ? 'Restore' : 'Maximize'}
            onClick={desktop.toggleMaximize}
          >
            <Show when={maximized()} fallback={<Square size={12} />}>
              <Copy size={12} />
            </Show>
          </button>
          <button
            class="desktop-window-close"
            aria-label="Close window"
            title="Close"
            onClick={desktop.close}
          >
            <X size={15} />
          </button>
        </Show>
      </div>
    </header>
  );
}
