import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
  // Supply explicit, labelled fixture histories without depending on external providers.
  await page.route('**/api/data/chart-indicators?*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('demo', 'true');
    const fixture = await page.request.get(url.toString());
    await route.fulfill({ response: fixture });
  });
});

test('localized separators share the digit baseline and radar prices are readable', async ({
  page,
}) => {
  await page.goto('/demo');
  const bitcoin = page.locator('.benchmark-card').last().locator('.rolling-number');
  await expect(bitcoin).toHaveAttribute('data-value', '84213.50');
  await expect(bitcoin.locator('.sr-only')).toHaveText('84.213,50');
  expect(await bitcoin.locator('.rolling-separator').allTextContents()).toEqual(['.', ',']);
  const positions = await bitcoin.evaluate((el) => {
    const digit = el.querySelector('.rolling-digit > span')!.getBoundingClientRect();
    return Array.from(el.querySelectorAll('.rolling-separator')).map((punctuation) =>
      Math.abs(punctuation.getBoundingClientRect().top - digit.top),
    );
  });
  expect(positions.every((distance) => distance < 1)).toBe(true);
  const radar = page.locator('.watch-preview');
  await expect(radar.getByText('Apple Inc.', { exact: true })).toBeVisible();
  const sizes = await radar
    .locator('.radar-row')
    .first()
    .evaluate((el) => ({
      price: parseFloat(getComputedStyle(el.querySelector('.radar-price strong')!).fontSize),
      symbol: parseFloat(getComputedStyle(el.querySelector('.radar-identity strong')!).fontSize),
      icon: el.querySelector('.asset-icon')!.getBoundingClientRect().width,
    }));
  expect(sizes.price).toBeGreaterThanOrEqual(20);
  expect(sizes.symbol).toBeGreaterThanOrEqual(17);
  expect(sizes.icon).toBeGreaterThanOrEqual(40);
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await expect(bitcoin.locator('.sr-only')).toHaveText('84,213.50');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('es');
  await radar.getByRole('link', { name: 'Abrir seguimiento' }).click();
  await expect(page).toHaveURL(/view=watchlists/);
});

test('three readings follow the selected asset and remain daily when the widget interval changes', async ({
  page,
}) => {
  await page.goto('/demo?view=charts');
  const panel = page.getByRole('region', { name: 'Indicadores técnicos diarios' });
  await expect(panel).toHaveAttribute('data-instrument', 'BINANCE:BTCUSDT:USDT');
  await expect(panel.locator('.indicator-cards')).toHaveAttribute('aria-busy', 'false');
  await expect(panel.locator('.indicator-card')).toHaveCount(3);
  await expect(panel.locator('[data-indicator="rsi"] .indicator-reading strong')).not.toHaveText(
    '—',
  );
  const chartBox = await page.locator('.tv-chart').boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.y).toBeGreaterThanOrEqual(chartBox!.y + chartBox!.height - 1);
  await expect(panel).toContainText('Datos demo');
  await page.getByLabel('Activo del gráfico 1').selectOption('NASDAQ:NVDA:USD');
  await expect(panel).toHaveAttribute('data-instrument', 'NASDAQ:NVDA:USD');
  await expect(panel).toContainText('NVDA');
  await expect(panel.locator('.indicator-cards')).toHaveAttribute('aria-busy', 'false');
  await page.getByLabel('Temporalidad inicial').selectOption('1h');
  await expect(panel).toContainText('Velas diarias cerradas');
  await expect(panel).toHaveAttribute('data-instrument', 'NASDAQ:NVDA:USD');
  await page.getByRole('button', { name: '2 gráficos', exact: true }).click();
  await expect(page.locator('.chart-indicators')).toHaveCount(2);
  await expect(page.locator('.chart-tile').nth(1).locator('.chart-indicators')).toHaveAttribute(
    'data-instrument',
    'NASDAQ:NVDA:USD',
  );
});

test('fullscreen hides readings and restores the same chart with readings on exit', async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error('Fallback fullscreen'));
  });
  await page.goto('/demo?view=charts');
  const panel = page.locator('.chart-indicators');
  await expect(panel).toBeVisible();
  const frame = page.locator('.tv-chart iframe');
  await frame.evaluate((el) => {
    el.dataset.identity = 'preserved';
  });
  await page.getByRole('button', { name: 'Pantalla completa', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(panel).toBeVisible();
  await expect(frame).toHaveAttribute('data-identity', 'preserved');
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.scrollIntoViewIfNeeded();
  await expect(panel.locator('[data-indicator="rsi"]')).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('unavailable histories stay blank instead of producing technical signals', async ({
  page,
}) => {
  const result = await page.request.get(
    '/api/data/chart-indicators?id=BINANCE%3ABTCUSDT%3AUSDT&demo=true',
  );
  const fixture = await result.json();
  const missing = {
    ...fixture,
    sampleSize: 0,
    asOf: null,
    error: 'History unavailable',
    rsi: { value: null, state: 'unavailable' },
    macd: { line: null, signal: null, histogram: null, recent: [], state: 'unavailable' },
    trend: { ema20: null, ema50: null, spreadPercent: null, state: 'unavailable' },
  };
  await page.route('**/api/data/chart-indicators?*', (route) => route.fulfill({ json: missing }));
  await page.goto('/demo?view=charts');
  const panel = page.locator('.chart-indicators');
  await expect(panel.getByRole('status')).toContainText('No se pudo obtener el historial');
  await expect(panel.locator('[data-indicator="rsi"] .indicator-reading strong')).toHaveText('—');
  await expect(panel.locator('[data-indicator="macd"] .indicator-reading strong')).toHaveText('—');
  await expect(panel.locator('[data-indicator="trend"] .indicator-reading strong')).toHaveText(
    'No disponible',
  );
});
