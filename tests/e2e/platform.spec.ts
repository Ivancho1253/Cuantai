import { installTradingViewFixture } from './tradingview-fixture';
import { test, expect, request as requestFactory, type APIRequestContext } from '@playwright/test';
test.beforeEach(async ({ page }) => {
  await installTradingViewFixture(page);
});
const origin = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const password = 'Test-Cuantai-813!';
async function account() {
  const client = await requestFactory.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  });
  const email = `qa-${crypto.randomUUID()}@example.test`;
  let result = await client.post('/api/auth/sign-up/email', {
    data: { name: 'Cuantai QA', email, password },
  });
  for (let n = 0; result.status() === 429 && n < 3; n++) {
    await new Promise((resolve) =>
      setTimeout(resolve, (Number(result.headers()['x-retry-after'] ?? 10) + 0.1) * 1000),
    );
    result = await client.post('/api/auth/sign-up/email', {
      data: { name: 'Cuantai QA', email, password },
    });
  }
  expect(result.status()).toBe(200);
  return { client, email };
}
async function post(client: APIRequestContext, path: string, data: unknown) {
  const result = await client.post(`/api/data/${path}`, { data });
  expect(result.ok(), await result.text()).toBe(true);
  return result.json();
}
test('authentication, protected resources and independent accounts', async ({ request }) => {
  expect((await request.get('/api/data/watchlists')).status()).toBe(401);
  const a = await account(),
    b = await account();
  try {
    const list = await post(a.client, 'watchlists', { name: 'Long term' });
    expect(
      (
        await a.client.patch('/api/data/watchlists', {
          data: { id: list.id, action: 'add', instrumentId: 'NYSE:JPM:USD' },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (await (await a.client.get('/api/data/watchlists')).json())[0].items[0].instrument.id,
    ).toBe('NYSE:JPM:USD');
    expect(await (await b.client.get('/api/data/watchlists')).json()).toEqual([]);
    expect(
      (
        await b.client.patch('/api/data/watchlists', { data: { id: list.id, action: 'delete' } })
      ).status(),
    ).toBe(404);
    const portfolio = await post(a.client, 'portfolios', {
      name: 'Global USD',
      baseCurrency: 'USD',
    });
    expect((await b.client.get(`/api/data/portfolios?id=${portfolio.id}`)).status()).toBe(404);
    expect((await a.client.post('/api/auth/sign-out', { data: {} })).ok()).toBe(true);
    expect((await a.client.get('/api/data/watchlists')).status()).toBe(401);
    expect(
      (
        await a.client.post('/api/auth/sign-in/email', {
          data: { email: a.email, password: 'incorrect-password' },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await a.client.post('/api/auth/sign-in/email', { data: { email: a.email, password } })
      ).status(),
    ).toBe(200);
    expect((await (await a.client.get('/api/data/watchlists')).json())[0].id).toBe(list.id);
  } finally {
    await a.client.dispose();
    await b.client.dispose();
  }
});
test('CEDEAR ARS historical/current FX, manual prices, USD listing and partial sales', async () => {
  const { client } = await account();
  try {
    const p = await post(client, 'portfolios', { name: 'Argentina', baseCurrency: 'USD' });
    const base = {
      portfolioId: p.id,
      instrumentId: 'BYMA:JPM:ARS',
      type: 'BUY',
      quantity: '174',
      price: '10000',
      fees: '0',
      currency: 'ARS',
      date: '2025-01-01',
      fxRate: '0.001',
      fxKind: 'MEP',
      fxSource: 'Broker settlement',
    };
    await post(client, 'transactions', base);
    await post(client, 'manual-quotes', {
      instrumentId: base.instrumentId,
      price: '12000',
      asOf: new Date().toISOString(),
      source: 'Authorized close',
    });
    let detail = await (await client.get(`/api/data/portfolios?id=${p.id}`)).json();
    expect(detail.value).toBeNull();
    await post(client, 'exchange-rates', {
      from: 'ARS',
      to: 'USD',
      rate: '0.0008',
      asOf: new Date().toISOString(),
      kind: 'MEP',
      source: 'Broker FX',
    });
    detail = await (await client.get(`/api/data/portfolios?id=${p.id}`)).json();
    expect(detail.value).toBe('1670.4');
    expect(detail.costBasis).toBe('1740');
    await post(client, 'transactions', {
      ...base,
      type: 'SELL',
      quantity: '74',
      price: '11000',
      fees: '1000',
      date: '2025-01-02',
      fxRate: '0.0009',
    });
    detail = await (await client.get(`/api/data/portfolios?id=${p.id}`)).json();
    expect(detail.positions[0].quantity).toBe('100');
    expect(detail.positions[0].realizedPnl).toBe('-8.3');
    expect(detail.positions[0].costBasis).toBe('1000');
    expect(
      (
        await client.post('/api/data/transactions', {
          data: { ...base, type: 'SELL', quantity: '101', date: '2025-01-03' },
        })
      ).status(),
    ).toBe(400);
    expect(
      (
        await client.post('/api/data/transactions', { data: { ...base, currency: 'USD' } })
      ).status(),
    ).toBe(400);
    await post(client, 'transactions', {
      ...base,
      instrumentId: 'BYMA:JPMD:USD',
      currency: 'USD',
      quantity: '10',
      price: '10',
      fxRate: null,
      fxKind: null,
      fxSource: null,
    });
    await post(client, 'manual-quotes', {
      instrumentId: 'BYMA:JPMD:USD',
      price: '12',
      asOf: new Date().toISOString(),
      source: 'USD certificate close',
    });
    detail = await (await client.get(`/api/data/portfolios?id=${p.id}`)).json();
    expect(
      detail.positions.find((p: { instrumentId: string }) => p.instrumentId === 'BYMA:JPMD:USD')
        .value,
    ).toBe('120');
  } finally {
    await client.dispose();
  }
});
test('workspace persistence and sourced deterministic analysis', async () => {
  const a = await account(),
    b = await account();
  try {
    const config = {
      instrumentIds: ['BINANCE:BTCUSDT:USDT', 'BINANCE:ETHUSDT:USDT'],
      timeframe: '4h',
      chartType: 'candles',
      logarithmic: false,
      indicators: [
        { id: 'ema20', kind: 'EMA', period: 20, color: '#c8ef84', visible: true },
        { id: 'ema50', kind: 'EMA', period: 50, color: '#b29bf1', visible: true },
        { id: 'rsi', kind: 'RSI', period: 14, color: '#a999df', visible: true },
        { id: 'macd', kind: 'MACD', period: 26, color: '#8bc9df', visible: true },
      ],
      drawings: [
        {
          id: 'level',
          instrumentId: 'BINANCE:BTCUSDT:USDT',
          price: 80000,
          label: 'My level',
          color: '#c8ef84',
        },
      ],
    };
    const workspace = await post(a.client, 'workspaces', { name: 'BTC research', config });
    const saved = await (await a.client.get('/api/data/workspaces')).json();
    expect(saved[0].config).toEqual(config);
    expect(
      (
        await b.client.post('/api/data/workspaces', {
          data: { id: workspace.id, name: 'Hijack', config },
        })
      ).status(),
    ).toBe(404);
    expect(await (await b.client.get('/api/data/workspaces')).json()).toEqual([]);
    const report = await post(a.client, 'analyses', { instrumentId: 'NASDAQ:NVDA:USD' });
    expect(report.mode).toBe('deterministic');
    expect(report.sources.length).toBeGreaterThan(0);
    expect(report.dataStatus).toBe('demo');
    expect(report.narrative.limitations.join(' ')).toContain('sintético');
    expect((await (await a.client.get('/api/data/analyses')).json())[0].report.id).toBe(report.id);
    expect(await (await b.client.get('/api/data/analyses')).json()).toEqual([]);
  } finally {
    await a.client.dispose();
    await b.client.dispose();
  }
});
test('origin, malformed input and real instrument identity', async ({ request }) => {
  const a = await account();
  try {
    expect(
      (
        await a.client.post('/api/data/watchlists', {
          headers: { Origin: 'https://untrusted.example' },
          data: { name: 'Blocked' },
        })
      ).status(),
    ).toBe(403);
    expect((await a.client.post('/api/data/watchlists', { data: { name: '' } })).status()).toBe(
      400,
    );
    const search = await (await request.get('/api/data/instruments?q=JPM&demo=true')).json();
    expect(search.instruments.map((i: { id: string }) => i.id)).toEqual(
      expect.arrayContaining(['NYSE:JPM:USD', 'BYMA:JPM:ARS', 'BYMA:JPMD:USD']),
    );
  } finally {
    await a.client.dispose();
  }
});
test('asset conversation persists through reload and is isolated by account and listing', async ({
  page,
  request,
}) => {
  expect((await request.get('/api/data/asset-chat?id=NASDAQ%3ANVDA%3AUSD')).status()).toBe(401);
  const a = await account(),
    b = await account();
  const id = 'NASDAQ:NVDA:USD';
  const path = `asset-chat?id=${encodeURIComponent(id)}`;
  try {
    const first = await post(a.client, 'asset-chat', {
      instrumentId: id,
      question: '¿Qué riesgo tiene?',
      baseTurnId: null,
    });
    expect(first.answer.mode).toBe('rules');
    const second = await post(a.client, 'asset-chat', {
      instrumentId: id,
      question: 'Explicá eso',
      baseTurnId: first.id,
    });
    expect(second.answer.text).toBe(first.answer.text);
    expect((await (await a.client.get(`/api/data/${path}`)).json()).turns).toHaveLength(2);
    expect((await (await b.client.get(`/api/data/${path}`)).json()).turns).toEqual([]);
    expect(
      (await (await a.client.get('/api/data/asset-chat?id=NYSE%3AJPM%3AUSD')).json()).turns,
    ).toEqual([]);
    expect(
      (
        await a.client.post('/api/data/asset-chat', {
          data: { instrumentId: id, question: 'Stale version', baseTurnId: first.id },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await b.client.post('/api/data/asset-chat', {
          data: { instrumentId: id, question: 'Other account version', baseTurnId: second.id },
        })
      ).status(),
    ).toBe(409);
    expect(
      (
        await a.client.post('/api/data/asset-chat', {
          data: { instrumentId: id, question: '  ', baseTurnId: second.id },
        })
      ).status(),
    ).toBe(400);
    await page.context().addCookies((await a.client.storageState()).cookies);
    await page.goto('/asset/NASDAQ/NVDA');
    await expect(page.locator('.asset-chat-turn')).toHaveCount(2);
    await page.getByLabel('Pregunta sobre el activo').fill('¿Y el rendimiento semanal?');
    await page.getByRole('button', { name: 'Enviar pregunta', exact: true }).click();
    await expect(page.locator('.asset-chat-turn')).toHaveCount(3);
    await page.reload();
    await expect(page.locator('.asset-chat-turn')).toHaveCount(3);
    await expect(page.locator('.asset-chat-turn').last()).toContainText(
      '¿Y el rendimiento semanal?',
    );
    expect((await (await b.client.get(`/api/data/${path}`)).json()).turns).toEqual([]);
  } finally {
    await a.client.dispose();
    await b.client.dispose();
  }
});
test('registration, onboarding, watchlist and chart UI survive reload', async ({ page }) => {
  const email = `ui-${crypto.randomUUID()}@example.test`;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/register');
  await page.getByLabel('Nombre', { exact: true }).fill('Explorador QA');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  for (let n = 0; n < 3; n++) {
    const response = page.waitForResponse((r) => r.url().includes('/sign-up/email'));
    await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
    const result = await response;
    if (result.status() !== 429) break;
    await new Promise((resolve) =>
      setTimeout(resolve, (Number(result.headers()['x-retry-after'] ?? 10) + 0.1) * 1000),
    );
  }
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('button', { name: 'Entrar a mi workspace' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole('link', { name: 'Watchlists', exact: true }).click();
  await page.getByRole('button', { name: 'Nueva watchlist' }).click();
  await page.getByLabel('Nombre de watchlist').fill('Mis ideas');
  await page.getByRole('button', { name: 'Crear watchlist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mis ideas' })).toBeVisible();
  await page.getByRole('button', { name: 'Agregar activo' }).click();
  await page.getByRole('button', { name: 'Agregar a la lista' }).click();
  await page.reload();
  await expect(page.locator('.watchlist-row')).toHaveCount(1);
  await expect(page.locator('.watchlist-row')).toContainText('NVDA');
  await page.getByRole('link', { name: 'Charts', exact: true }).click();
  await expect(page.locator('.tv-chart iframe').first()).toBeVisible();
  await page.getByRole('button', { name: 'Guardar workspace', exact: true }).click();
  await page.getByLabel('Nombre del workspace').fill('Mi BTC');
  await page.getByRole('button', { name: 'Guardar workspace', exact: true }).last().click();
  await expect(page.getByText('Workspace guardado en tu cuenta')).toBeVisible();
  await page.reload();
  await page.getByLabel('Recuperar workspace').selectOption({ label: 'Mi BTC' });
  await expect(page.getByText('Workspace recuperado')).toBeVisible();
  expect(errors).toEqual([]);
});
test('responsive demo navigation and official TradingView layouts', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/demo?view=charts');
  await expect(page.locator('.tv-chart iframe').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Indicadores', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '2 gráficos', exact: true }).click();
  await expect(page.getByLabel('Activo del gráfico 2')).toBeVisible();
  await expect(page.locator('.chart-tile')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo');
  await expect(page.getByRole('heading', { name: 'El mercado, en perspectiva.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Markets', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Un mundo de oportunidades.' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('portfolio entry forms and account theme preferences persist', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const a = await account();
  try {
    await page.context().addCookies((await a.client.storageState()).cookies);
    await page.goto('/portfolio');
    await page.getByRole('button', { name: 'Crear cartera', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nombre', { exact: true }).fill('Mi cartera USD');
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Crear cartera', exact: true })
      .click();
    await page.getByRole('button', { name: 'Registrar movimiento', exact: true }).first().click();
    const transaction = page.getByRole('dialog');
    await transaction.getByLabel('Cantidad', { exact: true }).fill('174');
    await transaction.getByLabel('Precio unitario', { exact: true }).fill('10000');
    await transaction.getByLabel('USD por 1 ARS', { exact: true }).fill('0.001');
    await transaction
      .getByLabel('Fuente histórica', { exact: true })
      .fill('Comprobante del broker QA');
    await transaction.getByRole('button', { name: 'Registrar movimiento', exact: true }).click();
    await expect(page.locator('.holdings')).toContainText('JPM');
    await page.getByRole('button', { name: 'Precio manual', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Precio por certificado / unidad').fill('12000');
    await page.getByRole('dialog').getByLabel('Fuente', { exact: true }).fill('Cierre manual QA');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar precio manual' }).click();
    await page.getByRole('button', { name: 'Tipos de cambio', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByLabel('Tasa (destino por 1 unidad de origen)')
      .fill('0.0008');
    await page.getByRole('dialog').getByLabel('Fuente', { exact: true }).fill('MEP broker QA');
    await page.getByRole('dialog').getByRole('button', { name: 'Guardar tipo de cambio' }).click();
    await expect(page.locator('.portfolio-metric').first()).toContainText('1,670.40');
    await expect(page.locator('.portfolio-metric').nth(1)).toContainText('1,740.00');
    await page.reload();
    await expect(page.locator('.portfolio-metric').first()).toContainText('1,670.40');
    const current = await page.locator('html').getAttribute('data-theme');
    const target = current === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: 'Cambiar tema', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', target);
    await expect
      .poll(async () => {
        const settings = await (await a.client.get('/api/data/settings')).json();
        return settings.preferences.theme;
      })
      .toBe(target);
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', target);
    await expect(page.locator('.portfolio-metric').first()).toContainText('1,670.40');
    expect(errors).toEqual([]);
  } finally {
    await a.client.dispose();
  }
});
