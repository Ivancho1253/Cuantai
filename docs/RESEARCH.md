# Research desk

The analyst view has two separate workspaces: **Informe del activo** and **Preguntas y respuestas**. The asset picker searches the full discovery catalog and keeps the exact listing and currency. Authenticated reports and conversations persist in the database.

## Without an AI key

Reports use calculated indicators: fast/slow exponential averages, RSI, MACD histogram, ATR relative to close, and recent price extremes. Explanations vary with those signals, including disagreement between trend and momentum. Scenario conditions are hypotheses, not predictions.

An optional report question gets its own answer. The conversation supports technical, performance, fundamental, risk and news topics through rules. Unsupported open questions explicitly say that an AI provider is needed. This is never presented as a model-generated answer. Technical requests have a per-user rate limit of sixty per minute, separate from the configured AI daily budget.

The UI identifies simulated market prices and their observation date. Actual company valuation, macroeconomic conclusions and unsupported financial facts are not fabricated.

## With an AI provider

Set `OPENAI_API_KEY` and `AI_MODEL` in the untracked `.env.local`, then restart the server. An optional `AI_BASE_URL` must support the Responses API and structured output; a Chat Completions-only endpoint is insufficient. Existing evidence and source validation remain in place. Live AI generation still requires credential-backed verification.

## News

News is independent of market price mode. With Finnhub credentials, supported listings use that adapter first. When it is unavailable or returns no articles, public publisher feeds supply headlines:

- General market: CNBC and MarketWatch.
- Selected asset: Yahoo Finance ticker RSS; CEDEARs resolve their configured underlying first.

Feeds retain publisher/feed attribution, article links and publication dates. Only headlines are displayed. No articles or quotations are generated. Empty or unavailable feeds produce an explicit state with retry; a different company's news is never inserted to fill an empty list. Responses are cached for five minutes, and the UI supports refresh and title/source filtering.

Verified locally: all three feed endpoints returned RSS successfully; the general news API returned forty real headline records without credentials. Unit tests cover parsing, unsafe links, missing dates, feed failure and deduplication. Browser tests cover exact asset selection, report questions, persistent conversations, filtering and refresh.
