import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// Capture the running product with an isolated demonstration account, never a personal session.
const origin = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const directory = path.resolve('public/product');
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 2,
    reducedMotion: 'reduce',
  });
  const post = async (endpoint, data) => {
    const result = await context.request.post(`${origin}${endpoint}`, {
      headers: { Origin: origin },
      data,
    });
    if (!result.ok()) throw new Error(`${endpoint}: HTTP ${result.status()}`);
    return result.json();
  };
  await post('/api/auth/sign-up/email', {
    name: 'Demo Cuantai',
    email: `landing-${crypto.randomUUID()}@example.test`,
    password: crypto.randomUUID(),
  });
  const portfolio = await post('/api/data/portfolios', {
    name: 'Mi portfolio · demostración',
    baseCurrency: 'USD',
  });
  for (const [instrumentId, type, quantity, price] of [
    ['CASH:USD:USD', 'DEPOSIT', '20000', '1'],
    ['NASDAQ:NVDA:USD', 'BUY', '40', '110'],
    ['NASDAQ:AAPL:USD', 'BUY', '20', '190'],
    ['NASDAQ:MSFT:USD', 'BUY', '10', '350'],
    ['NYSE:SPY:USD', 'BUY', '8', '520'],
  ])
    await post('/api/data/transactions', {
      portfolioId: portfolio.id,
      instrumentId,
      type,
      quantity,
      price,
      fees: '0',
      currency: 'USD',
      date: '2025-03-01',
    });
  const list = await post('/api/data/watchlists', { name: 'Mi radar · tecnología' });
  for (const instrumentId of [
    'NASDAQ:NVDA:USD',
    'NASDAQ:AAPL:USD',
    'NASDAQ:MSFT:USD',
    'NASDAQ:AMZN:USD',
    'BINANCE:BTCUSDT:USDT',
  ]) {
    const result = await context.request.patch(`${origin}/api/data/watchlists`, {
      headers: { Origin: origin },
      data: { id: list.id, action: 'add', instrumentId },
    });
    if (!result.ok()) throw new Error(`watchlist: HTTP ${result.status()}`);
  }
  const page = await context.newPage();
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  const pages = [
    ['dashboard', '/dashboard', '.benchmark-card'],
    ['markets', '/markets', '.market-table tbody tr'],
    ['charts', '/charts', '.tv-chart'],
    ['analyst', '/demo?view=analyst', '.research-input'],
    ['research', '/asset/NASDAQ/NVDA?demo=true', '.asset-performance'],
    ['portfolio', '/portfolio', '.portfolio-metric'],
    ['watchlists', '/watchlists', '.watchlist-row'],
    ['news', '/news', '.news-container'],
    ['settings', '/settings', '.settings-layout'],
  ];
  const dimensions = {};
  async function capture(name, target, maxHeight = 740) {
    const element = target.first();
    await element.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    const box = await element.boundingBox();
    if (!box) throw new Error(`No capture target: ${name}`);
    const png = await page.screenshot({
      animations: 'disabled',
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.min(box.width, 1280 - Math.max(0, box.x)),
        height: Math.min(maxHeight, box.height, 960 - Math.max(0, box.y)),
      },
    });
    const result = await sharp(png)
      .webp({ quality: 94 })
      .toFile(path.join(directory, `${name}.webp`));
    dimensions[name] = { width: result.width, height: result.height };
    console.log(`Captured ${name}: ${result.width}x${result.height}`);
  }
  for (const [name, route, selector] of pages) {
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' });
    await page.locator(selector).first().waitFor({ timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    await page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' });
    if (name === 'analyst') {
      await page.getByRole('button', { name: 'Analizar activo', exact: true }).click();
      await page.locator('.analysis-report').waitFor({ timeout: 30000 });
    }
    if (['dashboard', 'charts', 'research'].includes(name)) {
      await page
        .locator('.tv-chart iframe')
        .first()
        .waitFor({ timeout: 20000 })
        .catch(() => {});
      await page.waitForTimeout(2500);
    } else await page.waitForTimeout(600);
    await page
      .locator('.market-ticker-track')
      .evaluateAll((elements) =>
        elements.forEach((el) => (el.style.animationPlayState = 'paused')),
      );
    await capture(name, page.locator('.main-content'));
    if (name === 'charts') await capture('charts-detail', page.locator('.tv-chart'), 620);
    if (name === 'research')
      await capture('research-detail', page.locator('.asset-conclusion'), 650);
    if (name === 'portfolio') await capture('portfolio-detail', page.locator('.holdings'), 600);
  }
  await (
    await import('node:fs/promises')
  ).writeFile(
    path.join(directory, 'capture-sizes.json'),
    JSON.stringify(dimensions, null, 2) + '\n',
  );
} finally {
  await browser.close();
}
