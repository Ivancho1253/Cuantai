import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('all S&P 500 listings are reachable without page duplicates and crypto search spans the full catalog', async ({
  request,
}) => {
  const ids = new Set<string>();
  let total = 0;
  for (let page = 1; page <= 11; page++) {
    const response = await request.get(
      `/api/data/market-catalog?category=S%26P+500&page=${page}&demo=true`,
    );
    expect(response.ok()).toBe(true);
    const result = await response.json();
    total = result.total;
    expect(result.rows.length).toBeLessThanOrEqual(50);
    for (const row of result.rows) {
      expect(ids.has(row.instrument.id)).toBe(false);
      expect(row.quote.status).toBe('demo');
      ids.add(row.instrument.id);
    }
    if (page * result.pageSize >= total) break;
  }
  expect(ids.size).toBe(total);
  expect(total).toBeGreaterThanOrEqual(500);
  expect(ids.has('NASDAQ:AMD:USD')).toBe(true);
  const crypto = await (
    await request.get('/api/data/market-catalog?category=Cripto&demo=true&q=dogecoin')
  ).json();
  expect(crypto.counts.crypto).toBe(100);
  expect(
    crypto.rows.some(
      (row: { instrument: { id: string } }) => row.instrument.id === 'COINGECKO:dogecoin:USD',
    ),
  ).toBe(true);
});

test('market filters, pagination, full-catalog search and new crypto detail URLs work on mobile', async ({
  page,
}) => {
  await page.goto('/demo?view=markets');
  await page.getByRole('button', { name: 'S&P 500', exact: true }).click();
  await expect(page.locator('.market-table tbody tr')).toHaveCount(50);
  const first = await page.locator('.market-table .asset-cell').first().getAttribute('href');
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByRole('navigation', { name: 'Páginas de activos' })).toContainText(
    'Página 2',
  );
  await expect
    .poll(() => page.locator('.market-table .asset-cell').first().getAttribute('href'))
    .not.toBe(first);
  await page.getByRole('button', { name: 'Coin100', exact: true }).click();
  await expect(page.locator('.market-table tbody tr')).toHaveCount(50);
  await expect(page.locator('.market-table tbody tr').first().locator('td').first()).toHaveText(
    '#1',
  );
  await page.getByRole('textbox', { name: 'Filtrar instrumentos' }).fill('dogecoin');
  const doge = page.locator(
    '.market-table .asset-cell[href="/asset/COINGECKO/dogecoin?demo=true"]',
  );
  await expect(doge).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await doge.click();
  await expect(page).toHaveURL(/\/asset\/COINGECKO\/dogecoin\?demo=true$/);
  await expect(page.getByRole('heading', { name: 'Dogecoin', exact: true })).toBeVisible();
});

test('a newly discovered coin can be starred and appears in the favorites ribbon', async ({
  page,
  baseURL,
}) => {
  const headers = { Origin: baseURL! };
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers,
    data: {
      name: 'Catalog QA',
      email: `catalog-${crypto.randomUUID()}@example.test`,
      password: 'Test-Cuantai-813!',
    },
  });
  expect(signup.ok(), await signup.text()).toBe(true);
  const created = await page.request.post('/api/data/watchlists', {
    headers,
    data: { name: 'Nuevas cryptos' },
  });
  expect(created.ok(), await created.text()).toBe(true);
  await page.goto('/markets');
  await page.getByRole('button', { name: 'Coin100', exact: true }).click();
  await page.getByRole('textbox', { name: 'Filtrar instrumentos' }).fill('dogecoin');
  const row = page
    .locator('.market-table tbody tr')
    .filter({ has: page.locator('a[href="/asset/COINGECKO/dogecoin"]') });
  await row.getByRole('button', { name: 'Guardar DOGE en watchlist', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nuevas cryptos' }).click();
  const ticker = page.getByRole('region', { name: 'Cinta de cotizaciones' });
  await ticker.getByRole('button', { name: 'Favoritos', exact: true }).click();
  const favorite = ticker
    .locator('.market-ticker-group')
    .first()
    .locator('a[href="/asset/COINGECKO/dogecoin"]');
  await expect(favorite).toContainText('DOGE');
  await expect(favorite).not.toContainText('Sin cotización');
  await page.getByRole('button', { name: 'CEDEARs', exact: true }).click();
  await page.getByRole('textbox', { name: 'Filtrar instrumentos' }).fill('NVDA');
  const certificate = page
    .locator('.market-table tbody tr')
    .filter({ has: page.locator('a.asset-cell[href="/asset/BYMA/NVDA"]') });
  await certificate.getByRole('button', { name: 'Guardar NVDA en watchlist', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Nuevas cryptos' }).click();
  const savedCertificate = ticker
    .locator('.market-ticker-group')
    .first()
    .locator('a[href="/asset/BYMA/NVDA"]');
  await expect(savedCertificate).toContainText('ARS');
  await expect(savedCertificate).not.toContainText('Sin cotización');
});

test('CEDEAR pages contain the full published program list, preserve species and include ETFs', async ({
  request,
  page,
}) => {
  const ids = new Set<string>();
  let total = 0;
  for (let number = 1; ; number++) {
    const response = await request.get(
      `/api/data/market-catalog?category=CEDEARs&demo=true&page=${number}`,
    );
    expect(response.ok()).toBe(true);
    const result = await response.json();
    total = result.total;
    expect(result.counts.cedears).toBeGreaterThan(400);
    expect(result.dates.cedears).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    for (const row of result.rows) {
      expect(row.instrument.type).toBe('cedear');
      expect(ids.has(row.instrument.id)).toBe(false);
      ids.add(row.instrument.id);
    }
    if (number * result.pageSize >= total) break;
  }
  expect(ids.size).toBe(total);
  for (const id of ['BYMA:NVDA:ARS', 'BYMA:SPY:ARS', 'BYMA:QQQ:ARS', 'BYMA:JPMD:USD'])
    expect(ids.has(id)).toBe(true);
  await page.goto('/demo?view=markets');
  await page.getByRole('button', { name: 'CEDEARs', exact: true }).click();
  await page.getByRole('textbox', { name: 'Filtrar instrumentos' }).fill('CIBR');
  await page.locator('.asset-cell[href="/asset/BYMA/CIBR?demo=true"]').click();
  await expect(page).toHaveURL(/\/asset\/BYMA\/CIBR\?demo=true$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('CYBERSECURITY');
});
