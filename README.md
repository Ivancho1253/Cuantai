# Cuantai

A financial intelligence workspace built with Next.js, React, strict TypeScript and PostgreSQL. Includes an original public landing, private accounts, interactive financial charts, saved workspaces, watchlists, sourced research and decimal portfolio accounting for US instruments, crypto and Argentine CEDEAR listings.

**This is a working foundation, with explicitly documented limits.** It starts in **DEMO** mode using a synthetic, dated dataset. Live crypto was verified against Binance. US providers, Google OAuth, password recovery and model synthesis require credentials; their live operation has not been verified in this environment. Financial statements, DCF and background alerts remain pending.

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
- `/data-policy` — data sources, methodology and current product limits.

Local PostgreSQL runs through **PGlite**, persists under `.data/postgres`, and applies versioned migrations on startup. A development authentication secret is generated under `.data/` with restricted permissions. These files are ignored by Git. PGlite is for one local server process; use external PostgreSQL for production and multiple instances. Do not run migration/import processes against an embedded database while the dev server is using it.

## Working flows

1. Register → save onboarding preferences → dashboard → search JPM using **⌘K / Ctrl+K** → open the NYSE stock or a distinct BYMA listing.
2. Open Charts → select BTC/USDT → combine EMA 20, EMA 50, EMA 200, RSI and MACD → configure periods/colors → save and recover your workspace. Layouts support one, two and four charts; horizontal levels are persisted.
3. Create a watchlist → add instruments → reload or log in again to recover them. The asset page can add a searched instrument to an existing list.
4. Create a USD portfolio → register a BYMA CEDEAR purchase in ARS → record historical USD-per-ARS FX → add a manual certificate price and current FX → inspect FIFO cost, value and P&L. USD CEDEAR listings avoid ARS conversion entirely. USD/ARS/EUR cash and USDT stablecoin balances are distinct denominations; converting USDT to USD requires an explicit rate.
5. Open AI Analyst → generate a sourced deterministic technical report. Configure a compatible model to enable structured model synthesis over retrieved evidence. Reports persist in your account.

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
- BYMA supports a validated, normalized **authorized export**, or private manual portfolio prices. A direct native BYMA connector requires the contracted API specification and authorization. No endpoint or market price is fabricated.
- CEDEAR ratio history can be imported with `npm run data:import-ratios -- /absolute/path/authorized-ratios.json`. No unverified ratios ship as production facts.
- Set `DATABASE_URL`, `BETTER_AUTH_SECRET` and the canonical HTTPS `BETTER_AUTH_URL` in production, then run `npm run db:migrate` before starting the server. `.env.local` is read by the migration/import commands.

Read [architecture](docs/ARCHITECTURE.md), [providers](docs/PROVIDERS.md), [data model](docs/DATA_MODEL.md), [development](docs/DEVELOPMENT.md), [deployment](docs/DEPLOYMENT.md) and [remaining work](docs/IMPLEMENTATION_PLAN.md).

## Attribution

Charts use **TradingView Lightweight Charts**, Apache-2.0. The chart attribution logo is retained. [TradingView](https://www.tradingview.com/) provides the chart library, not the data feeds used by Cuantai. Provider documentation and licensing references are recorded in [PROVIDERS.md](docs/PROVIDERS.md).
