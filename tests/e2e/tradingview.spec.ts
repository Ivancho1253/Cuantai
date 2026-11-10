import { test, expect } from '@playwright/test';
import { installTradingViewFixture, widgetFixture } from './tradingview-fixture';
test('official embed receives exact symbols and fullscreen preserves the iframe', async ({
  page,
}) => {
  await installTradingViewFixture(page);
  const localMarketRequests: string[] = [];
  page.on('request', (request) => {
    // The shell ribbon loads overview quotes; the chart must not load Cuantai candles.
    if (/\/api\/data\/market(\?|$)/.test(request.url())) localMarketRequests.push(request.url());
  });
  await page.goto('/demo?view=charts');
  const chart = page.locator('.tv-chart').first();
  await expect(chart).toHaveAttribute('data-state', 'embedded');
  const frame = chart.locator('iframe');
  await frame.evaluate((el) => {
    el.dataset.identity = 'same-frame';
  });
  await page.getByRole('button', { name: 'Pantalla completa', exact: true }).click();
  await expect(chart).toHaveAttribute('data-expanded', 'true');
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect
    .poll(() => chart.evaluate((el) => Math.round(el.getBoundingClientRect().width) === innerWidth))
    .toBe(true);
  await page.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click();
  await expect(chart).toHaveAttribute('data-expanded', 'false');
  await expect(frame).toHaveAttribute('data-identity', 'same-frame');
  await page.getByLabel('Activo del gráfico 1').selectOption('BYMA:JPMD:USD');
  await expect(chart).toHaveAttribute('data-state', 'embedded');
  await expect(chart.locator('iframe')).toHaveAttribute('data-config', /"symbol":"BCBA:JPMD"/);
  await page.getByLabel('Temporalidad inicial').selectOption('1M');
  await expect(chart.locator('iframe')).toHaveAttribute('data-config', /"interval":"M"/);
  const targetTheme =
    (await page.locator('html').getAttribute('data-theme')) === 'dark' ? 'light' : 'dark';
  await page.getByRole('button', { name: 'Cambiar tema', exact: true }).click();
  await expect(chart.locator('iframe')).toHaveAttribute(
    'data-config',
    new RegExp(`"theme":"${targetTheme}"`),
  );
  await expect(chart.locator('iframe')).toHaveCount(1);
  expect(localMarketRequests).toEqual([]);
  await expect(page.locator('canvas')).toHaveCount(0);
});
test('fullscreen has a viewport fallback when the browser declines native fullscreen', async ({
  page,
}) => {
  await installTradingViewFixture(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error('Unsupported test browser'));
  });
  await page.goto('/demo?view=charts');
  await page.getByRole('button', { name: 'Pantalla completa', exact: true }).click();
  const chart = page.locator('.tv-chart');
  await expect(chart).toHaveAttribute('data-expanded', 'true');
  await expect
    .poll(() =>
      chart.evaluate((el) => Math.round(el.getBoundingClientRect().height) === innerHeight),
    )
    .toBe(true);
  await page.keyboard.press('Escape');
  await expect(chart).toHaveAttribute('data-expanded', 'false');
  expect(await page.locator('body').evaluate((el) => el.style.overflow)).not.toBe('hidden');
});
test('blocked embeds offer retry without substituting locally generated chart data', async ({
  page,
}) => {
  let attempts = 0;
  await page.route(
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    (route) =>
      ++attempts === 1
        ? route.abort()
        : route.fulfill({ contentType: 'application/javascript', body: widgetFixture }),
  );
  await page.goto('/demo?view=charts');
  await expect(page.getByText('No se pudo cargar TradingView.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page.locator('.tv-chart')).toHaveAttribute('data-state', 'embedded');
  await expect(page.locator('.tv-chart iframe')).toHaveCount(1);
  await expect(page.locator('canvas')).toHaveCount(0);
});
