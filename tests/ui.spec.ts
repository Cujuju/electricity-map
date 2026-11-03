import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import type { Dataset } from '../src/types';

const dataset: Dataset = JSON.parse(
  await readFile(new URL('../data/electricity.json', import.meta.url), 'utf8'),
);
const latest = [...new Set(dataset.rows.map((row) => row.period))].sort().at(-1)!;
const quarterCount = new Set(dataset.rows.map((row) => row.period)).size;

test('all lenses share real data, state, sector and quarter selection', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Electric atlas.' })).toBeVisible();
  const national = dataset.rows.find(
    (row) => row.state === 'US' && row.period === latest && row.sector === 'RES',
  )!;
  await expect(page.getByTestId('national-price')).toHaveText(national.price!.toFixed(2));
  await expect(page.locator('.state-face')).toHaveCount(51);
  await page.screenshot({ path: testInfo.outputPath('atlas.png'), fullPage: true });
  await page.getByLabel('Selected state', { exact: true }).selectOption('TX');
  await expect(page.getByRole('heading', { name: 'Texas', exact: true })).toBeVisible();
  await page.getByLabel('End-use sector').selectOption('IND');
  const texas = dataset.rows.find(
    (row) => row.state === 'TX' && row.period === latest && row.sector === 'IND',
  )!;
  await expect(page.getByTestId('state-price')).toHaveText(texas.price!.toFixed(2));
  await page.getByRole('button', { name: '3D relief' }).click();
  await expect(page.getByRole('button', { name: 'Flat map' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.getByRole('button', { name: 'Price constellation, experiment 02' }).click();
  await expect(page.getByRole('heading', { name: 'Price constellation.' })).toBeVisible();
  await expect(page.locator('.orbit-star')).toHaveCount(51);
  await page.locator('.orbit-star[aria-label^="Hawaii,"]').click();
  await expect(page.getByRole('heading', { name: 'Hawaii', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('constellation.png'), fullPage: true });
  await page.getByRole('button', { name: 'Time machine, experiment 03' }).click();
  await expect(page.getByRole('heading', { name: 'Time machine.' })).toBeVisible();
  await expect(page.locator('.spiral-point')).toHaveCount(quarterCount);
  await page.locator('.spiral-point').first().click();
  await expect(page).toHaveURL(/period=2015-Q1/);
  await page.getByRole('button', { name: 'Next quarter', exact: true }).click();
  await expect(page).toHaveURL(/period=2015-Q2/);
  await page.getByRole('button', { name: 'Play timeline' }).click();
  await expect(page).not.toHaveURL(/period=2015-Q2/);
  await page.getByRole('button', { name: 'Pause timeline' }).click();
  await page.screenshot({ path: testInfo.outputPath('spiral.png'), fullPage: true });
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('share URLs restore state; ranking search, source notes and CSV work', async ({ page }) => {
  await page.goto('/?view=orbit&sector=COM&period=2025-Q1&state=NY');
  await expect(page.getByRole('heading', { name: 'Price constellation.' })).toBeVisible();
  await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('NY');
  await expect(page.getByLabel('End-use sector')).toHaveValue('COM');
  await page.getByLabel('Find a state in rankings').fill('washington');
  await page.locator('.ranking-row').click();
  await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('WA');
  await page.getByRole('button', { name: 'About the data and visualizations' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('dated snapshot');
  await page.getByRole('button', { name: 'Close data notes' }).click();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download quarter' }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('electricity-map-COM-2025-Q1.csv');
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString();
  expect(csv.split('\r\n')).toHaveLength(53);
  expect(csv).toContain('2025-Q1,US,COM,');
});

test('invalid URL values recover and data errors can be retried', async ({ page }) => {
  await page.route('**/api/electricity', (route) => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/?view=bad&sector=bad&period=bad&state=bad');
  await expect(page.getByRole('alert')).toContainText('503');
  await expect(page.getByText('Finding the current.')).not.toBeVisible();
  await page.unroute('**/api/electricity');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('heading', { name: 'Electric atlas.' })).toBeVisible();
  await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('CA');
  await expect(page.getByLabel('End-use sector')).toHaveValue('RES');
});
