import { installTradingViewFixture } from './tradingview-fixture';
import { test, expect } from '@playwright/test';
import { normalizeStatements } from '../../src/lib/finance/statements';
import { secFixture } from '../fixtures/sec';
import { instruments } from '../../src/lib/market/catalog';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('financials demo and unsupported instruments never fabricate statements', async ({
  page,
  request,
}) => {
  await page.goto('/asset/NASDAQ/AAPL?demo=true');
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await expect(
    page.getByText('El modo demo no incluye balances ficticios.', { exact: false }),
  ).toBeVisible();
  expect(
    await (await request.get('/api/data/financials?id=NASDAQ%3AAAPL%3AUSD&demo=true')).json(),
  ).toMatchObject({ data: null, reason: 'DEMO' });
  expect(
    await (await request.get('/api/data/financials?id=BINANCE%3ABTCUSDT%3AUSDT&demo=true')).json(),
  ).toMatchObject({ data: null, reason: 'NOT_APPLICABLE' });
});

test('statement tables use fiscal sources, keyboard tabs, correct scales and mobile scrolling', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const input = secFixture();
  input.facts['us-gaap'].CashAndCashEquivalentsAtCarryingValue.units.USD = [];
  const data = normalizeStatements(input, {
    instrumentId: 'NASDAQ:AAPL:USD',
    retrievedAt: '2026-10-16T00:00:00Z',
    financialSector: false,
    delivery: 'imported-snapshot',
  });
  // An explicitly synthetic HTTP fixture tests rendering; it is never shipped in app data.
  await page.route('**/api/data/financials?**', (route) => route.fulfill({ json: { data } }));
  await page.route('**/api/data/market?**', (route) =>
    route.fulfill({
      json: {
        instrument: instruments.find((i) => i.id === 'NASDAQ:AAPL:USD'),
        quote: null,
        candles: [],
        timeframe: '1D',
        provenance: {
          source: 'Unavailable test provider',
          url: '',
          asOf: '',
          retrievedAt: '2026-10-16T00:00:00Z',
          status: 'unavailable',
          delayMinutes: null,
          adjusted: 'unknown',
        },
        error:
          'No hay credenciales para este proveedor de precios. El estado de las fuentes de balances es independiente.',
      },
    }),
  );
  await page.goto('/asset/NASDAQ/AAPL?demo=true');
  await page.getByRole('button', { name: 'Financials', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'La evidencia detrás del negocio.' }),
  ).toBeVisible();
  await expect(page.locator('.asset-profile-price')).toHaveCount(0);
  await expect(page.getByRole('row', { name: /^Ingresos / })).toContainText('12');
  const eps = page.getByRole('row', { name: /^Ganancia diluida por acción/ });
  await expect(eps).toContainText('2.5');
  await page.getByLabel('Escala de estados financieros').selectOption('units');
  await expect(page.getByRole('row', { name: /^Ingresos / })).toContainText('12,000,000');
  await expect(eps).toContainText('2.5');
  await page.getByRole('tab', { name: 'Resultados', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Balance', exact: true })).toBeFocused();
  await expect(page.getByRole('row', { name: /^Activos totales/ })).toContainText('52,000,000');
  await expect(page.getByRole('row', { name: /^Efectivo y equivalentes/ })).toContainText('—');
  await page.getByRole('tab', { name: 'Flujo de caja', exact: true }).click();
  const fcf = page.getByRole('row', { name: /^Flujo libre simplificado/ });
  await expect(fcf).toContainText('3,000,000');
  await expect(fcf.getByRole('link').first()).toHaveAttribute('href', data.periods[0].url);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect(
    await page.locator('.statements-table-wrap').evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});
