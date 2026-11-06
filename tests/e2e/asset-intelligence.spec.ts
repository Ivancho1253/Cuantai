import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});
test('asset opens with returns, conclusions, risk, chat, news and a small TradingView preview', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/asset/NASDAQ/NVDA?demo=true');
  await expect(
    page.getByRole('region', { name: 'Rendimiento del activo', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.performance-card')).toHaveCount(4);
  await expect(page.locator('.performance-card').last()).toContainText('Histórico insuficiente');
  for (const name of [
    'Conclusión del análisis técnico',
    'Conclusión del análisis fundamental',
    'Riesgo del activo',
    'Chat con IA del activo',
    'Gráfico pequeño de TradingView',
  ])
    await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  await expect(page.getByText('Últimas noticias', { exact: true })).toBeVisible();
  await expect(page.locator('.asset-price-preview .tv-chart')).toHaveCSS('height', '300px');
  await expect(page.locator('.chart-tile')).toHaveCount(0);
  await page.getByLabel('Pregunta sobre el activo', { exact: true }).fill('¿Qué riesgo tiene?');
  await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click();
  await expect(page.locator('.asset-chat-answer')).toContainText('Modo demo por reglas');
  await page.getByRole('button', { name: 'Ver gráfico', exact: true }).first().click();
  await expect(page.locator('.chart-tile iframe')).toBeVisible();
  await expect(page.locator('.asset-price-preview')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Pantalla completa', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Volver al resumen', exact: true }).click();
  await expect(page.locator('.performance-card')).toHaveCount(4);
  await expect(page.locator('.asset-chat-answer')).toContainText('Modo demo por reglas');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('region', { name: 'Chat con IA del activo' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('unavailable overview can be retried without showing invented conclusions', async ({
  page,
}) => {
  await page.route('**/api/data/asset-overview?**', (route) =>
    route.fulfill({ status: 503, json: { error: 'Proveedor temporalmente no disponible' } }),
  );
  await page.goto('/asset/NASDAQ/NVDA?demo=true');
  await expect(page.getByRole('button', { name: 'Reintentar resumen', exact: true })).toBeVisible();
  await expect(page.locator('.performance-card')).toHaveCount(0);
  await page.unroute('**/api/data/asset-overview?**');
  await page.getByRole('button', { name: 'Reintentar resumen', exact: true }).click();
  await expect(page.locator('.performance-card')).toHaveCount(4);
});
