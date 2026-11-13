import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test('market headers sort numerically in both directions and leave absent data at the end', async ({
  page,
}) => {
  await installTradingViewFixture(page);
  const instrument = (symbol: string) => ({
    id: `NASDAQ:${symbol}:USD`,
    symbol,
    name: symbol,
    exchange: 'NASDAQ',
    currency: 'USD',
    type: 'stock',
    country: 'US',
    sector: 'Test',
    color: '#91bca7',
    source: 'Controlled test',
  });
  const row = (
    symbol: string,
    price: string | null,
    volume: string | null,
    changePercent: string,
  ) => ({
    instrument: instrument(symbol),
    quote:
      price === null
        ? null
        : {
            price,
            volume,
            changePercent,
            status: 'delayed',
            asOf: '2026-11-12T21:00:00Z',
            source: 'Controlled test',
          },
    candles: [],
    provenance: { status: 'unavailable' },
    timeframe: '1D',
  });
  await page.route('**/api/data/market-catalog?*', (route) =>
    route.fulfill({
      json: {
        rows: [
          row('TWO', '2', '10', '-3'),
          row('TEN', '10', '2', '4'),
          row('NONE', null, null, '0'),
          row('SMALL', '0.0001', '100', '1'),
        ],
        total: 4,
        page: 1,
        pageSize: 50,
        counts: { sp500: 503, crypto: 100, cedears: 445, argentina: 80 },
        dates: { sp500: '2026-11-12', crypto: '2026-11-12T00:00:00Z', cedears: '2026-11-12' },
      },
    }),
  );
  await page.goto('/demo?view=markets');
  const table = page.locator('.market-table');
  const symbols = () => table.locator('tbody .asset-cell strong').allTextContents();
  await table.getByRole('button', { name: 'Precio', exact: true }).click();
  await expect(table.getByRole('columnheader', { name: 'Precio' })).toHaveAttribute(
    'aria-sort',
    'descending',
  );
  expect(await symbols()).toEqual(['TEN', 'TWO', 'SMALL', 'NONE']);
  await table.getByRole('button', { name: 'Precio', exact: true }).click();
  expect(await symbols()).toEqual(['SMALL', 'TWO', 'TEN', 'NONE']);
  await table.getByRole('button', { name: 'Volumen', exact: true }).click();
  expect(await symbols()).toEqual(['SMALL', 'TWO', 'TEN', 'NONE']);
  await table.getByRole('button', { name: 'Volumen', exact: true }).click();
  expect(await symbols()).toEqual(['TEN', 'TWO', 'SMALL', 'NONE']);
  await table.getByRole('button', { name: 'Cambio', exact: true }).focus();
  await page.keyboard.press('Enter');
  expect(await symbols()).toEqual(['TEN', 'SMALL', 'TWO', 'NONE']);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test('Coin100 uses verified local images, including symbols shared by other coins', async ({
  page,
  request,
}) => {
  await installTradingViewFixture(page);
  await page.goto('/demo?view=markets');
  await page.getByRole('button', { name: 'Crypto', exact: true }).click();
  const icon = page.locator(
    '.market-table .asset-icon[data-instrument-id="COINGECKO:bitcoin:USD"]',
  );
  await expect(icon).toHaveAttribute('data-logo-state', 'loaded');
  await expect(icon.locator('img')).toHaveAttribute(
    'src',
    /\/asset-logos\/catalog\/COINGECKO_bitcoin_USD\.png$/,
  );
  const response = await request.get(
    '/api/data/market-catalog?category=Acciones+ARG&demo=true&q=ALUA',
  );
  const body = await response.json();
  expect(body.rows[0].quote).toBeNull();
  expect(body.rows[0].instrument.currency).toBe('ARS');
});
