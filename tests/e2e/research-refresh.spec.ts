import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
  await page.route('**/api/data/news?*', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/data/chart-indicators?*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('demo', 'true');
    const response = await page.request.get(url.toString());
    await route.fulfill({ json: await response.json() });
  });
  await page.route('**/api/data/fundamental-research?*', (route) =>
    route.fulfill({
      json: {
        instrumentId: 'NASDAQ:AAPL:USD',
        issuer: 'Apple Inc.',
        kind: 'stock',
        source: 'Financial fixture',
        url: 'https://finance.yahoo.com/quote/AAPL/financials/',
        asOf: '2025-09-30',
        retrievedAt: '2026-11-17T00:00:00Z',
        title: 'Negocio con resultado positivo',
        conclusion:
          'El último ejercicio cerró con ganancias contables. La operación generó efectivo.',
        coverage: ['Datos de prueba.'],
        metrics: [
          {
            id: 'eps',
            label: 'Ganancia por acción',
            value: 8,
            unit: 'USD/acción',
            explanation: 'Resultado diluido anual por acción.',
          },
        ],
        periods: [
          {
            date: '2025-09-30',
            currency: 'USD',
            values: { TotalRevenue: 1000, NetIncome: 120, OperatingCashFlow: 140, DilutedEPS: 8 },
          },
        ],
      },
    }),
  );
});
test('header, horizons, annual statements, editable valuation and analyst without duplicated news', async ({
  page,
}) => {
  await page.goto('/asset/NASDAQ/AAPL?demo=true');
  await expect(page.locator('.asset-header-performance .performance-card')).toHaveCount(4);
  await expect(page.getByText('Rendimiento en perspectiva', { exact: true })).toHaveCount(0);
  const section = page.locator('.asset-technical-section');
  await expect(section.getByRole('button', { name: 'Corto plazo', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(section.locator('.indicator-ema-values')).toContainText('EMA 200');
  await expect(section.locator('.indicator-main-value').first()).not.toContainText('…');
  const old = await section.locator('.indicator-support-values').last().innerText();
  await section.getByRole('button', { name: 'Largo plazo', exact: true }).click();
  await expect(section.locator('.technical-horizons small')).toContainText('50/200');
  await expect(section.locator('.indicator-support-values').last()).not.toHaveText(old);
  await expect(section.locator('.indicator-current-reading')).not.toContainText([
    'puede seguir cayendo',
    'no una confirmación',
    'Puede ser un retroceso',
  ]);
  await expect(page.getByRole('link', { name: 'Agregar al portfolio' })).toHaveAttribute(
    'href',
    /asset=NASDAQ%3AAAPL%3AUSD/,
  );
  await page.getByRole('button', { name: 'Estados financieros', exact: true }).click();
  await expect(page.locator('.public-statements table')).toContainText('1.000');
  await page.getByRole('tab', { name: 'Balance', exact: true }).click();
  await expect(page.locator('.public-statements tbody')).toContainText('Activos totales');
  await page.getByRole('button', { name: 'Valuación', exact: true }).click();
  await expect(page.locator('output')).toContainText('160 USD');
  await page.getByRole('spinbutton', { name: 'P/E del escenario' }).fill('15');
  await expect(page.locator('output')).toContainText('120 USD');
  await page.getByRole('spinbutton', { name: 'Ganancia anual por acción' }).fill('-1');
  await expect(page.locator('output')).toContainText('—');
  await expect(
    page.getByText('Con ganancias nulas o negativas, el múltiplo P/E no es aplicable.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Analista IA', exact: true }).click();
  await expect(page.locator('.research-desk .news-section,.research-desk .news-card')).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: /Qué indica el RSI actual/ }).click();
  await expect(page.locator('#research-question')).toHaveValue('¿Qué indica el RSI actual?');
  await page.screenshot({ path: 'artifacts/analyst-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Vista general', exact: true }).click();
  await page
    .locator('.asset-profile-header')
    .screenshot({ path: 'artifacts/research-header-desktop.png' });
  await section.screenshot({ path: 'artifacts/research-technical-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page
    .locator('.asset-profile-header')
    .screenshot({ path: 'artifacts/research-header-mobile.png' });
  await section.screenshot({ path: 'artifacts/research-technical-mobile.png' });
});

test('portfolio handoff selects the exact asset and waits for the user to confirm a transaction', async ({
  page,
  request,
}) => {
  const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
  const signup = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: {
      name: 'Portfolio handoff QA',
      email: 'handoff-' + crypto.randomUUID() + '@example.test',
      password: 'Handoff-test-129!',
    },
  });
  expect(signup.ok()).toBe(true);
  const created = await request.post('/api/data/portfolios', {
    headers: { Origin: origin },
    data: { name: 'Handoff test', baseCurrency: 'USD' },
  });
  expect(created.ok()).toBe(true);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/portfolio?asset=NASDAQ%3AAAPL%3AUSD');
  const dialog = page.getByRole('dialog', { name: 'Registrar movimiento' });
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Instrumento exacto', exact: true }),
  ).toContainText('AAPL');
  await expect(dialog.getByLabel('Cantidad', { exact: true })).toHaveValue('');
  await expect(dialog.getByLabel('Precio unitario', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).toBeHidden();
});
