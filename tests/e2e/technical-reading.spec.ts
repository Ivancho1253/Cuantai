import { test, expect } from '@playwright/test';
import { installTradingViewFixture, pickChartAsset } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
  await page.route('**/api/data/chart-indicators?*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('demo', 'true');
    await route.fulfill({ response: await page.request.get(url.toString()) });
  });
});

test('three explained readings follow chart selection and return after fullscreen', async ({
  page,
}) => {
  await page.goto('/demo?view=charts');
  const chart = page.locator('.tv-chart');
  const reading = page.locator('.chart-indicators');
  await expect(reading).toHaveAttribute('data-instrument', 'BINANCE:BTCUSDT:USDT');
  await expect(reading.locator('.indicator-cards')).toHaveAttribute('aria-busy', 'false');
  await expect(reading.locator('.indicator-card')).toHaveCount(3);
  for (const card of await reading.locator('.indicator-card').all()) {
    await expect(card.locator('.indicator-direction')).toBeVisible();
    expect((await card.locator('.indicator-current-reading').innerText()).length).toBeGreaterThan(
      40,
    );
  }
  const boxes = await Promise.all([chart.boundingBox(), reading.boundingBox()]);
  expect(boxes[1]!.y).toBeGreaterThanOrEqual(boxes[0]!.y + boxes[0]!.height - 1);
  await chart.locator('iframe').evaluate((el) => {
    el.dataset.identity = 'keep-chart';
  });
  await page.getByRole('button', { name: 'Pantalla completa', exact: true }).click();
  await expect(reading).toHaveCount(0);
  await page.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click();
  await expect(reading).toBeVisible();
  await expect(chart.locator('iframe')).toHaveAttribute('data-identity', 'keep-chart');
  await pickChartAsset(page, 1, 'NASDAQ:NVDA:USD');
  await expect(reading).toHaveAttribute('data-instrument', 'NASDAQ:NVDA:USD');
  await page.getByRole('button', { name: '2 gráficos', exact: true }).click();
  await expect(page.locator('.chart-tile .chart-indicators')).toHaveCount(2);
  await expect(page.getByLabel('Temporalidad inicial')).toHaveCount(0);
});

test('asset analysis explains oversold readings and shows reference support and resistance', async ({
  page,
}) => {
  const fixture = await (
    await page.request.get('/api/data/chart-indicators?id=NASDAQ%3AAMZN%3AUSD&demo=true')
  ).json();
  await page.route('**/api/data/chart-indicators?*', (route) =>
    route.fulfill({
      json: {
        ...fixture,
        close: 105,
        rsi: { value: 25, state: 'oversold' },
        levels: {
          ...fixture.levels,
          support: 100,
          resistance: 120,
          supportDistancePercent: 5,
          resistanceDistancePercent: 12.5,
          state: 'within_range',
          position: 25,
        },
      },
    }),
  );
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  const region = page.getByRole('region', { name: 'Conclusión del análisis técnico' });
  await expect(region).toBeVisible();
  const rsi = region.locator('[data-indicator="rsi"]');
  await expect(rsi.locator('.rsi-zone')).toHaveText('Sobreventa');
  await expect(rsi.locator('.indicator-current-reading')).toContainText('impulso bajista intenso');
  await expect(rsi.locator('.indicator-definition')).toContainText('0 a 100');
  await rsi.locator('summary').click();
  await expect(rsi).toContainText('Sobreventa describe presión vendedora extrema');
  const levels = region.getByRole('region', { name: 'Soportes y resistencias' });
  await expect(levels.locator('[data-level="support"] strong')).toHaveText('100,00USD');
  await expect(levels.locator('[data-level="resistance"] strong')).toHaveText('120,00USD');
  await expect(levels.locator('.technical-level-interpretation')).toContainText(
    'lectura de estos niveles es neutral',
  );
  await levels.locator('summary').click();
  await expect(levels).toContainText('20, 60 o 200 sesiones');
  await page.setViewportSize({ width: 390, height: 844 });
  await region.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('missing data does not produce a neutral opinion or invented price levels', async ({
  page,
}) => {
  const fixture = await (
    await page.request.get('/api/data/chart-indicators?id=NASDAQ%3AAMZN%3AUSD&demo=true')
  ).json();
  await page.route('**/api/data/chart-indicators?*', (route) =>
    route.fulfill({
      json: {
        ...fixture,
        sampleSize: 0,
        close: null,
        asOf: null,
        error: 'Test history unavailable',
        rsi: { value: null, state: 'unavailable' },
        macd: { line: null, signal: null, histogram: null, recent: [], state: 'unavailable' },
        trend: {
          ema20: null,
          ema50: null,
          ema200: null,
          spreadPercent: null,
          state: 'unavailable',
        },
        levels: {
          ...fixture.levels,
          support: null,
          resistance: null,
          state: 'unavailable',
          position: null,
          supportDistancePercent: null,
          resistanceDistancePercent: null,
        },
      },
    }),
  );
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  const region = page.locator('.chart-indicators');
  await expect(region.getByRole('status')).toContainText('No se pudo obtener el historial');
  await expect(region.locator('.indicator-direction')).toHaveText([
    'No disponible',
    'No disponible',
    'No disponible',
    'No disponible',
  ]);
  await expect(region.locator('[data-level="support"] strong')).toHaveText('—USD');
  await expect(region.locator('.technical-reading-summary strong')).toHaveText(
    'Sin lectura suficiente',
  );
});
