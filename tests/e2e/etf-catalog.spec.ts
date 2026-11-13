import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
test('ETF pages search the full directory and open the exact listing', async ({
  page,
  request,
}) => {
  await installTradingViewFixture(page);
  const a = await (await request.get('/api/data/market-catalog?category=ETFs&demo=true')).json();
  expect(a.total).toBeGreaterThan(1000);
  expect(a.rows).toHaveLength(50);
  const b = await (
    await request.get('/api/data/market-catalog?category=ETFs&demo=true&page=2')
  ).json();
  const firstIds = new Set(a.rows.map((r: { instrument: { id: string } }) => r.instrument.id));
  expect(b.rows.every((r: { instrument: { id: string } }) => !firstIds.has(r.instrument.id))).toBe(
    true,
  );
  await page.goto('/demo?view=markets');
  await page
    .getByRole('group', { name: 'Filtrar mercado' })
    .getByRole('button', { name: 'ETFs', exact: true })
    .click();
  await expect(page.locator('.market-table tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page.getByRole('navigation', { name: 'Páginas de activos' })).toContainText(
    'Página 2',
  );
  await page.getByLabel('Filtrar instrumentos', { exact: true }).fill('VOO');
  const voo = page.locator('.market-table .asset-cell[href="/asset/ARCA/VOO?demo=true"]');
  await expect(voo).toBeVisible();
  await voo.click();
  await expect(page).toHaveURL(/\/asset\/ARCA\/VOO\?demo=true$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Vanguard');
  await expect(page.locator('.tv-chart iframe').first()).toHaveAttribute('data-config', /AMEX:VOO/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
