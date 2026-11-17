import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('logo stays in the workspace, navigation fills the topbar and portfolio is visible', async ({
  page,
}) => {
  await page.goto('/demo');
  const header = page.locator('.workspace-topbar');
  const search = await header.getByRole('button', { name: 'Buscar activo' }).boundingBox();
  const navigation = await header.getByRole('navigation').boundingBox();
  const language = await header.locator('.language-switcher').boundingBox();
  expect(search).not.toBeNull();
  expect(navigation).not.toBeNull();
  expect(language).not.toBeNull();
  expect(navigation!.x).toBeGreaterThan(search!.x + search!.width);
  expect(navigation!.x + navigation!.width).toBeLessThanOrEqual(language!.x);
  await expect(
    page.locator('.dashboard-actions').getByRole('link', { name: /Explorar portfolio/ }),
  ).toBeInViewport();
  await expect(page.locator('.rolling-number').first()).toHaveAttribute('data-value', /\d/);
  expect(
    await page
      .locator('.rolling-number')
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBeGreaterThanOrEqual(40);
  await header.getByRole('link', { name: 'Mercados', exact: true }).click();
  await header.getByRole('link', { name: 'Cuantai, resumen' }).click();
  await expect(page).toHaveURL(/\/demo\?view=dashboard$/);
  await expect(page.locator('.sidebar')).toHaveCount(0);
});

test('ten-second refresh rolls changed digits up and down and leaves equal prices still', async ({
  page,
}) => {
  const response = await page.request.get('/api/data/benchmarks?demo=true');
  const fixtures = await response.json();
  let calls = 0;
  await page.route('**/api/data/benchmarks?demo=true', (route) => {
    const prices = ['562.81', '563.92', '563.92', '561.73'];
    const price = prices[Math.min(calls++, prices.length - 1)];
    return route.fulfill({
      json: fixtures.map((item: { quote: object }, index: number) =>
        index === 0 ? { ...item, quote: { ...item.quote, price } } : item,
      ),
    });
  });
  await page.goto('/demo');
  const value = page.locator('.rolling-number').first();
  await expect(value).toHaveAttribute('data-value', '562.81');
  expect(calls).toBe(1);
  await value.evaluate((el) => {
    const samples: { value: string | null; direction: string | null; displacement: boolean }[] = [];
    (window as unknown as { quoteRolls: typeof samples }).quoteRolls = samples;
    let lastValue = el.getAttribute('data-value');
    new MutationObserver(() => {
      const nextValue = el.getAttribute('data-value');
      if (nextValue === lastValue) return;
      lastValue = nextValue;
      setTimeout(() => {
        samples.push({
          value: nextValue,
          direction: el.getAttribute('data-direction'),
          displacement: Array.from(el.querySelectorAll('.rolling-digit > span')).some(
            (digit) => Math.abs(new DOMMatrix(getComputedStyle(digit).transform).m42) > 1,
          ),
        });
      }, 60);
    }).observe(el, { subtree: true, childList: true, attributes: true });
  });
  await expect(value).toHaveAttribute('data-value', '563.92', { timeout: 14000 });
  await expect(value).toHaveAttribute('data-direction', 'up');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { quoteRolls: unknown[] }).quoteRolls))
    .toContainEqual({ value: '563.92', direction: 'up', displacement: true });
  await expect(value.locator('.rolling-digit > span')).toHaveCount(5);
  await expect.poll(() => calls, { timeout: 14000 }).toBe(3);
  await expect(value.locator('.rolling-digit > span')).toHaveCount(5);
  await expect(value).toHaveAttribute('data-value', '563.92');
  expect(
    await page.evaluate(() => (window as unknown as { quoteRolls: unknown[] }).quoteRolls.length),
  ).toBe(1);
  await expect(value).toHaveAttribute('data-value', '561.73', { timeout: 14000 });
  await expect(value).toHaveAttribute('data-direction', 'down');
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { quoteRolls: unknown[] }).quoteRolls))
    .toContainEqual({ value: '561.73', direction: 'down', displacement: true });
  await expect(value.locator('.rolling-digit > span')).toHaveCount(5);
});

test('missing quotes stay unavailable and reduced motion avoids rolling transitions', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/data/benchmarks?demo=true', (route) => route.fulfill({ json: [] }));
  await page.goto('/demo');
  await expect(page.locator('.rolling-number').first()).toHaveAttribute('data-value', '');
  await expect(page.locator('.rolling-number').first()).toHaveText('——');
  await expect(page.locator('.benchmark-source').first()).toHaveText('Sin cotización');
});
