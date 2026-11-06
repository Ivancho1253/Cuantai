# Implementation status and next work

Updated **2026-10-17**. The application has a usable foundation across several vertical slices, now including sourced annual SEC statement tables. It does **not** claim completion of every capability in the master brief or of all MVP acceptance criteria with live licensed data.

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

**Implemented:** official hosted TradingView Advanced Chart widget with TradingView-supplied data, native chart tools/indicators, exact listing mapping, dark/light themes, browser-native fullscreen and viewport fallback, explicit exit/retry/direct links, and one/two/four independent widget layouts. All custom price renderers/sparklines and the Lightweight Charts dependency were removed at the user's request on 2026-10-17. Opening instrument/interval/style/layout presets persist privately; old workspaces recover those opening fields without pretending to transfer internal indicator/drawing state. Dashboard, asset pages and landing use the same official widget.

**Tested:** real BTC/USDT and NVDA widgets rendered in Chrome, native fullscreen entered/exited, and no page JavaScript/hydration errors occurred. Automated host tests cover listing/currency identity, minute/month interval mapping, no local chart-feed requests, iframe continuity in fullscreen, failure/retry, mobile fallback, theme changes and private presets. Separate market-provider tests remain for tables/research/portfolio; the prior live Binance quote + 500 daily-candle check is not the chart's data source.

**Pending:** broader TradingView widget exchange/entitlement checks; screener/universe synchronization; synchronized layouts if supported by a future licensed integration. The public widget does not expose its internal drawing/indicator state to Cuantai.

**Blocked:** some symbols/data levels may be unavailable for external widgets under TradingView/exchange conditions. Table/research US providers and native BYMA data still require their separate credentials/contracts.

**Next:** validate chart coverage for the deployment's intended markets. See [widget/fullscreen integration](TRADINGVIEW.md).

## Phase 3 — Asset intelligence

**Implemented:** exact-listing asset pages; fundamentals adapter with explicit missing data; original news links and timestamps; structured sourced research UI; deterministic technical reports and persisted history; configurable OpenAI Responses pipeline with required evidence tool call, strict structured output, source allowlist, numeric-prose rejection, token caps, timeout and per-user budget. Reports explain missing/stale/demo evidence. Optional follow-up question is stored with the report.

**Added 2026-10-17:** SEC ticker/exchange/CIK resolution, annual US-GAAP income/balance/cash-flow facts, one filing version per fiscal column, up to five annual periods, per-fact filing links and units, explicitly derived simplified free cash flow, financial/unknown-sector exclusions, current-date staleness warnings, operator snapshot import and provider configuration status. The Financials tab has keyboard navigation, full/millions scale and horizontal table scrolling on mobile. CEDEAR statements belong explicitly to the US issuer. Configured AI evidence can receive up to three sourced annual periods. Missing price data no longer renders a spurious signed percentage or repeated error messages.

**Tested:** report integrity, invented/absent source rejection, unavailable/insufficient evidence, stale-data labeling, no fabricated demo financials or headlines, persisted report isolation. Deterministic report flow tested end-to-end.

**Additional tests:** annual/quarterly/YTD separation, non-calendar and 53-week fiscal years, amendments without mixed-version fill, contradictory contexts, duplicate facts, currency units, exact decimal values, unsafe integers, missing evidence, bank/unknown-sector exclusions, stale snapshots, ticker/share-class identity, contact gating and offline provider behavior. The CLI import → authenticated API → browser tables passed using an isolated, explicitly synthetic test issuer. Dark/light desktop and 390px mobile captures were reviewed; no page errors or page overflow. Test data is never used in normal application data.

**Pending:** complete statement/custom-tag coverage, quarterly/YTD/TTM reconciliation, comparative restatements, IFRS, comparables, DCF, macro series, broader event collection, conversation management/export, report cache/expiry and deeper semantic factuality evaluation. Financials explains the implemented annual subset; Valuation remains explicitly unavailable.

**Blocked:** no stock fundamentals/news credentials, model credentials or real operator SEC contact were supplied. **Live SEC network access and live model synthesis were not tested.** SEC requires identified access, not an API key.

**Next:** identified SEC smoke test and issuer/filing reconciliation, followed by quarterly coverage and scenario valuation.

**Asset overview update 2026-10-17:** research-first page with daily/weekly/monthly/annual price-return cards, deterministic technical/annual-fundamental conclusions, historical volatility/drawdown with explicit limits, key data, compact TradingView preview and “Ver gráfico” full workspace, visible latest news and private per-asset conversations. Chat uses bounded server-owned context and sourced structured AI output when configured; demo/missing credentials are explicitly rules-based. Migration 0003 persists atomic turns with ownership and conversation-version checks. See [methodology and API](ASSET_INTELLIGENCE.md).

## Phase 4 — Portfolio intelligence

**Implemented:** private named portfolios with fixed base currency; transaction ledger; precise FIFO accounting, partial sales, buy/sell fees, dividends, manual split factors, cash entries; original transaction currency and dated historical FX; separate current FX and manual certificate prices; complete/incomplete totals; composition and positions; sourced dated CEDEAR ratio import/history and underlying exposure when available; deterministic concentration diagnosis. USDT is separate from USD. No automatic broker execution or cash double-entry assumption.

