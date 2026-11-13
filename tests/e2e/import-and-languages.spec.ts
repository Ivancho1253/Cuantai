import { test as base, expect, type APIRequestContext } from '@playwright/test';
import ExcelJS from 'exceljs';
import { installTradingViewFixture } from './tradingview-fixture';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
let sessionState: Awaited<ReturnType<APIRequestContext['storageState']>>;
const test = base.extend({
  request: async ({ playwright }, provideRequest) => {
    const context = await playwright.request.newContext({ baseURL, storageState: sessionState });
    await provideRequest(context);
    await context.dispose();
  },
});
test.beforeAll(async ({ playwright }) => {
  const request = await playwright.request.newContext({ baseURL });
  await account(request);
  sessionState = await request.storageState();
  await request.dispose();
});
async function account(request: APIRequestContext) {
  if (sessionState) return;
  const response = await request.post('/api/auth/sign-up/email', {
    headers: { Origin: baseURL },
    data: {
      name: 'Import QA',
      email: `import-${crypto.randomUUID()}@example.test`,
      password: 'Import-test-129!',
    },
  });
  expect(response.ok()).toBe(true);
}
async function post(request: APIRequestContext, data: unknown) {
  return request.post('/api/portfolio-import', { headers: { Origin: baseURL }, data });
}
async function portfolio(request: APIRequestContext) {
  const response = await request.post('/api/data/portfolios', {
    headers: { Origin: baseURL },
    data: { name: 'Imported investments', baseCurrency: 'USD' },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).id as string;
}
const buy = {
  symbol: 'AAPL',
  quantity: '10',
  price: '100.25',
  currency: 'USD',
  date: '2025-01-10',
  type: 'BUY',
  fees: '1',
};
test.beforeEach(async ({ page, request }) => {
  await installTradingViewFixture(page);
  await request.patch('/api/data/settings', {
    headers: { Origin: baseURL },
    data: { language: 'es' },
  });
});
test('Spanish is default and language persists across landing, dashboard and reload', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One place.');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.goto('/demo');
  await expect(page.getByRole('link', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Language', exact: true }).selectOption('pt');
  await expect(page.getByRole('link', { name: 'Resumo', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('perspectiva');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('es');
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Un solo lugar');
});
test('signed-in language is saved without overwriting other preferences', async ({
  page,
  request,
}) => {
  await account(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/dashboard');
  await page.getByRole('combobox', { name: 'Idioma', exact: true }).selectOption('en');
  await expect
    .poll(async () => (await (await request.get('/api/data/settings')).json()).preferences.language)
    .toBe('en');
  await expect(page.getByRole('link', { name: 'Portfolio', exact: true })).toBeVisible();
});
test('import is previewed, atomic, idempotent and duplicate-safe', async ({ request }) => {
  await account(request);
  const id = await portfolio(request);
  const preview = await post(request, {
    action: 'preview',
    portfolioId: id,
    mode: 'trades',
    numberFormat: 'en',
    rows: [buy, { ...buy, quantity: '2', date: '2025-01-11', type: 'SELL', reference: 'sale' }],
  });
  expect(preview.ok()).toBe(true);
  const draft = await preview.json();
  expect(draft.valid).toBe(2);
  expect(
    (await (await request.get(`/api/data/portfolios?id=${id}`)).json()).transactions,
  ).toHaveLength(0);
  const invalidSubset = await post(request, {
    action: 'confirm',
    id: draft.id,
    selectedIds: ['1'],
  });
  expect(invalidSubset.status()).toBe(400);
  expect(
    (await (await request.get(`/api/data/portfolios?id=${id}`)).json()).transactions,
  ).toHaveLength(0);
  const confirmed = await post(request, {
    action: 'confirm',
    id: draft.id,
    selectedIds: ['0', '1'],
  });
  expect(confirmed.ok()).toBe(true);
  expect((await confirmed.json()).imported).toBe(2);
  const replay = await post(request, { action: 'confirm', id: draft.id, selectedIds: ['0', '1'] });
  expect(replay.ok()).toBe(true);
  const detail = await (await request.get(`/api/data/portfolios?id=${id}`)).json();
  expect(detail.transactions).toHaveLength(2);
  expect(detail.positions[0].quantity).toBe('8');
  const repeated = await (
    await post(request, {
      action: 'preview',
      portfolioId: id,
      mode: 'trades',
      numberFormat: 'en',
      rows: [buy],
    })
  ).json();
  expect(repeated.rows[0].duplicate).toBe(true);
});
test('snapshot imports preserve unknown basis and reject stale previews', async ({ request }) => {
  await account(request);
  const id = await portfolio(request);
  const body = {
    action: 'preview',
    portfolioId: id,
    mode: 'holdings',
    numberFormat: 'en',
    rows: [{ ...buy, quantity: '7', price: '' }],
  };
  const a = await (await post(request, body)).json();
  const b = await (await post(request, body)).json();
  expect((await post(request, { action: 'confirm', id: a.id, selectedIds: ['0'] })).ok()).toBe(
    true,
  );
  expect((await post(request, { action: 'confirm', id: b.id, selectedIds: ['0'] })).status()).toBe(
    409,
  );
  const detail = await (await request.get(`/api/data/portfolios?id=${id}`)).json();
  expect(detail.positions[0]).toMatchObject({
    quantity: '7',
    costBasis: null,
    unrealizedPnl: null,
  });
});
test('Excel upload can be reviewed and confirmed from the portfolio screen', async ({
  page,
  request,
}) => {
  await account(request);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/portfolio');
  await page.getByRole('button', { name: 'Importar cartera', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar cartera' });
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('Broker');
  sheet.addRow(['Ticker', 'Cantidad', 'Precio', 'Fecha', 'Operacion', 'Moneda']);
  sheet.addRow(['AAPL', '10', '100', '2025-01-10', 'compra', 'USD']);
  await dialog
    .getByLabel('Archivo de cartera')
    .setInputFiles({
      name: 'broker.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from(await book.xlsx.writeBuffer()),
    });
  await expect(dialog).toContainText('filas detectadas');
  await dialog.getByRole('button', { name: 'Preparar vista previa' }).click();
  await expect(dialog.getByLabel('Incluir fila 1')).toBeChecked();
  await page.screenshot({ path: 'artifacts/import-desktop.png' });
  await dialog.getByRole('button', { name: 'Confirmar importación' }).click();
  await expect(dialog).toContainText('Importación completada');
  await dialog.getByRole('button', { name: 'Ver mi cartera' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('table').first()).toContainText('AAPL');
});

test('wallet snapshots add separate addresses and reconcile emptied wallets without deleting unrelated holdings', async ({
  request,
}) => {
  const id = await portfolio(request);
  const update = async (sourceKey: string, quantity?: string) => {
    const response = await post(request, {
      action: 'preview',
      portfolioId: id,
      mode: 'holdings',
      numberFormat: 'en',
      sourceKey,
      completeSnapshot: true,
      rows:
        quantity === undefined
          ? []
          : [
              {
                instrumentId: 'COINGECKO:ethereum:USD',
                quantity,
                date: new Date().toISOString().slice(0, 10),
              },
            ],
    });
    expect(response.ok()).toBe(true);
    const draft = await response.json();
    const selectedIds = draft.rows
      .filter(
        (row: { errors: string[]; duplicate: boolean }) => !row.errors.length && !row.duplicate,
      )
      .map((row: { id: string }) => row.id);
    if (selectedIds.length) {
      const applied = await post(request, { action: 'confirm', id: draft.id, selectedIds });
      expect(applied.ok(), await applied.text()).toBe(true);
    }
    return draft;
  };
  await update('wallet:ethereum:one', '2');
  await update('wallet:ethereum:two', '3');
  const detail = async () =>
    (await (await request.get(`/api/data/portfolios?id=${id}`)).json()).positions[0];
  expect((await detail()).quantity).toBe('5');
  expect((await update('wallet:ethereum:one', '2')).valid).toBe(0);
  await update('wallet:ethereum:one', '1');
  expect((await detail()).quantity).toBe('4');
  await update('wallet:ethereum:one');
  expect((await detail()).quantity).toBe('3');
  expect((await update('wallet:ethereum:one')).valid).toBe(0);
});
test('photo receipts are read locally and can be corrected before import', async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  await page.context().addCookies((await request.storageState()).cookies);
  await page.goto('/portfolio');
  await page.getByRole('button', { name: 'Importar cartera', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Importar cartera' });
  await dialog.getByRole('tab', { name: 'Foto o captura', exact: true }).click();
  const data = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1100;
    canvas.height = 600;
    const c = canvas.getContext('2d')!;
    c.fillStyle = 'white';
    c.fillRect(0, 0, 1100, 600);
    c.fillStyle = 'black';
    c.font = '36px Arial';
    ['COMPRA', 'Ticker: AAPL', 'Cantidad: 10', 'Precio: 123,45 USD', '2025-01-15'].forEach(
      (line, index) => c.fillText(line, 50, 70 + index * 90),
    );
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await dialog
    .getByLabel('Archivo de cartera')
    .setInputFiles({
      name: 'receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from(data, 'base64'),
    });
  const recognized = dialog.getByRole('textbox', { name: 'Texto leído de la imagen' });
  await expect(recognized).toHaveValue(/AAPL/, { timeout: 90000 });
  await recognized.fill('Compra\nTicker: AAPL\nCantidad: 10\nPrecio: 123,45 USD\n2025-01-15');
  await dialog.getByRole('button', { name: 'Interpretar texto corregido' }).click();
  await dialog.getByRole('button', { name: 'Preparar vista previa' }).click();
  await expect(dialog.getByLabel('Incluir fila 1')).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/import-mobile.png' });
});
