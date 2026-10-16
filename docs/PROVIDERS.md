# Data providers and provenance

Research date: **2026-10-14**; connectivity check: **2026-10-15**. Coverage, prices, terms and quotas can change. A configured key is not a license to display or redistribute data. This document is an implementation record, not a legal clearance.

## Implemented adapters

| Adapter                | Coverage and endpoints                                                                                                                            | Access                                                                                   | Verification                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Binance Spot           | `data-api.binance.vision/api/v3/exchangeInfo`, `ticker/24hr`, `klines`; native intraday/daily/weekly/monthly intervals                            | Public market data, separate from trading APIs; check geographic restrictions and terms  | **Live check passed:** timestamped BTC/USDT quote + 500 valid daily candles on 2026-10-15. Unit-tested normalization and intervals.        |
| Twelve Data            | `symbol_search`, `quote`, `time_series`; US discovery restricted to supported USD listings                                                        | Server-side `TWELVE_DATA_API_KEY`; plan-specific exchange coverage and display rights    | Implemented, credential gates tested. **No key available for live verification.**                                                          |
| Finnhub                | `stock/metric`, `news`, `company-news`                                                                                                            | Server-side `FINNHUB_API_KEY`; stock fundamentals and headlines according to plan        | Implemented; **no key available for live verification**. Metrics without a supplied observation date say so. No full articles republished. |
| BYMA authorized export | Validated JSON containing exact listings, quote currency, source, as-of, retrieval time, status/delay and optional daily/weekly/monthly histories | `BYMA_AUTHORIZED_DATA_FILE`; data must come from a feed/export you are authorized to use | Schema and missing-credential behavior tested. **No licensed export supplied. Direct BYMA HTTP integration remains pending.**              |
| Manual prices / FX     | Private records attached to their owner                                                                                                           | Authenticated same-origin API                                                            | E2E-tested with ARS and USD CEDEARs, historical/current FX and partial sales.                                                              |
| Explicit demo          | Deterministic synthetic OHLCV, fixed as-of 2025-03-14                                                                                             | No key, isolated by `demo` flag                                                          | Reproducibility/provenance tested; never substituted after a live failure.                                                                 |

`Quote`, `Candle` and `Provenance` are normalized contracts. Prices and portfolio money are decimal strings. Instrument ID includes exchange, ticker and trading currency. Every data response includes a source, observation timestamp, retrieval timestamp, status, currency, adjustment state and known delay where applicable. Unknown delay is `null`; missing fundamentals are not zero.

### Quotas, cache and failures

- Same snapshot calls are cached/deduplicated for 30 seconds; fundamentals for one hour and news for five minutes. Provider instrument metadata is cached separately.
- Cache and circuit breakers are process-local and bounded. This is not a distributed Redis cache.
- At most one immediate retry for transport failures; quota errors are not retried.
- Configurable server-side per-provider request budgets use PostgreSQL. Defaults: Twelve Data 8 upstream calls/minute, Finnhub 30; set these according to the actual plan. A quote and a history request count separately. Large overviews can therefore have unavailable instruments on a small plan.
- Live public market requests have a shared database budget of 240 requests/minute to cap fan-out. Production still needs edge/IP controls and contract-aware user entitlements.
- A provider failure produces unavailable data and its reason. No synthetic live quotes.
- HTTP polling is request-driven. Streaming, WebSocket reconnection, a holiday-aware exchange calendar and background delivery are pending.

## Providers investigated but not integrated

| Provider          | Use                                                          | Reason / dependency                                                                                                                                                                                               |
| ----------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC EDGAR         | Primary company filings and XBRL company facts               | No API key generally required, but identifiable User-Agent, fair access, period reconciliation and company/ticker mapping are needed. Financial-statement ingestion is pending.                                   |
| Massive / Polygon | US exchange market data, aggregates and reference data       | Alternative vendor boundary documented; commercial display/redistribution entitlements and access are required. No adapter is claimed to be working.                                                              |
| Native BYMA APIs  | Snapshot, Delay20, EOD, instruments, indices and market news | Official descriptions confirm distinct products and contractual onboarding. Native authenticated contracts were not available in this environment. Do not infer URLs or response fields from the marketing pages. |

The code defines separate search, quote, history, fundamentals, news, corporate-action and FX interfaces. Corporate-action and automated FX provider implementations are pending. Swapping synthesis vendors requires an adapter implementing evidence collection, tool use and structured output; an arbitrary OpenAI-compatible Chat Completions endpoint is insufficient.

## Authorized BYMA export format

`BYMA_AUTHORIZED_DATA_FILE` is a server-local absolute file path. It is not a public URL and is not bundled into a deployment. Use an authorized ingestion process to normalize your licensed feed into the schema in `src/lib/market/byma.ts`.

```json
{
  "source": "Your licensed BYMA feed / export name",
  "sourceUrl": "https://your-authorized-source.example/data",
  "retrievedAt": "2026-10-15T20:30:00Z",
  "status": "eod",
  "delayMinutes": null,
  "quotes": [],
  "histories": []
}
```

Quotes require `instrumentId`, `currency` (`ARS` or `USD`), positive decimal `price`, signed decimal `changePercent`, nullable `volume` and ISO `asOf`. Histories require `instrumentId`, `timeframe`, `adjusted` and validated OHLCV `candles`. No intraday candles are generated from daily closes. Empty collections yield a clear unavailable state.

BYMA JSON on local disk is suitable for the local adapter. A serverless deployment needs a persistent licensed ingestion service or authenticated object storage adapter; a developer's local path is not deployable storage.

## Dated CEDEAR ratios

Import a file obtained from an authorized issuer/reference source:

```json
{
  "source": "https://issuer.example/authorized-ratio-publication",
  "retrievedAt": "2026-10-15T12:00:00Z",
  "ratios": [
    {
      "instrumentId": "BYMA:EXAMPLE:ARS",
      "underlyingId": "NASDAQ:EXAMPLE:USD",
      "certificatesPerShare": "1",
      "effectiveFrom": "2026-10-15"
    }
  ]
}
```

This is a schema illustration using fictitious identifiers, not a real ratio. Import validates the existing listing/underlying relation and rejects conflicting values for the same effective date. Historical records are retained; future-dated entries do not become current early. The API displays the latest effective record and its source. Missing ratios leave equivalent underlying exposure uncomputed. Certificate valuation never divides the quoted certificate price by a ratio again.

## Primary references

- [Binance Spot REST market data](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- [Twelve Data documentation](https://twelvedata.com/docs) and [terms](https://twelvedata.com/terms)
- [Finnhub API documentation](https://finnhub.io/docs/api) and [terms](https://finnhub.io/terms-of-service)
- [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)
- [Massive REST quickstart](https://massive.com/docs/rest/quickstart)
- [BYMA Market Data products and access](https://www.byma.com.ar/productos/productos-de-datos/market-data/apis)
- [BYMA API catalog](https://www.byma.com.ar/byma-apis)
- [Lightweight Charts pane API](https://tradingview.github.io/lightweight-charts/tutorials/how_to/panes)
- [Better Auth Drizzle adapter](https://better-auth.com/docs/adapters/drizzle)
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs) and [function calling](https://developers.openai.com/api/docs/guides/function-calling)

UX references reviewed: CandL (focused multi-pane charting), TradingView (asset discovery), Finviz (compact screening), Koyfin (contextual financial workspace), Portfolio Performance (transaction-based accounting). Cuantai uses original layout, styling, copy and code; none of their proprietary resources were copied.
