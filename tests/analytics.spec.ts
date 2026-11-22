import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { MonthlyDataset } from '../src/analytics/types';
import { DESIGNS } from '../src/designs/catalog';
const data: MonthlyDataset = JSON.parse(
  await readFile(new URL('../data/monthly.json', import.meta.url), 'utf8'),
);

test('the DC map inset selects the district by pointer and keyboard', async ({ page }) => {
  await page.goto('/?lab=changes&design=original&state=VA');
  const map = page.locator('.change-map');
  const dc = map.getByRole('button', { name: /^District of Columbia:/ });
  const state = page.getByLabel('Analysis state', { exact: true });

  const label = dc.getByText('DC', { exact: true });
  await expect(label).toBeVisible();
  await expect(label).toHaveClass('analysis-map-label');
  await dc.locator('path').click();
  await expect(dc).toHaveAttribute('aria-pressed', 'true');
  await expect(state).toHaveValue('DC');
  await expect(page).toHaveURL(/state=DC/);

  await map.getByRole('button', { name: /^Maryland:/ }).press('Enter');
  await expect(state).toHaveValue('MD');
  await dc.press('Space');
  await expect(state).toHaveValue('DC');
});

test('change chronicle sticky headers do not shift when scrolling', async ({ page }) => {
  await page.goto('/?lab=changes&design=original&state=VA');
  await page.getByLabel('Heatmap window').selectOption('240');
  const scroller = page.locator('.time-grid-scroll');
  const offsets = (scroll: { top: number; left: number }) =>
    scroller.evaluate((el, s) => {
      el.scrollTo(s);
      const box = el.getBoundingClientRect();
      return {
        head: el.querySelector('thead')!.getBoundingClientRect().top - box.top,
        row: el.querySelector('tbody th')!.getBoundingClientRect().left - box.left,
      };
    }, scroll);
  const resting = await offsets({ top: 0, left: 0 });
  expect(await offsets({ top: 40, left: 40 })).toEqual(resting);
});

test('change lab computes real monthly changes, customer metrics, scenarios and share state', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?lab=changes&state=CA&sector=RES&month=2026-08');
  await expect(page.getByTestId('analysis-studio')).toBeVisible();
  const now = data.rows.find(
    (r) => r.state === 'CA' && r.sector === 'RES' && r.period === '2026-08',
  )!;
  const before = data.rows.find(
    (r) => r.state === 'CA' && r.sector === 'RES' && r.period === '2025-08',
  )!;
  await expect(page.getByTestId('analysis-state-change')).toContainText(
    ((now.price! / before.price! - 1) * 100).toFixed(1),
  );
  await expect(page.locator('[data-heatmap-cell="CA:2026-08"]')).toHaveText(
    ((now.price! / before.price! - 1) * 100).toFixed(1),
  );
  await expect(page.locator('[data-analysis-state]')).toHaveCount(51);
  await page.getByLabel('Map metric', { exact: true }).selectOption('cost');
  await page.getByLabel('Monthly usage kWh', { exact: true }).fill('1500');
  await expect(page.getByTestId('analysis-metric-value')).toContainText(
    (now.price! * 15).toFixed(1),
  );
  await page.getByLabel('Map metric', { exact: true }).selectOption('usage');
  await expect(page.getByTestId('analysis-metric-value')).toContainText(
    ((now.sales! * 1e6) / now.customers!).toLocaleString('en-US', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }),
  );
  await page.getByLabel('Comparison period', { exact: true }).selectOption('custom');
  await page.getByLabel('Baseline month', { exact: true }).selectOption('2020-01');
  await expect(page).toHaveURL(/since=2020-01/);
  await page.getByLabel('Map metric', { exact: true }).selectOption('change');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export comparison' }).click();
  const exported = await download;
  expect(exported.suggestedFilename()).toContain('2026-08');
  const csv = await readFile((await exported.path())!, 'utf8');
  expect(csv.split('\n')[0]).toContain('scenario_kwh,metric,metric_unit,value');
  expect(csv.split('\n')[1].split(',').slice(-4, -1)).toEqual([
    '"1500"',
    '"Price change (%)"',
    '"%"',
  ]);
  await page.getByLabel('Dashboard design', { exact: true }).selectOption('cosmic');
  await expect(page.getByTestId('analysis-studio')).toHaveClass(/skin-cosmic/);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath('change-lab.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel('Monthly usage kWh', { exact: true })).toHaveValue('1500');
  await expect(page.getByLabel('Baseline month', { exact: true })).toHaveValue('2020-01');
  await page.locator('[data-heatmap-cell="TX:2026-08"]').click();
  await expect(page.getByLabel('Analysis state', { exact: true })).toHaveValue('TX');
  await expect(page.getByLabel('Comparison period', { exact: true })).toHaveValue('year');
  await page.getByLabel('Comparison period', { exact: true }).selectOption('custom');
  await page.getByLabel('Analysis month', { exact: true }).selectOption('2015-06');
  await expect(page.getByLabel('Baseline month', { exact: true })).toHaveValue('2015-05');
  await page.getByLabel('Analysis sector', { exact: true }).selectOption('IND');
  await page.getByLabel('Map metric', { exact: true }).selectOption('usage');
  for (const design of ['original', ...DESIGNS.map((item) => item.id)]) {
    await page.getByLabel('Dashboard design', { exact: true }).selectOption(design);
    await expect(page.getByTestId('analysis-studio')).toHaveClass(new RegExp(`skin-${design}`));
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('local utility directory searches real counties and retains annual utility context', async ({
  page,
}, info) => {
  await page.goto('/?lab=utilities&state=CA&sector=RES');
  await expect(page.getByLabel('Utility report year', { exact: true })).toBeVisible();
  await page.getByLabel('Utility county filter', { exact: true }).selectOption('Los Angeles');
  await page.getByLabel('Search utilities or counties', { exact: true }).fill('Los Angeles');
  await page.locator('.utility-result').first().click();
  await expect(page.getByTestId('utility-price')).toHaveText(/\d+\.\d{2}/);
  await expect(page.locator('.utility-profile')).toContainText('Bundled');
  await expect(page.locator('.utility-intro')).toContainText('not measured city prices');
  await page.getByLabel('Utility report year', { exact: true }).selectOption('2024');
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath('local-utilities.png'),
    fullPage: true,
  });
  await page.reload();
  await expect(page.getByLabel('Utility county filter', { exact: true })).toHaveValue(
    'Los Angeles',
  );
  await expect(page.getByLabel('Search utilities or counties', { exact: true })).toHaveValue(
    'Los Angeles',
  );
  await page.getByRole('button', { name: 'Dashboards', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Electric atlas.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
