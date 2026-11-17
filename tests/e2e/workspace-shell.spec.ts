import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('workspace navigation keeps each destination and follows the active view', async ({
  page,
}) => {
  await page.goto('/demo');
  const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
  const destinations = [
    ['Resumen', 'dashboard'],
    ['Mercados', 'markets'],
    ['Gráficos', 'charts'],
    ['Portafolio', 'portfolio'],
    ['Seguimiento', 'watchlists'],
    ['Analista IA', 'analyst'],
    ['Noticias', 'news'],
  ];
  for (const [label, view] of destinations) {
    await expect(navigation.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      `/demo?view=${view}`,
    );
  }
  await expect(navigation.locator('[aria-current="page"]')).toHaveText('Resumen');
  await navigation.getByRole('link', { name: 'Analista IA', exact: true }).click();
  await expect(page).toHaveURL(/view=analyst/);
  await expect(navigation.locator('[aria-current="page"]')).toHaveText('Analista IA');
  await page.getByRole('button', { name: 'Tu cuenta', exact: true }).click();
  await page.getByRole('dialog').getByRole('link', { name: 'Ajustes', exact: true }).click();
  await expect(page).toHaveURL(/view=settings/);
  await expect(page.locator('.sidebar')).toHaveCount(0);
});

test('topbar search and keyboard shortcut open the instrument search', async ({ page }) => {
  await page.goto('/demo');
  await page.locator('.topbar').getByRole('button', { name: 'Buscar activo' }).click();
  const dialog = page.getByRole('dialog', { name: 'Encontrá tu próximo análisis' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Buscar instrumentos' })).toBeFocused();
  await dialog.getByRole('textbox', { name: 'Buscar instrumentos' }).fill('AAPL');
  await expect(dialog.getByRole('link').filter({ hasText: 'AAPL' }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await page.keyboard.press('Control+k');
  await expect(dialog).toBeVisible();
});

test('mobile top navigation stays accessible without a sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.locator('.sidebar')).toHaveCount(0);
  const nav = page.getByRole('navigation', { name: 'Navegaci\u00f3n principal' });
  await nav.getByRole('link', { name: 'Mercados', exact: true }).click();
  await expect(page).toHaveURL(/view=markets/);
  await nav.getByRole('link', { name: 'Noticias', exact: true }).click();
  await expect(page).toHaveURL(/view=news/);
  const account = page.getByRole('button', { name: 'Tu cuenta', exact: true });
  await account.click();
  await expect(
    page.getByRole('dialog').getByRole('link', { name: 'Crear cuenta' }),
  ).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(account).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('product font loads and the top navigation fits in dark and light themes', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/demo');
  await page.evaluate(() => document.fonts.ready);
  const type = await page
    .locator('.workspace-nav-link')
    .first()
    .evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        family: style.fontFamily,
        loaded: document.fonts.check(`400 15px ${style.fontFamily.split(',')[0]}`),
      };
    });
  expect(type.family).toContain('jakarta');
  expect(type.loaded).toBe(true);
  await expect(page.getByRole('button', { name: 'Tu cuenta', exact: true })).toBeInViewport();
  const initialTheme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: 'Cambiar tema' }).click();
  await expect(page.locator('html')).toHaveAttribute(
    'data-theme',
    initialTheme === 'dark' ? 'light' : 'dark',
  );
  await expect(page.getByRole('button', { name: 'Tu cuenta', exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
