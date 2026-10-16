# Cuantai · Architecture

## Decisions — 2026-10-14

The repository initially contained only a README. Build an original financial terminal, not an embedded third-party dashboard. Next.js App Router + strict TypeScript, React, Tailwind 4, Radix dialogs, TanStack Query, Motion and Lightweight Charts 5. Native chart branding is retained under its Apache 2.0 attribution requirements.

Domain boundaries: identity; market catalog and provider adapters; deterministic technical indicators; decimal portfolio accounting; research synthesis; personal workspace. API keys remain server-side. Every private query is owner scoped. The browser accesses same-origin Route Handlers.

PostgreSQL + Drizzle is the persistent store. For a zero-service local start, PGlite runs embedded PostgreSQL on disk under `.data/`; it is a single-process development option, not a serverless production database. Production uses `DATABASE_URL` with postgres.js. Versioned SQL migrations apply explicitly in production and automatically for local development.

Better Auth handles password hashing, cookie sessions, OAuth state/PKCE, expiry and password reset. Google and transactional email are configuration-gated. No shared demo user or bypass authentication. Public demo data is read-only; private operations require a real account.

Instrument identity is exchange + listing + trading currency. NASDAQ:AAPL:USD, BYMA:AAPL:ARS and BYMA:AAPLD:USD are separate listings. Ratios map certificates to underlying shares and are dated, sourced records. Position value is quantity × certificate price. The ratio is used only for underlying exposure or explicitly theoretical estimates.

All money/quantity calculations use decimal.js and numeric database columns, serialized as decimal strings. FIFO lots and fees support partial sales. Historic cost conversion is recorded separately from current valuation conversion; missing FX produces incomplete results. USDT is never assumed equal to USD.

Demo is explicit and reproducible, with a fixed historical as-of date. Live mode never silently substitutes synthetic data after a provider failure. Sources carry observation time, retrieval time, currency, status, adjustment and latency. Provider credentials do not confer redistribution rights.

The AI model receives retrieved evidence and deterministic metrics. Structured narrative is validated, source references are allowlisted, and unsupported numeric claims are rejected. Unavailable fundamentals/macroeconomics remain unavailable. Without an AI key the app provides a clearly labeled deterministic technical report.

Authentication limits use the database-backed Better Auth store. Application write, provider and AI budgets use atomic PostgreSQL counters. The bounded cache and circuit breakers are process-local; distributed caching is an explicit future scaling step. Private mutations validate JSON and origin, bound request body size, and apply Zod schemas. No user-owned state is accepted from a caller-supplied user ID.

Read-only demo pages use the same interactive components as the private workspace. Saved workspaces, watchlists, transactions and analyses require an account. There is no pre-seeded user portfolio. Production deployment is intentionally separate from local artifact creation and was not performed in this session.
