# Cuantai

A financial intelligence workspace built with Next.js, React, strict TypeScript and PostgreSQL. Includes an original public landing, private accounts, interactive financial charts, saved workspaces, watchlists, sourced research and decimal portfolio accounting for US instruments, crypto and Argentine CEDEAR listings.

**This is a working foundation, with explicitly documented limits.** It starts in **DEMO** mode using a synthetic, dated dataset. Live crypto was verified against Binance. US price providers, Google OAuth, password recovery and model synthesis require credentials; their live operation has not been verified in this environment. Annual SEC statement tables support identified network access or validated offline snapshots; live SEC access is not yet verified. Full statement reconciliation, DCF and background alerts remain pending.

## Run locally

Requires **Node.js 22.12+** and npm. No Docker, database subscription or API key is needed for the default development mode.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open **http://localhost:3000**. Use this hostname consistently because authentication checks the configured origin.

- `/` — public product experience with interactive chart previews.
- `/demo` — read-only product exploration with clearly marked synthetic data.
- `/register` — create your own account, then complete optional investment preferences.
- `/dashboard`, `/charts`, `/watchlists`, `/portfolio`, `/analyst`, `/settings` — private workspace.
- `/asset/NYSE/JPM` — listing-specific asset page; `?demo=true` explicitly selects demo data.
- Asset summaries show daily/weekly/monthly/annual price performance, sourced technical/fundamental conclusions, historical risk, news and private conversations. A small TradingView preview opens the complete chart through **Ver gráfico**. [Sources, calculations and chat limits](docs/ASSET_INTELLIGENCE.md).
- All catalog assets have local company/fund/crypto logos or currency symbols, shared across the app. CEDEARs use the underlying issuer's mark. [Logo sources and discovery coverage](docs/ASSET_LOGOS.md).
- `/data-policy` — data sources, methodology and current product limits.

Local PostgreSQL runs through **PGlite**, persists under `.data/postgres`, and applies versioned migrations on startup. A development authentication secret is generated under `.data/` with restricted permissions. These files are ignored by Git. PGlite is for one local server process; use external PostgreSQL for production and multiple instances. Do not run migration/import processes against an embedded database while the dev server is using it.

## Working flows

1. Register → save onboarding preferences → dashboard → search JPM using **⌘K / Ctrl+K** → open the NYSE stock or a distinct BYMA listing.
2. Open Charts → select an exact listing → use the official TradingView chart and its own market data/tools → expand to fullscreen. Layouts support one, two and four widgets. Cuantai saves opening assets, interval, style and layout; internal TradingView drawings/indicator changes are not stored by Cuantai. [Chart integration and limits](docs/TRADINGVIEW.md).
3. Create a watchlist → add instruments → reload or log in again to recover them. The asset page can add a searched instrument to an existing list.
4. Create a USD portfolio → register a BYMA CEDEAR purchase in ARS → record historical USD-per-ARS FX → add a manual certificate price and current FX → inspect FIFO cost, value and P&L. USD CEDEAR listings avoid ARS conversion entirely. USD/ARS/EUR cash and USDT stablecoin balances are distinct denominations; converting USDT to USD requires an explicit rate.
5. Open AI Analyst → generate a sourced deterministic technical report. Configure a compatible model to enable structured model synthesis over retrieved evidence. Reports persist in your account.
6. Configure SEC EDGAR or import its original JSON → select a US issuer's Financials tab → compare up to five annual income, balance and cash-flow periods, switch scale and open each fact's source filing. EPS retains per-share units; CEDEARs refer explicitly to their US issuer. See [financial statement setup and limits](docs/FINANCIAL_STATEMENTS.md).

These flows do not execute financial transactions. Portfolio entries are bookkeeping records.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run format:check
npm audit --omit=dev
```

Browser tests use installed Google Chrome locally. In CI they use Playwright Chromium; install it with `npx playwright install --with-deps chromium`. E2E account setup respects the authentication rate limiter and its retry interval. See [verification results](docs/IMPLEMENTATION_PLAN.md).

## Real data and production

- Set `MARKET_DATA_MODE=live` to use configured providers. Public `/demo` remains synthetic.
- Binance Spot uses a public data endpoint without a trading API key. Prices are denominated in **USDT**, which is not assumed equal to USD.
- Configure Twelve Data for US search/quotes/OHLCV, and Finnhub for stock metrics/news. Budgets are configurable; availability and redistribution rights depend on your contract.
- SEC annual US-GAAP facts need a descriptive `SEC_USER_AGENT` with a real operator email, or `SEC_COMPANYFACTS_FILE` with an imported SEC bundle. No SEC API key is required. Demo mode keeps financial statements empty; switch to live mode to consult sourced facts. Network access still needs an operator-configured smoke test.
- BYMA supports a validated, normalized **authorized export**, or private manual portfolio prices. A direct native BYMA connector requires the contracted API specification and authorization. No endpoint or market price is fabricated.
- CEDEAR ratio history can be imported with `npm run data:import-ratios -- /absolute/path/authorized-ratios.json`. No unverified ratios ship as production facts.
- Set `DATABASE_URL`, `BETTER_AUTH_SECRET` and the canonical HTTPS `BETTER_AUTH_URL` in production, then run `npm run db:migrate` before starting the server. `.env.local` is read by the migration/import commands.

Read [architecture](docs/ARCHITECTURE.md), [providers](docs/PROVIDERS.md), [data model](docs/DATA_MODEL.md), [development](docs/DEVELOPMENT.md), [deployment](docs/DEPLOYMENT.md) and [remaining work](docs/IMPLEMENTATION_PLAN.md).

## Attribution

Price charts use the **official hosted TradingView Advanced Chart widget**, including TradingView's own data and visible attribution. The previous custom renderer and Lightweight Charts dependency have been removed. Availability/delays depend on TradingView and each market. Table quotes, portfolio accounting and research use their separate providers; the widget is not a quote API for those modules. See [TradingView integration](docs/TRADINGVIEW.md) and [provider documentation](docs/PROVIDERS.md).
