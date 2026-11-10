import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';
import type { MarketSnapshot } from '../../src/lib/market/types';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('hots ranks daily movement, pauses, and supports mobile reduced motion', async ({ page }) => {
  await page.goto('/demo');
  const ticker = page.getByRole('region', { name: 'Cinta de cotizaciones' });
  const items = ticker.locator('.market-ticker-group').first().locator('.market-ticker-item');
  await expect(items).toHaveCount(12);
  const response = await page.request.get('/api/data/overview?demo=true');
  const snapshots: MarketSnapshot[] = await response.json();
  const ranked = snapshots
    .filter((row) => row.quote)
    .sort(
      (a, b) => Math.abs(Number(b.quote!.changePercent)) - Math.abs(Number(a.quote!.changePercent)),
    )
    .slice(0, 12);
  await expect(items.locator('strong')).toHaveText(ranked.map((row) => row.instrument.symbol));
  const track = ticker.locator('.market-ticker-track');
  const expectMoving = async () => {
    const start = await track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
    await expect
      .poll(() => track.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41))
      .toBeLessThan(start - 3);
  };
  // Selecting a mode leaves its button focused; this must not freeze the ribbon.
  await ticker.getByRole('button', { name: 'Hots', exact: true }).click();
  await expect(track).toHaveCSS('animation-play-state', 'running');
  await expectMoving();
  await ticker.getByRole('button', { name: 'Pausar cinta' }).click();
  await expect(ticker.locator('.market-ticker-track')).toHaveCSS('animation-play-state', 'paused');
  await ticker.getByRole('button', { name: 'Reanudar cinta' }).click();
  await expect(track).toHaveCSS('animation-play-state', 'running');
  await expectMoving();
  await page.mouse.move(0, 0);
  await expect(ticker.getByRole('button', { name: 'Pausar cinta' })).toBeVisible();
  await ticker.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(ticker.getByRole('status')).toContainText('Iniciá sesión');
  await expect(ticker.locator('.market-ticker-item')).toHaveCount(0);
  await ticker.getByRole('button', { name: 'Hots', exact: true }).click();
  await expectMoving();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(ticker.locator('.market-ticker-track')).toHaveCSS(
    'animation-name',
    'market-ticker-scroll',
  );
  await expect(ticker.locator('.market-ticker-track')).toHaveCSS('animation-duration', '120s');
  await expectMoving();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await expect(items.first()).toHaveAttribute('href', /\/asset\/.+\?demo=true$/);
});

test('stars update the favorites ribbon and duplicate watchlists yield one ticker per asset', async ({
  page,
  baseURL,
}) => {
  const signup = await page.request.post('/api/auth/sign-up/email', {
    headers: { Origin: baseURL! },
    data: {
      name: 'Ticker QA',
      email: `ticker-${crypto.randomUUID()}@example.test`,
      password: 'Test-Cuantai-813!',
    },
  });
  expect(signup.ok(), await signup.text()).toBe(true);
  const created = await page.request.post('/api/data/watchlists', {
    headers: { Origin: baseURL! },
    data: { name: 'Favoritos cinta' },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const list = await created.json();
  await page.goto('/markets');
  const ticker = page.getByRole('region', { name: 'Cinta de cotizaciones' });
  await ticker.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(ticker.getByRole('status')).toContainText('Guardá activos');
  await page.getByRole('button', { name: 'Guardar NVDA en watchlist', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Favoritos cinta' }).click();
  const group = ticker.locator('.market-ticker-group').first();
  await expect(group.locator('.market-ticker-item strong')).toHaveText(['NVDA']);
  await expect(
    page.getByRole('button', { name: 'Guardar NVDA en watchlist', exact: true }),
  ).toHaveClass(/is-favorite/);
  const second = await page.request.post('/api/data/watchlists', {
    headers: { Origin: baseURL! },
    data: { name: 'Segunda lista' },
  });
  const secondList = await second.json();
  for (const [id, instrumentId] of [
    [secondList.id, 'NASDAQ:NVDA:USD'],
    [list.id, 'BYMA:JPM:ARS'],
  ]) {
    const added = await page.request.patch('/api/data/watchlists', {
      headers: { Origin: baseURL! },
      data: { id, action: 'add', instrumentId },
    });
    expect(added.ok(), await added.text()).toBe(true);
  }
  await page.reload();
  await ticker.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(group.locator('.market-ticker-item')).toHaveCount(2);
  await expect(group.locator('strong')).toHaveText(['NVDA', 'JPM']);
  await expect(group.getByRole('link').filter({ hasText: 'JPM' })).not.toContainText(
    'Sin cotización',
  );
  await page.goto('/watchlists');
  await ticker.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await page.getByRole('button', { name: 'Eliminar JPM de watchlist', exact: true }).click();
  await expect(group.locator('strong')).toHaveText(['NVDA']);
});
