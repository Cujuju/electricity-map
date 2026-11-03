import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { DESIGNS } from '../src/designs/catalog';
import type { Dataset } from '../src/types';

const dataset: Dataset = JSON.parse(
  await readFile(new URL('../data/electricity.json', import.meta.url), 'utf8'),
);
const periods = [...new Set(dataset.rows.map((row) => row.period))].sort();
const latest = periods.at(-1)!;

for (const design of DESIGNS) {
  test(`${design.name}: real data, persistent controls, chart interaction and responsive layout`, async ({
    page,
  }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && /<path>|attribute d|SVG/.test(message.text()))
        errors.push(message.text());
    });
    await page.goto(`/?design=${design.id}`);
    await expect(page.getByTestId('experimental-dashboard')).toHaveAttribute(
      'data-design',
      design.id,
    );
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      design.title.replace('\n', ' '),
      { useInnerText: true },
    );
    const us = dataset.rows.find(
      (row) => row.state === 'US' && row.sector === 'RES' && row.period === latest,
    )!;
    await expect(page.getByTestId('national-price')).toHaveText(us.price!.toFixed(2));
    if (design.id === 'solar') {
      const shapes = await page.locator('.design-chart .data-mark').evaluateAll((nodes) =>
        nodes.map((node) => {
          const box = (node as SVGGraphicsElement).getBBox();
          return box.width > 0 && box.height > 0;
        }),
      );
      expect(shapes).toHaveLength(51);
      expect(shapes.every(Boolean)).toBe(true);
    }
    if ((page.viewportSize()?.width ?? 1440) <= 700) {
      await expect(page.locator('[data-chart-compact="true"]')).toBeVisible();
      const sizes = await page.locator('[data-readable="true"]').evaluateAll((nodes) =>
        nodes.map((node) => {
          const matrix = (node as SVGGraphicsElement).getScreenCTM();
          return parseFloat(getComputedStyle(node).fontSize) * Math.abs(matrix?.a ?? 1);
        }),
      );
      expect(sizes.length).toBeGreaterThan(0);
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(9);
    }
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: testInfo.outputPath(`${design.id}.png`), fullPage: true });
    const marks = page.locator('[data-chart-state]');
    const quarterMarks = page.locator('[data-chart-period]');
    if (await marks.count()) {
      const first = marks.first();
      const state = await first.getAttribute('data-chart-state');
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue(state!);
    } else {
      await quarterMarks.first().focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('Selected quarter', { exact: true })).toHaveValue('2015-Q1');
    }
    await page.getByLabel('Selected state', { exact: true }).selectOption('TX');
    await page.getByLabel('End-use sector').selectOption('IND');
    await page.getByLabel('Selected quarter', { exact: true }).selectOption('2025-Q1');
    const texas = dataset.rows.find(
      (row) => row.state === 'TX' && row.sector === 'IND' && row.period === '2025-Q1',
    )!;
    await expect(page.getByTestId('state-price')).toHaveText(texas.price!.toFixed(2));
    await expect(page).toHaveURL(new RegExp(`design=${design.id}`));
    await page.reload();
    await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('TX');
    await expect(page.getByLabel('Selected quarter', { exact: true })).toHaveValue('2025-Q1');
    await expect(page.getByLabel('End-use sector')).toHaveValue('IND');
    await page.getByRole('button', { name: 'Next quarter', exact: true }).click();
    await expect(page.getByLabel('Selected quarter', { exact: true })).toHaveValue('2025-Q2');
    await page.getByRole('button', { name: 'Play timeline', exact: true }).click();
    await expect(page.getByLabel('Selected quarter', { exact: true })).not.toHaveValue('2025-Q2');
    await page.getByRole('button', { name: 'Pause timeline', exact: true }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('design collection switches dashboards without losing data selections or original lenses', async ({
  page,
}) => {
  await page.goto('/?view=orbit&sector=COM&period=2025-Q1&state=NY');
  await page.getByRole('button', { name: /DESIGN LAB/ }).click();
  await expect(page.getByRole('dialog', { name: /Same current/ })).toBeVisible();
  await expect(page.locator('.design-card')).toHaveCount(10);
  await page.getByRole('button', { name: 'Choose Current FM' }).click();
  await expect(page.getByTestId('experimental-dashboard')).toHaveAttribute('data-design', 'analog');
  await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('NY');
  await expect(page.getByLabel('End-use sector')).toHaveValue('COM');
  await expect(page.getByLabel('Selected quarter', { exact: true })).toHaveValue('2025-Q1');
  await page.getByLabel('Dashboard design', { exact: true }).selectOption('press');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('plugged in.');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'EXPORT CSV', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('electricity-map-COM-2025-Q1.csv');
  await page.getByLabel('Dashboard design', { exact: true }).selectOption('original');
  await expect(page.getByRole('heading', { name: 'Price constellation.' })).toBeVisible();
  await expect(page.getByLabel('Selected state', { exact: true })).toHaveValue('NY');
});

test('missing EIA observations remain unavailable in history, scatter and state details', async ({
  page,
}) => {
  await page.goto('/?design=analog&state=AK&sector=RES&period=2016-Q3');
  await expect(page.getByTestId('state-price')).toHaveText('—');
  await expect(page.locator('[data-chart-period="2016-Q3"] circle')).toHaveCount(0);
  await page.getByLabel('Dashboard design', { exact: true }).selectOption('cosmic');
  await expect(page.locator('[data-chart-state="AK"]')).toHaveCount(0);
  await page.getByLabel('Selected quarter', { exact: true }).selectOption('2016-Q1');
  await expect(page.getByTestId('state-price')).toHaveText('19.43');
  await expect(page.locator('[data-chart-state="AK"]')).toHaveCount(0);
  await page.getByLabel('Dashboard design', { exact: true }).selectOption('press');
  await expect(page.locator('[data-chart-period="2016-Q3"]')).toContainText('—');
});
