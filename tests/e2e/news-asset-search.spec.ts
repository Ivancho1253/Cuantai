import { test, expect } from '@playwright/test';
const headline = (id: string, title: string) => ({
  id,
  title,
  url: 'https://publisher.test/' + id,
  source: 'Medio de prueba',
  publishedAt: '2026-11-18T12:00:00Z',
  summary: 'Resumen publicado por la fuente.',
  category: 'Mercados',
  imageUrl: '/product/research.webp',
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/data/news?*', (route) => {
    const url = new URL(route.request().url()),
      id = url.searchParams.get('id'),
      scope = url.searchParams.get('scope');
    return route.fulfill({
      json: {
        items: id
          ? scope === 'context'
            ? [headline('macro', 'Tasas de interés y empresas tecnológicas')]
            : [headline('apple', 'Apple presenta sus resultados trimestrales')]
          : [headline('market', 'La actualidad del mercado financiero')],
      },
    });
  });
});
test('news search selects an exact asset, requests related headlines and returns to the market', async ({
  page,
}) => {
  await page.goto('/demo?view=news');
  await expect(page.getByRole('button', { name: 'Actualizar noticias', exact: true })).toHaveCount(
    0,
  );
  const search = page.getByRole('combobox', { name: 'Buscar noticias' });
  await search.fill('Apple');
  const results = page.getByRole('listbox', { name: 'Activos encontrados' });
  const apple = results
    .getByRole('option')
    .filter({ hasText: 'AAPL' })
    .filter({ hasText: 'NASDAQ' })
    .first();
  await expect(apple).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().includes('/api/data/news?') &&
      new URL(r.url()).searchParams.get('id') === 'NASDAQ:AAPL:USD',
  );
  await apple.click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator('.news-selected-asset')).toContainText('Noticias de AAPL');
  await expect(page.locator('.news-card')).toContainText('Apple presenta sus resultados');
  await expect(search).toHaveValue('');
  await page.getByRole('button', { name: 'Sector y mercado', exact: true }).click();
  await expect(page.locator('.news-card')).toContainText('Tasas de interés');
  await page.getByRole('button', { name: 'Sobre la empresa', exact: true }).click();
  await expect(page.locator('.news-card')).toContainText('Apple presenta');
  await search.fill('no coincide');
  await expect(page.locator('.news-card')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Borrar búsqueda', exact: true }).click();
  await expect(page.locator('.news-card')).toContainText('Apple presenta');
  await page.getByRole('button', { name: 'Quitar filtro de activo', exact: true }).click();
  await expect(page.locator('.news-selected-asset')).toHaveCount(0);
  await expect(page.locator('.news-card')).toContainText('La actualidad del mercado');
});
test('ticker search supports keyboard selection, escape and mobile sizing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo?view=news');
  const input = page.getByRole('combobox', { name: 'Buscar noticias' });
  await input.fill('NVDA');
  await expect(
    page.getByRole('listbox', { name: 'Activos encontrados' }).getByRole('option').first(),
  ).toBeVisible();
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await input.focus();
  await input.fill('AAPL');
  await expect(
    page.getByRole('listbox', { name: 'Activos encontrados' }).getByRole('option').first(),
  ).toContainText('AAPL');
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(page.locator('.news-selected-asset')).toContainText('Noticias de AAPL');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await input.fill('Bitcoin');
  const coin = page
    .getByRole('listbox', { name: 'Activos encontrados' })
    .getByRole('option')
    .filter({ hasText: 'COINGECKO' })
    .first();
  await expect(coin).toBeVisible();
  await coin.click();
  await expect(page.locator('.news-selected-asset')).toContainText('Noticias de BTC');
});

test('company search lists a US share and its certificates once and accepts certificate-only tickers', async ({
  page,
  request,
}) => {
  const standard = await (await request.get('/api/data/instruments?q=NVDA')).json();
  expect(standard.instruments.some((i: { type: string }) => i.type === 'cedear')).toBe(true);
  await page.goto('/demo?view=news');
  const search = page.getByRole('combobox', { name: 'Buscar noticias' });
  await search.fill('NVDA');
  const results = page.getByRole('listbox', { name: 'Activos encontrados' });
  const company = results
    .getByRole('option')
    .filter({ has: page.locator('strong', { hasText: /^NVDA$/ }) });
  await expect(company).toHaveCount(1);
  await expect(company).toContainText('NVIDIA');
  await expect(company).toContainText('NASDAQ');
  await expect(results).not.toContainText('CEDEAR');
  await search.fill('JPMD');
  await expect(results.getByRole('option')).toHaveCount(1);
  await expect(results).toContainText('JPMorgan');
  await expect(results).toContainText('NYSE');
  const response = page.waitForResponse(
    (r) =>
      r.url().includes('/api/data/news?') &&
      new URL(r.url()).searchParams.get('id') === 'NYSE:JPM:USD',
  );
  await results.getByRole('option').click();
  expect((await response).ok()).toBe(true);
  await expect(page.locator('.news-selected-asset')).toContainText('Noticias de JPM');
});
