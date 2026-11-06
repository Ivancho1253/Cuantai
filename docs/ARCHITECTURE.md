# Cuantai · Architecture

## Decisions — 2026-10-14

The repository initially contained only a README. The product uses Next.js App Router, strict TypeScript, React, Tailwind 4, Radix dialogs, TanStack Query and Motion. On 2026-10-17 the user requested replacing custom price charting with TradingView's official hosted widget and its own market data. The old renderer and Lightweight Charts dependency were removed. TradingView attribution is retained; [chart boundaries and fullscreen](TRADINGVIEW.md) are documented separately.

Domain boundaries: identity; market catalog and provider adapters; deterministic technical indicators; decimal portfolio accounting; research synthesis; personal workspace. API keys remain server-side. Every private query is owner scoped. The browser accesses same-origin Route Handlers.

PostgreSQL + Drizzle is the persistent store. For a zero-service local start, PGlite runs embedded PostgreSQL on disk under `.data/`; it is a single-process development option, not a serverless production database. Production uses `DATABASE_URL` with postgres.js. Versioned SQL migrations apply explicitly in production and automatically for local development.

Better Auth handles password hashing, cookie sessions, OAuth state/PKCE, expiry and password reset. Google and transactional email are configuration-gated. No shared demo user or bypass authentication. Public demo data is read-only; private operations require a real account.

Instrument identity is exchange + listing + trading currency. NASDAQ:AAPL:USD, BYMA:AAPL:ARS and BYMA:AAPLD:USD are separate listings. Ratios map certificates to underlying shares and are dated, sourced records. Position value is quantity × certificate price. The ratio is used only for underlying exposure or explicitly theoretical estimates.

All money/quantity calculations use decimal.js and numeric database columns, serialized as decimal strings. FIFO lots and fees support partial sales. Historic cost conversion is recorded separately from current valuation conversion; missing FX produces incomplete results. USDT is never assumed equal to USD.

Demo is explicit and reproducible, with a fixed historical as-of date. Live mode never silently substitutes synthetic data after a provider failure. Sources carry observation time, retrieval time, currency, status, adjustment and latency. Provider credentials do not confer redistribution rights.

The AI model receives retrieved evidence and deterministic metrics. Structured narrative is validated, source references are allowlisted, and unsupported numeric claims are rejected. Unavailable fundamentals/macroeconomics remain unavailable. Without an AI key the app provides a clearly labeled deterministic technical report.

Annual financial facts have a separate provider boundary. `SecProvider` handles identity resolution, identified access, caching and optional operator-imported SEC files; the browser-safe `finance/statements.ts` normalizer selects exact fiscal contexts from one accession per column. The UI preserves per-share units and shows filing links and missing data. Company statements remain issuer-level USD records, independent of CEDEAR prices and portfolio FX. The configured research evidence can include up to three annual periods. This is selected US-GAAP annual coverage, not complete financial statement or restatement reconciliation; see [methodology](FINANCIAL_STATEMENTS.md).

Authentication limits use the database-backed Better Auth store. Application write, provider and AI budgets use atomic PostgreSQL counters. The bounded cache and circuit breakers are process-local; distributed caching is an explicit future scaling step. Private mutations validate JSON and origin, bound request body size, and apply Zod schemas. No user-owned state is accepted from a caller-supplied user ID.

Read-only demo pages use the same interactive components as the private workspace. Saved workspaces, watchlists, transactions and analyses require an account. There is no pre-seeded user portfolio. Production deployment is intentionally separate from local artifact creation and was not performed in this session.

The asset overview aggregates public provider evidence without exposing private state or feeding candles into TradingView. Separate private chat endpoints scope atomic turns to owner/listing/data mode, limit history, re-collect evidence and validate model citations/fact references. Generative API orchestration is server-only; the client imports only rules and data contracts. See [Asset intelligence](ASSET_INTELLIGENCE.md).
