import type { Page } from '@playwright/test';
export const widgetFixture = `(() => {
  const script = document.currentScript;
  const config = JSON.parse(script.textContent);
  const frame = document.createElement('iframe');
  frame.dataset.config = JSON.stringify(config);
  frame.srcdoc = '<!doctype html><html><body>TradingView embedding test fixture. No market data.</body></html>';
  script.closest('.tradingview-widget-container').querySelector('.tradingview-widget-container__widget').append(frame);
})()`;
export async function installTradingViewFixture(page: Page) {
  await page.route(
    'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js',
    (route) => route.fulfill({ contentType: 'application/javascript', body: widgetFixture }),
  );
}

export async function pickChartAsset(page: Page, index: number, id: string) {
  const [exchange, symbol, currency] = id.split(':');
  await page.getByRole('button', { name: `Activo del gráfico ${index}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Elegir activo', exact: true });
  await dialog.getByRole('textbox').fill(symbol);
  await dialog
    .locator('.research-picker-results > button')
    .filter({ has: page.getByText(symbol, { exact: true }) })
    .filter({ hasText: `${exchange} · ${currency}` })
    .first()
    .click();
}
