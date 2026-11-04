import { createSignal } from 'solid-js';

export type AppIcon = 'purple' | 'blue';
const storageKey = 'electricity-map:app-icon';
function initialIcon(): AppIcon {
  if (window.electricityDesktop) return 'purple';
  try {
    return localStorage.getItem(storageKey) === 'blue' ? 'blue' : 'purple';
  } catch {
    return 'purple';
  }
}
export const [appIcon, setAppIcon] = createSignal<AppIcon>(initialIcon());
export const appIconURL = () => `/icons/${appIcon()}.png`;

export async function chooseAppIcon(icon: AppIcon) {
  if (window.electricityDesktop) {
    setAppIcon(await window.electricityDesktop.setAppIcon(icon));
  } else {
    localStorage.setItem(storageKey, icon);
    setAppIcon(icon);
  }
}
