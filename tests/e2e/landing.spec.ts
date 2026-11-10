import { test, expect } from '@playwright/test';
import { installTradingViewFixture } from './tradingview-fixture';

test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});

test('landing shows real product screenshots and all nine working feature tabs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Un solo lugar');
  const illustration = page.getByRole('img', {
    name: 'Logo de Cuantai conectando acciones, criptomonedas y otros activos en un centro común',
  });
  await expect(illustration).toBeVisible();
  await expect
    .poll(() =>
      illustration.evaluate(
        (element: HTMLImageElement) => element.complete && element.naturalWidth > 0,
      ),
    )
    .toBe(true);
  const intro = page.locator('p').filter({ hasText: 'Para inversores que quieren seguir' });
  await expect(intro).toContainText('consultar a agentes de IA');
  expect(
    await intro.evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(18);
  const wordmark = page
    .getByRole('link', { name: 'Cuantai, inicio' })
    .first()
    .locator('.brand-wordmark');
  await expect(wordmark).toHaveCSS('font-style', 'italic');
  await expect(wordmark).toHaveCSS('font-weight', '800');
  await expect(page.getByRole('link', { name: 'Explorar la demo', exact: true })).toHaveAttribute(
    'href',
    '/demo',
  );
  const tabs = page.getByRole('tablist', { name: 'Funciones de Cuantai' });
  await expect(tabs.getByRole('tab')).toHaveCount(9);
  for (const [label, file] of [
    ['Dashboard', 'dashboard'],
    ['Mercados', 'markets'],
    ['Gráficos', 'charts'],
    ['Analista', 'analyst'],
    ['Investigación', 'research'],
    ['Portfolio', 'portfolio'],
    ['Favoritos', 'watchlists'],
    ['Noticias', 'news'],
    ['Tu espacio', 'settings'],
  ]) {
    await tabs.getByRole('tab', { name: label, exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: label, exact: true });
    await expect(panel.getByRole('heading')).toBeVisible();
    const image = panel.getByRole('img', {
      name: `Captura real de ${label} en Cuantai, con una cuenta de demostración`,
    });
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0),
      )
      .toBe(true);
    await expect(image).toHaveAttribute('src', new RegExp(`${file}\\.webp`));
    await expect(panel.getByRole('link')).toHaveAttribute('href', /^(\/demo|\/asset\/)/);
  }
  await tabs.getByRole('tab', { name: 'Tu espacio', exact: true }).press('Home');
  await expect(tabs.getByRole('tab', { name: 'Dashboard', exact: true })).toBeFocused();
  await expect(tabs.getByRole('tab', { name: 'Dashboard', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('ArrowRight');
  await expect(tabs.getByRole('tab', { name: 'Mercados', exact: true })).toBeFocused();
  expect(errors).toEqual([]);
});

test('the large landing chart is interactive and screenshots can be enlarged', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'light');
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(new Error('Native fullscreen unavailable'));
  });
  await page.goto('/');
  const chart = page.locator('.tv-chart').first();
  await expect(chart).toHaveAttribute('data-state', 'embedded');
  await expect(chart).toHaveAttribute('data-symbol', 'NASDAQ:NVDA');
  await expect(chart.locator('iframe')).toHaveAttribute('data-config', /"theme":"dark"/);
  expect(await chart.evaluate((el) => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(
    600,
  );
  await chart.getByRole('button', { name: 'Pantalla completa', exact: true }).click();
  await expect(chart).toHaveAttribute('data-expanded', 'true');
  await expect
    .poll(() =>
      chart.evaluate(
        (el) =>
          Math.round(el.getBoundingClientRect().width) === innerWidth &&
          Math.round(el.getBoundingClientRect().height) === innerHeight,
      ),
    )
    .toBe(true);
  await chart.getByRole('button', { name: 'Salir de pantalla completa', exact: true }).click();
  await page.getByRole('tabpanel').getByRole('button', { name: 'Ampliar captura' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dashboard · captura ampliada' });
  await expect(dialog.getByRole('img', { name: 'Vista ampliada de Dashboard' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(dialog).not.toBeVisible();
});

test('asset pills share one style and the market band has no visible scrollbar', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const pills = page.locator('[class*="assetPills"] > span');
  const colors = await pills.evaluateAll((elements) =>
    elements.map((element) => ({
      background: getComputedStyle(element).backgroundColor,
      color: getComputedStyle(element).color,
    })),
  );
  expect(new Set(colors.map((value) => JSON.stringify(value))).size).toBe(1);
  const band = page.getByRole('region', { name: 'Mercados disponibles' });
  const viewport = band.locator('[class*="marketMarquee"]');
  await expect(viewport).toHaveCSS('overflow-x', 'hidden');
  await expect(viewport).toHaveCSS('scrollbar-width', 'none');
  expect(
    await viewport.evaluate((el) => el.clientHeight === (el as HTMLElement).offsetHeight),
  ).toBe(true);
});

test('background moves, can be paused, and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const background = page.locator('[class*="ambient"] > span').first();
  const sectionBackground = page.locator('#como-funciona [class*="sectionGlow"]');
  const initial = await background.evaluate((element) => getComputedStyle(element).transform);
  await expect
    .poll(() => background.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initial);
  await page.getByRole('button', { name: 'Pausar animaciones de fondo' }).click();
  await expect(background).toHaveCSS('animation-play-state', 'paused');
  await expect(sectionBackground).toHaveCSS('animation-play-state', 'paused');
  await page.getByRole('button', { name: 'Activar animaciones de fondo' }).click();
  await expect(background).toHaveCSS('animation-play-state', 'running');
  await expect(sectionBackground).toHaveCSS('animation-play-state', 'running');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(background).toHaveCSS('animation-name', 'none');
  await expect(sectionBackground).toHaveCSS('animation-name', 'none');
  await page.getByRole('tab', { name: 'Gráficos', exact: true }).click();
  await expect(
    page.getByRole('tabpanel', { name: 'Gráficos', exact: true }).getByRole('heading'),
  ).toBeVisible();
});

test('mobile keeps images, navigation and calls to action usable without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.getByRole('tab', { name: 'Portfolio', exact: true }).click();
    const panel = page.getByRole('tabpanel', { name: 'Portfolio', exact: true });
    await expect(
      panel.getByRole('img', {
        name: 'Captura real de Portfolio en Cuantai, con una cuenta de demostración',
      }),
    ).toBeVisible();
    await expect(panel.getByRole('link')).toHaveAttribute('href', '/demo?view=portfolio');
    await page.getByRole('tab', { name: 'Dashboard', exact: true }).click();
  }
  for (const id of ['funciones', 'plataforma', 'como-funciona']) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
});
