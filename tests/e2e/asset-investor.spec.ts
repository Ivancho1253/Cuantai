import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test('compact asset header shows annual performance, interprets earnings and explains investor risk', async ({
  page,
  request,
}) => {
  await installTradingViewFixture(page);
  const fixture = await (
    await request.get('/api/data/asset-overview?id=NASDAQ%3AAMZN%3AUSD&demo=true')
  ).json();
  fixture.performance[3] = {
    id: 'year',
    label: 'Anual',
    value: 14.2,
    from: '2025-11-17',
    to: '2026-11-17',
  };
  fixture.risk = {
    ...fixture.risk,
    typicalDailyMove: 1.5,
    distanceFromPeak: -7,
    averageTurnover: 200000000,
    from: '2025-11-17',
    to: '2026-11-17',
  };
  await page.route('**/api/data/asset-overview?*', (route) => route.fulfill({ json: fixture }));
  await page.route('**/api/data/news?*', (route) => route.fulfill({ json: { items: [] } }));
  await page.route('**/api/data/fundamental-research?*', (route) =>
    route.fulfill({
      json: {
        instrumentId: 'NASDAQ:AMZN:USD',
        issuer: 'Amazon.com, Inc.',
        kind: 'stock',
        source: 'Annual test fixture',
        url: 'https://finance.yahoo.com/quote/AMZN/financials/',
        asOf: '2025-12-31',
        retrievedAt: '2026-11-18T00:00:00Z',
        title: 'Negocio con resultado positivo',
        conclusion: 'El ejercicio cerró con ganancias.',
        coverage: [],
        periods: [
          {
            date: '2025-12-31',
            currency: 'USD',
            values: {
              NetIncome: 20,
              OperatingCashFlow: 30,
              TotalDebt: 100,
              CashCashEquivalentsAndShortTermInvestments: 50,
            },
          },
          { date: '2024-12-31', currency: 'USD', values: { NetIncome: 30 } },
        ],
        metrics: [
          {
            id: 'cashflow',
            label: 'Flujo operativo',
            value: 30,
            unit: 'USD',
            explanation: 'Efectivo generado por la actividad principal.',
          },
          {
            id: 'netIncome',
            label: 'Resultado neto',
            value: 20,
            unit: 'USD',
            explanation: 'Ganancia neta del ejercicio.',
          },
          {
            id: 'growth',
            label: 'Crecimiento de ingresos',
            value: 12,
            unit: '%',
            explanation: 'Crecimiento anual.',
          },
        ],
        earnings: {
          period: 'Sep 2026',
          reportedAt: '2026-10-29',
          actual: 1.89,
          estimate: 2.01,
          surprisePercent: -5.97,
          source: 'Nasdaq fixture',
          url: 'https://www.nasdaq.com/market-activity/stocks/amzn/earnings',
          currency: 'USD',
        },
      },
    }),
  );
  await page.setViewportSize({ width: 1780, height: 1000 });
  await page.goto('/asset/NASDAQ/AMZN?demo=true');
  await expect(page.locator('.performance-card').last()).toContainText('+14,20%');
  await expect(page.locator('.asset-profile-header')).toBeVisible();
  const height = await page
    .locator('.asset-profile-header')
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(290);
  await expect(
    page.locator('.fundamental-state').getByText('Positivo, pero en baja', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Resultado frente a expectativas' })).toContainText(
    'Por debajo del consenso',
  );
  const risk = page.getByRole('region', { name: 'Riesgo del activo' });
  await expect(risk.locator('[data-risk]')).toHaveCount(6);
  await expect(risk).toContainText('Negociado por día');
  await expect(risk).toContainText('Deuda / caja e inversiones');
  await expect(page.locator('.asset-profile-header .asset-icon img')).toHaveAttribute(
    'src',
    /\/asset-logos\/amazon-current\.svg$/,
  );
  await page
    .locator('.asset-profile-header')
    .screenshot({ path: 'artifacts/investor-header-desktop.png' });
  await page
    .locator('.asset-business-row')
    .screenshot({ path: 'artifacts/investor-panels-desktop.png' });
  const conclusion = page.getByRole('region', { name: 'Conclusión general del activo' });
  await expect(conclusion).toContainText('último trimestre bajo el consenso');
  await expect(conclusion).toContainText('Lo que acompaña');
  await expect(conclusion).toContainText('Lo que requiere atención');
  await expect(conclusion).toContainText('EPS del último trimestre');
  await expect(page.locator('.fundamental-research-metrics')).toHaveCSS('gap', '17px');
  await expect(page.locator('.asset-business-row')).toHaveCSS('gap', '28px');
  await conclusion.screenshot({ path: 'artifacts/asset-synthesis-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator('.asset-business-row')
    .screenshot({ path: 'artifacts/investor-panels-mobile.png' });
  await conclusion.screenshot({ path: 'artifacts/asset-synthesis-mobile.png' });
});
