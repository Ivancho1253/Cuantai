# Implementation status and next work

Updated **2026-10-15**. This session implements and verifies a usable foundation across several vertical slices. It does **not** claim completion of every capability in the master brief or of all MVP acceptance criteria with live licensed data.

## Phase 0 — Audit and design

**Implemented:** audited the initially empty repository; researched the named UX references and official provider/library documentation; defined domain boundaries, provenance, monetary precision, authentication and local/production storage strategies.

**Tested:** repository inspection and installed runtime/dependency compatibility; production dependency audit.

**Pending:** final provider contract review and capacity planning for a public commercial release.

**Blocked:** licensed data contracts were not supplied.

**Next:** use the existing adapters when credentials and contracts become available; validate their exact instrument coverage.

## Phase 1 — Product foundation

**Implemented:** executable Next.js App Router app; original responsive landing and terminal design; dark/light theme; metadata, generated Open Graph preview, robots and sitemap; email/password registration, login and logout; PostgreSQL schema, versioned migrations, local persistent PGlite; private routes/resource ownership; onboarding and saved country, currency, timezone, interests, experience and risk/horizon preferences. Theme preferences load from the account. Google and recovery flows are configuration-gated.

**Tested:** unit and browser checks; real registration, failed/successful login, logout, protected routes and cross-account denial; onboarding through the UI; migrations applied twice to a separate local database.

**Pending:** full English localization, email verification/account lifecycle UX, operator privacy/terms and production operations.

**Blocked:** Google client credentials and verified email sender/API key.

**Next:** credentialed OAuth/email smoke tests and managed PostgreSQL verification.

## Phase 2 — Market terminal

**Implemented:** normalized provider interfaces; real Binance Spot search/quotes/OHLCV; configured Twelve Data adapter; explicit synthetic fixtures; catalog/search preserving listing identity; quote provenance; interactive candlestick, line, area and OHLC charts; volume, crosshair, zoom/pan and logarithmic scale; nine native timeframes according to provider; simultaneous SMA/EMA/RSI/MACD/Bollinger/ATR/OBV/VWAP; parameter/color/visibility editing; technical cap explained; one/two/four-chart layouts; horizontal price levels; private workspace save/recovery and watchlists. Server budgets, bounded cache, deduplication, retry and circuit-breaker boundaries.

**Tested:** known numeric indicator references; quote/OHLC validation; demo reproducibility; unavailable provider behavior with no synthetic live fallback; workspace/list persistence and ownership; charts and mobile menu in a real browser; **live Binance quote + 500 daily BTC/USDT candles**.

**Pending:** richer screener filters/complete universe synchronization, layout time/crosshair synchronization, streaming/reconnection, custom aggregated timeframes, advanced line styles/pane relocation and remaining drawing/indicator families.

**Blocked:** live US market verification and display rights need an authorized key/plan. Native BYMA contracts are unavailable.

**Next:** validate US listing/exchange coverage; ingest an authorized BYMA export and dated issuer ratio file.

## Phase 3 — Asset intelligence

**Implemented:** exact-listing asset pages; fundamentals adapter with explicit missing data; original news links and timestamps; structured sourced research UI; deterministic technical reports and persisted history; configurable OpenAI Responses pipeline with required evidence tool call, strict structured output, source allowlist, numeric-prose rejection, token caps, timeout and per-user budget. Reports explain missing/stale/demo evidence. Optional follow-up question is stored with the report.

**Tested:** report integrity, invented/absent source rejection, unavailable/insufficient evidence, stale-data labeling, no fabricated demo financials or headlines, persisted report isolation. Deterministic report flow tested end-to-end.

**Pending:** financial-statement/XBRL ingestion, reconciled reporting periods, comparables, DCF, macro series, broader event collection, conversation threads, report cache/expiry and deeper semantic factuality evaluation. Financials/Valuation tabs explicitly state these limits rather than showing fabricated values.

**Blocked:** no stock fundamentals/news credentials or model credentials. **Live model synthesis was not tested.**

**Next:** credentialed contract tests, then primary-filing ingestion.

## Phase 4 — Portfolio intelligence

**Implemented:** private named portfolios with fixed base currency; transaction ledger; precise FIFO accounting, partial sales, buy/sell fees, dividends, manual split factors, cash entries; original transaction currency and dated historical FX; separate current FX and manual certificate prices; complete/incomplete totals; composition and positions; sourced dated CEDEAR ratio import/history and underlying exposure when available; deterministic concentration diagnosis. USDT is separate from USD. No automatic broker execution or cash double-entry assumption.

