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
