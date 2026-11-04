import { createEffect, createSignal, For, onMount, Show } from 'solid-js';
import { X } from 'lucide-solid';
import { appIcon, appIconURL, chooseAppIcon, setAppIcon, type AppIcon } from './app-icon';

export default function IconSettings() {
  let dialog!: HTMLDialogElement;
  const [ready, setReady] = createSignal(!window.electricityDesktop);
  const [saving, setSaving] = createSignal(false);
  const [error, setError] = createSignal('');
  onMount(() => {
    const desktop = window.electricityDesktop;
    if (desktop)
      void desktop.getAppIcon()
        .then((icon) => {
          setAppIcon(icon);
          setReady(true);
        })
        .catch(() => setError('Could not load your icon preference. Please reopen the app.'));
  });
  createEffect(() => {
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.type = 'image/png';
      favicon.href = appIconURL();
    }
  });
  const choose = async (icon: AppIcon) => {
    setSaving(true);
    setError('');
    try {
      await chooseAppIcon(icon);
    } catch {
      setError('Could not save your icon preference. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button class="app-icon-trigger" aria-label="App icon" onClick={() => dialog.showModal()}>
        <img src={appIconURL()} width="24" height="24" alt="" />
        <span>App icon</span>
      </button>
      <dialog
        ref={dialog}
        class="app-icon-settings"
        aria-labelledby="app-icon-title"
        onClick={(event) => {
          if (event.target === dialog) dialog.close();
        }}
      >
        <div class="app-icon-heading">
          <h2 id="app-icon-title">Choose your app icon</h2>
          <button aria-label="Close icon settings" onClick={() => dialog.close()}>
            <X size={20} />
          </button>
        </div>
        <p>Choose the backdrop for your electrical map.</p>
        <div class="app-icon-options" role="group" aria-label="App icon color">
          <For each={['purple', 'blue'] as const}>
            {(icon) => (
              <button
                class="app-icon-option"
                aria-label={`${icon === 'purple' ? 'Purple' : 'Blue'} app icon`}
                aria-pressed={appIcon() === icon}
                disabled={!ready() || saving()}
                onClick={() => void choose(icon)}
              >
                <img src={`/icons/${icon}.png`} alt="" width="180" height="180" />
                <strong>{icon === 'purple' ? 'Purple' : 'Blue'}</strong>
                <span>{appIcon() === icon ? 'Selected' : 'Choose'}</span>
              </button>
            )}
          </For>
        </div>
        <p class="app-icon-status" role="status">
          {saving() ? 'Saving…' : 'Your choice is remembered on this device.'}
        </p>
        <Show when={error()}>
          <p role="alert">{error()}</p>
        </Show>
      </dialog>
    </>
  );
}
