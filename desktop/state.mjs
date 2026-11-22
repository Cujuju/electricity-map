import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const PARAMETERS = new Set([
  'view',
  'sector',
  'state',
  'period',
  'design',
  'lab',
  'month',
  'compare',
  'since',
  'grain',
  'from',
  'to',
  'metric',
  'kwh',
  'utilityYear',
  'county',
  'utilitySearch',
  'utility',
]);

export function desktopCSP(development = false) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${development ? ' ws://127.0.0.1:*' : ''}`,
    `worker-src ${development ? "'self' blob:" : "'none'"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join('; ');
}

export function sanitizeSearch(search) {
  if (typeof search !== 'string' || search.length > 6000) return '';
  const result = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(search)) {
    if (PARAMETERS.has(key) && value.length <= 200) result.set(key, value);
  }
  return result.size ? `?${result}` : '';
}

export function searchFromDeepLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'electricity-map:' &&
      url.hostname === 'open' &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      (url.pathname === '' || url.pathname === '/')
      ? sanitizeSearch(url.search)
      : null;
  } catch {
    return null;
  }
}

export function isTrustedURL(value, origin) {
  try {
    const url = new URL(value);
    return url.origin === origin && url.pathname === '/' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isExternalURL(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Adapted from Spillway: restore bounds only on a connected display.
export function normalizeWindowState(value, areas) {
  const saved = value && typeof value === 'object' ? value : {};
  const area =
    areas.find(
      (a) =>
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y) &&
        saved.x >= a.x &&
        saved.x < a.x + a.width - 80 &&
        saved.y >= a.y &&
        saved.y < a.y + a.height - 36,
    ) ?? areas[0];
  const width = Math.min(
    area.width,
    Math.max(Math.min(900, area.width), Number.isFinite(saved.width) ? saved.width : 1440),
  );
  const height = Math.min(
    area.height,
    Math.max(Math.min(600, area.height), Number.isFinite(saved.height) ? saved.height : 1000),
  );
  return {
    width: Math.round(width),
    height: Math.round(height),
    x: Math.round(
      Math.max(
        area.x,
        Math.min(
          area.x + area.width - width,
          Number.isFinite(saved.x) ? saved.x : area.x + (area.width - width) / 2,
        ),
      ),
    ),
    y: Math.round(
      Math.max(
        area.y,
        Math.min(
          area.y + area.height - height,
          Number.isFinite(saved.y) ? saved.y : area.y + (area.height - height) / 2,
        ),
      ),
    ),
    maximized: saved.maximized === true,
    search: sanitizeSearch(saved.search),
  };
}

export function readWindowState(file, areas) {
  let saved;
  try {
    saved = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    saved = {};
  }
  return normalizeWindowState(saved, areas);
}

export function writeWindowState(file, state) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(`${file}.tmp`, JSON.stringify(state));
  renameSync(`${file}.tmp`, file);
}

export function readIconPreference(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'))?.icon === 'blue' ? 'blue' : 'purple';
  } catch {
    return 'purple';
  }
}

export function writeIconPreference(file, icon) {
  if (icon !== 'blue' && icon !== 'purple') throw new Error('Unknown app icon');
  writeWindowState(file, { icon });
}
