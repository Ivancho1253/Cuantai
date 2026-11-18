import { expect, test } from '@playwright/test';
import { installTradingViewFixture, pickChartAsset } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('chart picker searches the full catalog with readable colors and restores focus', async ({
  page,
}) => {
  await page.goto('/demo?view=charts');
  await expect(page.locator('.terminal-toolbar')).toHaveCount(0);
  await expect(page.locator('.chart-indicators')).toBeVisible();
  await pickChartAsset(page, 1, 'BYMA:JPMD:USD');
  await expect(page.locator('.tv-chart iframe')).toHaveAttribute(
    'data-config',
    /"symbol":"BCBA:JPMD"/,
  );
  const trigger = page.getByRole('button', { name: 'Activo del gráfico 1', exact: true });
  await expect(trigger).toBeFocused();
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Elegir activo', exact: true });
  await expect(dialog.getByRole('textbox')).toBeFocused();
  await dialog.getByRole('textbox').fill('AAPL');
  const row = dialog
    .locator('.research-picker-results > button')
    .filter({ hasText: 'NASDAQ · USD' })
    .first();
  await expect(row).toBeVisible();
  const colors = await row.evaluate((el) => ({
    foreground: getComputedStyle(el).color,
    background: getComputedStyle(el).backgroundColor,
    font: parseFloat(getComputedStyle(el).fontSize),
  }));
  expect(colors.foreground).not.toBe(colors.background);
  expect(colors.font).toBeGreaterThanOrEqual(16);
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  const logo = await dialog.locator('.asset-icon').first().boundingBox();
  expect(logo!.width).toBe(40);
  expect(logo!.height).toBe(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('remaining native options have explicit contrasting colors in both themes', async ({
  page,
}) => {
  await page.goto('/demo?view=settings');
  for (const theme of ['dark', 'light']) {
    const active = await page.locator('html').getAttribute('data-theme');
    if (active !== theme)
      await page.getByRole('button', { name: 'Cambiar tema', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    const options = await page.locator('select option').evaluateAll((elements) =>
      elements.map((el) => ({
        fg: getComputedStyle(el).color,
        bg: getComputedStyle(el).backgroundColor,
        scheme: getComputedStyle(el.parentElement!).colorScheme,
      })),
    );
    expect(options.length).toBeGreaterThan(0);
    for (const option of options) {
      expect(option.fg).not.toBe(option.bg);
      expect(option.bg).not.toBe('rgba(0, 0, 0, 0)');
      expect(option.scheme).toBe(theme);
    }
  }
});

test('technical readings explain the chart across charts, dashboard and asset details', async ({
  page,
}) => {
  for (const path of ['/demo?view=charts', '/demo', '/asset/NASDAQ/AMZN?demo=true']) {
    await page.goto(path);
    await expect(page.locator('.chart-indicators')).toBeVisible();
    await expect(page.locator('.indicator-cards .indicator-card')).toHaveCount(3);
  }
  await expect(page.getByRole('region', { name: 'Sesgo técnico del activo' })).toBeVisible();
});
