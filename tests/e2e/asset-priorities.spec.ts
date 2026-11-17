import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
  await page.route('**/api/data/news?*', (route) => {
    const scope = new URL(route.request().url()).searchParams.get('scope');
    return route.fulfill({
      json: {
        items:
          scope === 'context'
            ? [
                {
                  id: 'macro',
                  title: 'La Reserva Federal analiza las tasas de interés',
                  source: 'Medio de prueba',
                  url: 'https://publisher.test/macro',
                  publishedAt: '2026-11-16T12:00:00Z',
                  summary: 'Contexto monetario publicado por el medio.',
                  category: 'Markets',
                  imageUrl: '/product/research.webp',
                  relevance: {
                    kind: 'macro',
                    label: 'Contexto macro',
                    reason: 'Trata tasas, inflación, política monetaria o comercio.',
                  },
                },
              ]
            : Array.from({ length: 8 }, (_, i) => ({
                id: String(i),
                title: `Amazon presenta novedades de su negocio ${i + 1}`,
                source: 'Medio de prueba',
                url: `https://publisher.test/amazon-${i}`,
                publishedAt: '2026-11-16T12:00:00Z',
                summary: 'Resumen publicado por la fuente sobre Amazon y sus resultados.',
                category: 'Markets',
                imageUrl: '/product/research.webp',
              })),
      },
    });
  });
});

test('chart comes first, uses Jakarta, and stays available when research fails', async ({
  page,
}) => {
  await page.route('**/api/data/asset-overview?*', (route) =>
    route.fulfill({ status: 503, json: { error: 'Test source unavailable' } }),
  );
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  await expect(page.locator('.asset-chart-hero iframe')).toBeVisible();
  const dimensions = await page
    .locator('.asset-chart-hero')
    .evaluate((el) => ({
      width: el.getBoundingClientRect().width,
      parent: el.parentElement!.getBoundingClientRect().width,
      height: el.querySelector('.tv-chart')!.getBoundingClientRect().height,
      next: el.nextElementSibling!.getBoundingClientRect().top,
      bottom: el.getBoundingClientRect().bottom,
    }));
  expect(dimensions.width / dimensions.parent).toBeGreaterThan(0.95);
  expect(dimensions.height).toBeGreaterThanOrEqual(650);
  expect(dimensions.next).toBeGreaterThan(dimensions.bottom);
  await page.evaluate(() => document.fonts.ready);
  const font = await page
    .locator('.asset-detail h1')
    .evaluate((el) => ({
      family: getComputedStyle(el).fontFamily,
      size: parseFloat(getComputedStyle(el).fontSize),
      loaded: document.fonts.check(`600 20px ${getComputedStyle(el).fontFamily.split(',')[0]}`),
    }));
  expect(font.family).toContain('jakarta');
  expect(font.loaded).toBe(true);
  expect(font.size).toBeGreaterThanOrEqual(32);
  await expect(page.getByRole('button', { name: 'Reintentar resumen', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.asset-chart-hero .tv-chart')).toHaveCSS('height', '520px');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('daily gauge changes direction with the evidence and explains the calculation', async ({
  page,
}) => {
  const fixture = await (
    await page.request.get('/api/data/chart-indicators?id=NASDAQ%3AAMZN%3AUSD&demo=true')
  ).json();
  let bullish = false;
  await page.route('**/api/data/chart-indicators?*', (route) =>
    route.fulfill({
      json: {
        ...fixture,
        rsi: { value: bullish ? 65 : 25, state: 'neutral' },
        macd: { ...fixture.macd, state: bullish ? 'bullish' : 'bearish' },
        trend: { ...fixture.trend, state: bullish ? 'bullish' : 'bearish' },
      },
    }),
  );
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  const gauge = page.getByRole('region', { name: 'Sesgo técnico del activo' });
  await expect(gauge).toHaveAttribute('data-score', '0');
  await expect(gauge.locator('.gauge-verdict')).toHaveText('Bajista fuerte');
  await gauge.getByText('Cómo se interpreta', { exact: true }).click();
  await expect(gauge).toContainText('No representa una probabilidad de ganancia.');
  bullish = true;
  await page.getByRole('button', { name: 'Actualizar indicadores', exact: true }).click();
  await expect(gauge).toHaveAttribute('data-score', '100');
  await expect(gauge.locator('.gauge-verdict')).toHaveText('Alcista fuerte');
  await expect(gauge.locator('.gauge-verdict')).toHaveAttribute('data-direction', 'bullish');
});

test('company and market news stay separate, expand on demand and open inside the app', async ({
  page,
}) => {
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  const news = page.locator('.asset-company-news');
  await page.locator('.asset-chart-shortcuts').getByRole('link', { name: 'Ver noticias' }).click();
  await expect(news.getByRole('button', { name: 'Sobre la empresa', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(news.locator('.news-card')).toHaveCount(6);
  await news.getByRole('button', { name: 'Ver más noticias' }).click();
  await expect(news.locator('.news-card')).toHaveCount(8);
  await news.getByRole('button', { name: 'Sector y mercado' }).click();
  await expect(news.locator('.news-card')).toHaveCount(1);
  await expect(news.locator('.news-relevance')).toHaveText('Contexto macro');
  await expect(news).not.toContainText('Amazon presenta novedades');
  await news.locator('.news-card').click();
  await expect(page.getByRole('dialog')).toContainText('Contexto monetario publicado');
  await expect(page).toHaveURL(/localhost:3000\/asset\/NASDAQ\/AMZN/);
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 375, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
