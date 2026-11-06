import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
import { instruments } from '../../src/lib/market/catalog';
import { assetLogo } from '../../src/lib/market/logos';
test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});
test('all catalog logos render in market rows and related listings in both themes', async ({
  page,
  request,
}) => {
  const localFiles = [...new Set(instruments.map((instrument) => assetLogo(instrument)!.src))];
  for (const file of localFiles) {
    const response = await request.get(file);
    expect(response.ok(), file).toBe(true);
    expect(response.headers()['content-type']).toMatch(/^image\//);
  }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/demo?view=markets');
  await expect(page.locator('.asset-icon')).toHaveCount(instruments.length);
  for (const instrument of instruments) {
    const icon = page.locator(`.asset-icon[data-instrument-id="${instrument.id}"]`);
    await icon.scrollIntoViewIfNeeded();
    await expect(icon).toHaveAttribute('data-logo-state', 'loaded');
    expect(
      await icon
        .locator('img')
        .evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0),
    ).toBe(true);
  }
  const initial = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Cambiar tema', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    initial === 'light' ? 'dark' : 'light',
  );
  const qqq = page.locator('.asset-icon[data-instrument-id="NASDAQ:QQQ:USD"]');
  await expect(qqq).toHaveCSS('background-color', 'rgb(7, 35, 74)');
  expect(errors).toEqual([]);
});

test('broken logos have an accessible fallback and a listing change restores its real logo', async ({
  page,
}) => {
  await page.route('**/asset-logos/btc.svg', (route) => route.abort('failed'));
  await page.goto('/demo?view=charts');
  const icon = page.locator('.chart-tile-header .asset-icon');
  await expect(icon).toHaveAttribute('data-logo-state', 'fallback');
  await expect(icon.locator('img')).toHaveCount(0);
  await expect(icon.getByRole('img')).toHaveAccessibleName(/logo no disponible/);
  await page.getByLabel('Activo del gráfico 1').selectOption('BYMA:JPMD:USD');
  await expect(icon).toHaveAttribute('data-logo-state', 'loaded');
  expect(
    await icon.locator('img').evaluate((image: HTMLImageElement) => new URL(image.src).pathname),
  ).toBe('/asset-logos/jpm.png');
  await expect(icon.locator('img')).toHaveAccessibleName('Logo de JPMorgan Chase');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
