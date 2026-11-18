import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
  // Supply explicit, labelled fixture histories without depending on external providers.
  await page.route('**/api/data/chart-indicators?*', async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('demo', 'true');
    const fixture = await page.request.get(url.toString());
    await route.fulfill({ response: fixture });
  });
});

test('localized separators share the digit baseline and radar prices are readable', async ({
  page,
}) => {
  await page.goto('/demo');
  const bitcoin = page.locator('.benchmark-card').last().locator('.rolling-number');
  await expect(bitcoin).toHaveAttribute('data-value', '84213.50');
  await expect(bitcoin.locator('.sr-only')).toHaveText('84.213,50');
  expect(await bitcoin.locator('.rolling-separator').allTextContents()).toEqual(['.', ',']);
  const positions = await bitcoin.evaluate((el) => {
    const digit = el.querySelector('.rolling-digit > span')!.getBoundingClientRect();
    return Array.from(el.querySelectorAll('.rolling-separator')).map((punctuation) =>
      Math.abs(punctuation.getBoundingClientRect().top - digit.top),
    );
  });
  expect(positions.every((distance) => distance < 1)).toBe(true);
  const radar = page.locator('.watch-preview');
  await expect(radar.getByText('Apple Inc.', { exact: true })).toBeVisible();
  const sizes = await radar
    .locator('.radar-row')
    .first()
    .evaluate((el) => ({
      price: parseFloat(getComputedStyle(el.querySelector('.radar-price strong')!).fontSize),
      symbol: parseFloat(getComputedStyle(el.querySelector('.radar-identity strong')!).fontSize),
      icon: el.querySelector('.asset-icon')!.getBoundingClientRect().width,
    }));
  expect(sizes.price).toBeGreaterThanOrEqual(20);
  expect(sizes.symbol).toBeGreaterThanOrEqual(17);
  expect(sizes.icon).toBeGreaterThanOrEqual(40);
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await expect(bitcoin.locator('.sr-only')).toHaveText('84,213.50');
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('es');
  await radar.getByRole('link', { name: 'Abrir seguimiento' }).click();
  await expect(page).toHaveURL(/view=watchlists/);
});