**Tested:** exact decimal arithmetic and quantity display down to one satoshi; fees and partial sales; oversell/backdated rejection; splits/dividends/cash; rejection of nonzero split price/fees; ARS certificates valued per certificate without reapplying ratio; USD CEDEARs without double conversion; independent historical/current FX; missing FX/quote handling; identity currency checks; private manual prices; ownership checks; persistent database-backed calculations through APIs.

**Pending:** automated corporate actions, broker/CSV import, historical equity curve, realized FX decomposition/tax reporting, TWR/XIRR, ETF holdings look-through, historical correlations, sector/geography aggregation and model-generated portfolio research. Current portfolio diagnosis is explicitly deterministic and limited.

**Blocked:** current ETF holdings, corporate actions and native licensed BYMA data were not available.

**Next:** validate imported data against issuer/broker records before expanding portfolio analytics.

## Phase 5 — Advanced features

**Implemented:** foundations for modular indicators and persisted horizontal drawings; multi-chart layout expansion boundary and safe technical caps.

**Tested:** simultaneous indicators, two-chart rendering and workspace persistence.

**Pending:** server-side alert worker, background notifications, additional drawing tools, six-chart layouts, synchronized charts, advanced screener/comparators, performance profiling and distributed cache.

**Blocked:** always-on infrastructure and feed entitlements are needed for actual background alert delivery.

**Next:** complete licensed data/statement ingestion before adding peripheral features.

## Verification ledger

- **58 unit tests across 6 files passed:** indicators, precision/accounting, CEDEAR/currency behavior, input/security validation, provider failures/cache and source/report integrity. Quantity formatting preserves small fractions and integers above the JavaScript safe-integer range; splits cannot silently discard costs. Neutral technical trends and original report data status are preserved.
- **7 Playwright browser/API scenarios passed against the optimized local production server:** authentication/owner boundaries; CEDEAR ARS/USD accounting; workspace/report persistence; invalid origin/input; UI registration/onboarding/watchlists/chart recovery; mobile navigation and multiple indicators/charts; portfolio transaction/manual-price/FX forms and theme persistence. The suite passed after persistence changes and the theme hydration fix; the theme reload scenario now asserts there are no page JavaScript errors.
- ESLint and strict TypeScript passed; optimized Next.js build passed. Formatting and diff whitespace checks were also completed; the optimized local server returned HTTP 200 for landing, demo, registration and private settings.
- Migrations applied twice to an isolated local PGlite database without reapplying history.
- Desktop and 390px mobile screenshots reviewed; no page JavaScript errors or horizontal mobile overflow in the reviewed dashboard. Dark/light and simultaneous EMA/RSI/MACD screenshots were reviewed. A final optimized production smoke check verified theme reload, a clearly labeled synthetic technical report, and readable dark text on white when printing. No page JavaScript errors were recorded.
- `npm audit --omit=dev`: **0 vulnerabilities**. Full audit reports **5 high development-tool dependency findings** through the latest installed Next ESLint plugin → fast-glob/micromatch/braces chain. No compatible upstream patched braces release was available in the inspected registry; no unsafe downgrade/override was applied. Track and update before broader development-tool exposure.
- External PostgreSQL/Docker, Google OAuth, outbound recovery emails, US licensed feeds, Finnhub and live model generation were **not** verified.

## Acceptance gaps and prioritized backlog

1. **Release gate:** provide keys/contracts, verify real US asset + crypto + sourced model analysis, confirm display rights and run integration tests on managed PostgreSQL. These live acceptance criteria remain open.
2. Ingest primary company statements with fiscal periods, implement business-appropriate metrics and scenario valuation.
3. Validate native BYMA contract and authorized ratio history; extend automated licensed ingestion.
4. Improve universe synchronization, discovery filters, ETF holdings and corporate actions.
5. Finish portfolio return series, TWR/XIRR, richer exposure/correlation analysis and explicit cash accounting options.
6. Add persistent conversations, research caching, deeper source/numeric semantic evaluation and portfolio AI.
7. Add alert workers, synchronized chart tools, advanced drawings/indicators and streaming.
8. Complete localization, accessibility/contrast audit, performance profiling, backup/restore and distributed operations.