**Tested:** exact decimal arithmetic and quantity display down to one satoshi; fees and partial sales; oversell/backdated rejection; splits/dividends/cash; rejection of nonzero split price/fees; ARS certificates valued per certificate without reapplying ratio; USD CEDEARs without double conversion; independent historical/current FX; missing FX/quote handling; identity currency checks; private manual prices; ownership checks; persistent database-backed calculations through APIs.

**Pending:** automated corporate actions, broker/CSV import, historical equity curve, realized FX decomposition/tax reporting, TWR/XIRR, ETF holdings look-through, historical correlations, sector/geography aggregation and model-generated portfolio research. Current portfolio diagnosis is explicitly deterministic and limited.

**Blocked:** current ETF holdings, corporate actions and native licensed BYMA data were not available.

**Next:** validate imported data against issuer/broker records before expanding portfolio analytics.

## Phase 5 — Advanced features

**Implemented:** independent multi-widget layouts with opening preset persistence and per-chart fullscreen. Native TradingView tools replace the former custom drawing/indicator UI.

**Tested:** widget layout switching, preset persistence/ownership, native fullscreen, mobile viewport fallback and source-failure behavior.

**Pending:** server-side alert worker, background notifications, synchronized layouts, advanced screener/comparators, performance profiling and distributed cache. Internal widget drawings are not claimed as Cuantai-persisted data.

**Blocked:** background delivery needs always-on infrastructure and feed entitlements; deeper widget APIs would require a different licensed integration.

**Next:** complete licensed table/research data and statement coverage before peripheral features.

## Verification ledger

- **97 unit tests across 11 files passed:** price-return calendar boundaries/completeness, historical risk, fundamental evidence, conversational source/fact validation and bounded model context; prior domain/security coverage plus annual SEC filing contexts, versions, units, precision, missing/stale evidence, issuer identity, offline files, sector boundaries and per-HTTP-attempt provider budgets. Quantity formatting preserves small fractions and integers above the JavaScript safe-integer range; splits cannot silently discard costs. Neutral technical trends and original report data status are preserved.
- **15 Playwright browser/API scenarios passed against the optimized local production server:** authentication/owner boundaries; CEDEAR ARS/USD accounting; workspace/report persistence; invalid origin/input; UI registration/onboarding/watchlists/chart recovery; mobile navigation and official TradingView layouts; portfolio forms/theme persistence; financial-data absence; and fiscal statement table rendering with keyboard/source/scale/mobile checks. The financial table rendering scenario uses an explicitly synthetic intercepted fixture; a separate isolated offline-import/API/browser smoke check also passed without interception. Asset overview and conversation scenarios additionally verify complete summary panels, small/full chart navigation, retry, mobile layout, private history reload, account/listing isolation and stale-conversation conflicts. Three chart scenarios verify official embed inputs/no local datafeed, fullscreen continuity, mobile fallback/Escape and failure/retry; third-party iframe internals use an embed-only fixture with no market data.
- ESLint and strict TypeScript passed; optimized Next.js build passed. Formatting and diff whitespace checks were also completed; the optimized local server returned HTTP 200 for landing, demo, registration and private settings.
- Migrations applied twice to an isolated local PGlite database without reapplying history.
- Desktop and 390px mobile screenshots reviewed; no page JavaScript errors or horizontal mobile overflow in the reviewed dashboard. Dark/light financial tables and official TradingView fullscreen screenshots were reviewed. A final optimized production smoke check verified theme reload, a clearly labeled synthetic technical report, and readable dark text on white when printing. No page JavaScript errors were recorded.
- `npm audit --omit=dev`: **0 vulnerabilities**. Full audit reports **5 high development-tool dependency findings** through the latest installed Next ESLint plugin → fast-glob/micromatch/braces chain. No compatible upstream patched braces release was available in the inspected registry; no unsafe downgrade/override was applied. Track and update before broader development-tool exposure.
- External PostgreSQL/Docker, Google OAuth, outbound recovery emails, US licensed feeds, Finnhub, live SEC access and live model generation were **not** verified.

## Acceptance gaps and prioritized backlog

1. **Release gate:** provide keys/contracts, verify real US asset + crypto + sourced model analysis, confirm display rights and run integration tests on managed PostgreSQL. These live acceptance criteria remain open.
2. Extend annual SEC coverage with primary-filing validation, quarterly reconciliation, comparative restatements, business-appropriate metrics and scenario valuation. See [implemented annual coverage](FINANCIAL_STATEMENTS.md).
3. Validate native BYMA contract and authorized ratio history; extend automated licensed ingestion.
4. Improve universe synchronization, discovery filters, ETF holdings and corporate actions.
5. Finish portfolio return series, TWR/XIRR, richer exposure/correlation analysis and explicit cash accounting options.
6. Extend conversation management/export, research caching, deeper source/numeric semantic evaluation and portfolio AI.
7. Add alert workers and explore supported/licensed synchronized chart integration. Native drawing tools remain inside TradingView.
8. Complete localization, accessibility/contrast audit, performance profiling, backup/restore and distributed operations.
