import { _electron as electron, expect, test, type ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import electronPath from 'electron';
import { startDevelopment } from '../scripts/development.mjs';

test('desktop shell isolates Node, controls its window, exports, shares and restores dashboards', async ({}, info) => {
  const profile = await mkdtemp(join(tmpdir(), 'electricity-map-test-'));
  const root = resolve(import.meta.dirname, '..');
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.ELECTRICITY_MAP_PROFILE = profile;
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  const launch = () =>
    electron.launch({
      executablePath: process.env.ELECTRICITY_MAP_EXECUTABLE ?? String(electronPath),
      args: process.env.ELECTRICITY_MAP_EXECUTABLE ? [] : [root],
      cwd: root,
      env,
      timeout: 30000,
    });
  try {
    app = await launch();
    let page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await expect(page.getByRole('heading', { name: 'Electric atlas.' })).toBeVisible();
    await expect(page.getByRole('banner', { name: 'Application title bar' })).toBeVisible();
    // The scrollbar belongs to the content under the title bar, not the whole window.
    const scrolling = await page.evaluate(() => {
      const bar = document.querySelector('.desktop-titlebar')!.getBoundingClientRect();
      const content = document.querySelector('.app-content')!;
      return {
        documentScrolls: document.documentElement.scrollHeight > innerHeight,
        contentTop: content.getBoundingClientRect().top,
        barBottom: bar.bottom,
        contentScrolls: content.scrollHeight > content.clientHeight,
        contentOverflow: getComputedStyle(content).overflowY,
      };
    });
    expect(scrolling).toEqual({
      documentScrolls: false,
      contentTop: scrolling.barBottom,
      barBottom: scrolling.barBottom,
      contentScrolls: true,
      contentOverflow: 'auto',
    });
    expect(
      await page.evaluate(() => ({
        require: typeof Reflect.get(window, 'require'),
        process: typeof Reflect.get(window, 'process'),
      })),
    ).toEqual({ require: 'undefined', process: 'undefined' });
    const options = await app.evaluate(({ app, BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      const { existsSync } = process.getBuiltinModule('fs');
      const { join } = process.getBuiltinModule('path');
      return {
        version: process.versions.electron,
        port: new URL(w.webContents.getURL()).port,
        packaged: app.isPackaged,
        icon: existsSync(
          app.isPackaged
            ? join(process.resourcesPath, 'icon.png')
            : join(app.getAppPath(), 'resources/icon.png'),
        ),
        notices:
          !app.isPackaged ||
          existsSync(join(process.resourcesPath, 'licenses/npm/npm-renderer.txt')),
      };
    });
    expect(Number(options.version?.split('.')[0])).toBeGreaterThanOrEqual(45);
    expect(Number(options.port)).toBeGreaterThan(0);
    expect(options.packaged).toBe(Boolean(process.env.ELECTRICITY_MAP_EXECUTABLE));
    expect(options.icon).toBe(true);
    expect(options.notices).toBe(true);
    const titleIcon = page.locator('.desktop-titlebar > img');
    await expect(titleIcon).toHaveAttribute('src', '/icons/purple.png');
    await page.getByRole('button', { name: 'App icon', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Purple app icon', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Blue app icon', exact: true }).click();
    await expect(titleIcon).toHaveAttribute('src', '/icons/blue.png');
    await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/icons/blue.png');
    await expect.poll(() => readFile(join(profile, 'icon-preference.json'), 'utf8')).toBe('{"icon":"blue"}');
    await page.getByRole('button', { name: 'Close icon settings' }).click();
    const headers = await page.evaluate(async () => {
      const r = await fetch('/api/health');
      return { csp: r.headers.get('Content-Security-Policy'), body: await r.json() };
    });
    expect(headers.csp).toContain("script-src 'self'");
    expect(headers.body.status).toBe('ok');
    if (process.platform !== 'darwin') {
      await page.getByRole('button', { name: 'Maximize window', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Restore window', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Restore window', exact: true }).click();
      await expect(
        page.getByRole('button', { name: 'Maximize window', exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Minimize window', exact: true }).click();
      await expect
        .poll(() =>
          app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()),
        )
        .toBe(true);
      await app.evaluate(({ BrowserWindow }) => {
        const w = BrowserWindow.getAllWindows()[0];
        w.restore();
        w.focus();
      });
    }
    await app.evaluate(({ app }, uri) => {
      app.emit('open-url', { preventDefault() {} }, uri);
    }, 'electricity-map://open?design=cosmic&lab=changes&state=TX&sector=RES&month=2026-08');
    await expect(page.getByTestId('analysis-studio')).toHaveClass(/skin-cosmic/);
    await expect(page.getByLabel('Analysis state', { exact: true })).toHaveValue('TX');
    await page.getByRole('button', { name: 'Share analysis' }).click();
    await expect
      .poll(() => app!.evaluate(({ clipboard }) => clipboard.readText()))
      .toMatch(/^electricity-map:\/\/open\?.*state=TX/);
    const exported = join(profile, 'comparison.csv');
    await app.evaluate(({ BrowserWindow }, output) => {
      BrowserWindow.getAllWindows()[0].webContents.session.once('will-download', (_event, item) =>
        item.setSavePath(output),
      );
    }, exported);
    await page.getByRole('button', { name: 'Export comparison' }).click();
    await expect
      .poll(async () => readFile(exported, 'utf8').catch(() => ''))
      .toContain('scenario_kwh,metric,metric_unit,value');
    await page.evaluate(() => {
      location.href = 'data:text/html,blocked';
    });
    await expect(page.getByTestId('analysis-studio')).toBeVisible();
    expect(page.url()).toMatch(/^http:\/\/127\.0\.0\.1:\d+\//);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: info.outputPath('electron-change-lab.png') });
    expect(errors).toEqual([]);
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(page.locator('.desktop-titlebar > img')).toHaveAttribute('src', '/icons/blue.png');
    await page.getByRole('button', { name: 'App icon', exact: true }).click();
    await page.getByRole('button', { name: 'Purple app icon', exact: true }).click();
    await expect(page.locator('.desktop-titlebar > img')).toHaveAttribute('src', '/icons/purple.png');
    await page.getByRole('button', { name: 'Close icon settings' }).click();
    await expect(page.getByTestId('analysis-studio')).toHaveClass(/skin-cosmic/);
    await expect(page.getByLabel('Analysis state', { exact: true })).toHaveValue('TX');
    await expect(page.getByLabel('Analysis month', { exact: true })).toHaveValue('2026-08');
    await page.getByRole('button', { name: 'Local Utilities', exact: true }).click();
    await expect(page.getByLabel('Utility report year', { exact: true })).toBeVisible();
    await expect(page.locator('.utility-result').first()).toBeVisible();
  } finally {
    await app?.close().catch(() => {});
    if (profile.startsWith(join(tmpdir(), 'electricity-map-test-')))
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});

test('desktop development runs Vite and its Node API and shuts both down', async () => {
  test.skip(
    Boolean(process.env.ELECTRICITY_MAP_EXECUTABLE),
    'Development mode belongs to the source checkout.',
  );
  const profile = await mkdtemp(join(tmpdir(), 'electricity-map-test-'));
  const env: Record<string, string> = Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
  env.ELECTRICITY_MAP_PROFILE = profile;
  delete env.ELECTRON_RUN_AS_NODE;
  let app: ElectronApplication | undefined;
  let services: Awaited<ReturnType<typeof startDevelopment>> | undefined;
  try {
    services = await startDevelopment();
    env.ELECTRICITY_MAP_RENDERER_URL = services.origin;
    app = await electron.launch({
      args: [resolve(import.meta.dirname, '..'), '--dev'],
      env,
      timeout: 30000,
    });
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForURL(`${services.origin}/**`, {
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    });
    await expect(page.getByRole('heading', { name: 'Electric atlas.' })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('banner', { name: 'Application title bar' })).toBeVisible();
    const health = await page.evaluate(async () => {
      const response = await fetch('/api/health');
      return (await response.json()).status;
    });
    expect(health).toBe('ok');
    expect(errors).toEqual([]);
    const client = await page.request.get(`${new URL(page.url()).origin}/@vite/client`);
    expect(client.status()).toBe(200);
    expect(client.headers()['content-security-policy']).toContain("script-src 'self'");
    const origin = new URL(page.url()).origin;
    await app.close();
    app = undefined;
    await services.close();
    services = undefined;
    await expect
      .poll(() =>
        fetch(`${origin}/api/health`, { signal: AbortSignal.timeout(1000) })
          .then(() => 'running')
          .catch(() => 'stopped'),
      )
      .toBe('stopped');
  } finally {
    await app?.close().catch(() => {});
    await services?.close();
    if (profile.startsWith(join(tmpdir(), 'electricity-map-test-')))
      await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
});
