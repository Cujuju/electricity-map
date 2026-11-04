import test from 'node:test';
import assert from 'node:assert/strict';
import {
  desktopCSP,
  isExternalURL,
  isTrustedURL,
  normalizeWindowState,
  sanitizeSearch,
  searchFromDeepLink,
} from '../desktop/state.mjs';

test('desktop links accept only the app scheme and recognized dashboard parameters', () => {
  assert.equal(
    searchFromDeepLink('electricity-map://open?state=CA&lab=changes'),
    '?state=CA&lab=changes',
  );
  for (const value of [
    'javascript:alert(1)',
    'https://example.com/?state=CA',
    'electricity-map://other?state=CA',
    'electricity-map://open/path',
    'electricity-map://user@open/?state=CA',
    'electricity-map://open/#unsafe',
  ])
    assert.equal(searchFromDeepLink(value), null);
  assert.equal(sanitizeSearch('?state=TX&file=private&state=CA'), '?state=CA');
  assert.equal(sanitizeSearch(`?county=${'a'.repeat(201)}`), '');
  assert.equal(sanitizeSearch('a'.repeat(6001)), '');
});

test('desktop CSP keeps script execution local and enables blob workers only for Vite development', () => {
  for (const development of [false, true]) {
    const csp = desktopCSP(development);
    assert.ok(csp.includes("script-src 'self';"));
    assert.ok(!csp.includes('unsafe-eval'));
    assert.ok(csp.includes("frame-ancestors 'none'"));
    assert.ok(csp.includes(development ? "worker-src 'self' blob:" : "worker-src 'none'"));
  }
});

test('desktop navigation trusts only the app document at its exact local origin', () => {
  const origin = 'http://127.0.0.1:12345';
  assert.equal(isTrustedURL(`${origin}/?state=TX`, origin), true);
  for (const url of [
    'http://127.0.0.1:12346/',
    'http://localhost:12345/',
    `${origin}/assets/file.js`,
    `${origin}.evil.test/`,
    'file:///private',
    'https://www.eia.gov/',
    'javascript:alert(1)',
  ])
    assert.equal(isTrustedURL(url, origin), false);
  assert.equal(isExternalURL('https://www.eia.gov/'), true);
  for (const url of [
    'file:///private',
    'javascript:alert(1)',
    'https://user:password@example.com/',
  ])
    assert.equal(isExternalURL(url), false);
});

test('window restoration handles unplugged monitors, corrupt sizes and negative display coordinates', () => {
  const areas = [
    { x: 0, y: 0, width: 1440, height: 900 },
    { x: -1920, y: 0, width: 1920, height: 1080 },
  ];
  const restored = normalizeWindowState(
    { x: -1800, y: 100, width: 1200, height: 800, maximized: true, search: '?design=cosmic' },
    areas,
  );
  assert.equal(restored.x, -1800);
  assert.equal(restored.maximized, true);
  assert.equal(restored.search, '?design=cosmic');
  const missing = normalizeWindowState({ x: 9000, y: 9000, width: 6000, height: 6000 }, areas);
  assert.deepEqual(
    { x: missing.x, y: missing.y, width: missing.width, height: missing.height },
    { x: 0, y: 0, width: 1440, height: 900 },
  );
  const corrupt = normalizeWindowState({ width: NaN, height: -10, maximized: 'yes' }, areas);
  assert.equal(corrupt.width, 1440);
  assert.equal(corrupt.height, 600);
  assert.equal(corrupt.maximized, false);
});
