# Official TradingView charts

The user requested replacing local chart rendering and its datafeed on **2026-10-17**. All interactive price charts now use TradingView's hosted **Advanced Chart widget**, loaded from the official `s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js` script. TradingView supplies its chart, tools and market data. Cuantai does not send candles or a custom datafeed to the widget.

The former `FinancialChart` and price sparkline components and the `lightweight-charts` dependency were removed. The quantitative indicator functions remain for research calculations; they do not render or feed the TradingView chart. Market tables, portfolio valuations and AI research still use the separately documented providers. The widget does not grant Cuantai a TradingView quote API or permission to extract its data for those modules.

## Product behavior

- Charts, asset pages, dashboard and landing use the same official embed wrapper. Each chart offers **Pantalla completa**, an explicit exit button, reload and a direct TradingView link.
- Fullscreen uses the browser Fullscreen API after a user click, with a fixed viewport fallback when that API is unavailable/declined. Browser-native Escape exits fullscreen; fallback Escape works when focus is in the host document. The visible exit button remains available when focus is inside the external iframe. Body scroll is restored on exit/unmount. Fullscreen keeps the existing iframe and its current tools intact.
- Native TradingView top/side toolbars remain visible. Indicators, drawing tools, zoom, scales and features are managed inside TradingView according to its available widget functionality. No unlimited-indicator promise or access to every exchange is made.
- The app controls the exact opening instrument; internal symbol changing is disabled so the displayed listing cannot silently diverge from the saved instrument. Opening intervals/styles and layouts of one, two or four independent widgets can be selected in Cuantai.
- Cuantai saves **only the opening instrument(s), interval, style and layout** under `provider: tradingview`. The public widget does not expose its internal drawing/indicator state to the app's storage API. Changes made inside the widget are not claimed to be persisted by Cuantai.
- Existing legacy workspaces can recover their instruments, opening interval and style. They are not rewritten automatically. The UI explains that old indicator/drawing definitions do not transfer; saving explicitly replaces that workspace with the new opening configuration.
- Demo mode applies to Cuantai's own tables and research fixtures. The external TradingView chart always uses TradingView's available data. Notices distinguish these sources; local demo prices are not placed above the chart.
- Missing external scripts/timeouts show a retry and direct link. The app never substitutes a synthetic/local chart. Vendor market-availability and delay messages remain inside the official widget; an iframe load does not prove that a particular market is licensed or live.

## Listing identity

NASDAQ/NYSE stocks retain their exchange and share class, including `NYSE:BRK.B`; Binance pairs retain their quote token (`BINANCE:BTCUSDT`, not BTC/USD). BYMA listings map to TradingView's `BCBA` namespace while preserving the exact symbol: `JPM`, `JPMD`, `AAPL`, `AAPLD`, etc. They never fall back to the US stock or another currency species. The existing catalog's SPY/DIA identifiers have explicit TradingView aliases `AMEX:SPY` and `AMEX:DIA`. Unknown exchanges/cash return no mapped chart rather than guessing a different asset. Widget coverage and delays still depend on TradingView.

## Verification

Live official BTC/USDT and NVDA widgets loaded in Chrome, including visible vendor quotes. Browser-native fullscreen entered/exited without recreating its iframe; no page JavaScript/hydration errors were recorded. The NVDA widget identified its available stock feed as Cboe One: TradingView’s displayed source/data level remains authoritative rather than implying a paid primary-exchange feed. All twelve E2E scenarios also passed against an optimized local production server. Automated tests use an explicitly labeled embed-only fixture to verify the host boundary independently of third-party uptime; that fixture contains **no market data**. Tests cover exact listing mapping, minute/month intervals, no local chart-feed requests, new/legacy workspace handling, source failure/retry, fullscreen continuity, fallback/Escape, mobile layouts and theme changes.

The official attribution and links remain visible. Widgets contact TradingView's domains and may process technical usage information under its policies. No Cuantai user ID, email, portfolio, session token or password is included in the widget configuration. This is the public widget integration, not a licensed/self-hosted Advanced Charts SDK integration.

Primary documentation reviewed 2026-10-17: [official embed configuration](https://www.tradingview.com/widget-docs/widgets/charts/advanced-chart/), [data/coverage and custom-feed FAQ](https://www.tradingview.com/widget-docs/faq/data/), [general and privacy FAQ](https://www.tradingview.com/widget-docs/faq/general/). Symbol references: [JPM](https://www.tradingview.com/symbols/BCBA-JPM/), [JPMD](https://www.tradingview.com/symbols/BCBA-JPMD/), [AAPLD](https://www.tradingview.com/symbols/BCBA-AAPLD/), [SPY](https://www.tradingview.com/symbols/AMEX-SPY/), [DIA](https://www.tradingview.com/symbols/AMEX-DIA/).
