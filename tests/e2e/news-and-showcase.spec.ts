import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test('showcase stays bounded at normal desktop zoom and keeps image tabs', async ({ page }) => {
  await installTradingViewFixture(page);
  await page.goto('/');
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const panel = page.getByRole('tabpanel');
    const box = await panel.boundingBox();
    expect(box!.height).toBeLessThanOrEqual(580);
    expect((await panel.locator('img').boundingBox())!.height).toBeLessThanOrEqual(410);
    await expect(panel.locator('img')).toHaveCSS('object-fit', 'contain');
    await page.getByRole('tab', { name: 'Mercados', exact: true }).click();
    await expect(panel.locator('img')).toHaveAttribute('src', /markets\.webp$/);
    await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
  }
});
test('news photos load in compact cards and open the internal reader', async ({ page }) => {
  await installTradingViewFixture(page);
  await page.route('**/api/data/news?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: 'compact-photo',
            title: 'Resultados de mercado con imagen publicada',
            source: 'Publisher',
            summary: 'Un resumen publicado para consultar dentro de Cuantai.',
            url: 'https://publisher.test/story',
            imageUrl: 'http://localhost:3000/product/dashboard.webp',
            publishedAt: '2026-11-13T12:00:00Z',
          },
        ],
      },
    }),
  );
  await page.goto('/demo?view=news');
  const card = page.locator('.news-card').first();
  await expect(card.locator('img')).toBeVisible();
  await expect
    .poll(() =>
      card.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  expect((await card.boundingBox())!.height).toBeLessThan(260);
  await card.click();
  const reader = page.getByRole('dialog', { name: 'Resultados de mercado con imagen publicada' });
  await expect(reader).toContainText('Un resumen publicado');
  await reader.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect((await card.boundingBox())!.height).toBeLessThan(300);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
