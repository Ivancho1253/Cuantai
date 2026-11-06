# Annual financial statements

Implemented on **2026-10-17**. The Financials tab presents selected annual US-GAAP facts from SEC EDGAR: income, balance sheet and cash flow. This is a sourced selection of concepts, not a reconstruction of every line, note, segment or reconciliation in a company's complete financial statements.

## Configure the network provider

SEC's public disclosure APIs do not require an API key. They require identified, moderate automated access. Set these server variables in `.env.local`:

- `MARKET_DATA_MODE=live`
- `SEC_USER_AGENT`: application name followed by a **real operator contact email**. There is deliberately no built-in email or anonymous fallback.

Restart the server, sign in, open a supported NYSE/NASDAQ US stock and select Financials. The provider first resolves the exact ticker **and exchange** in SEC's ticker directory, then requests Company Facts for the matched CIK. Dot/hyphen share-class notation is normalized; conflicting CIK matches are rejected. SEC itself does not guarantee the ticker directory's accuracy or scope, so confirm issuer identity before relying on a mapping.

Public demo pages and `MARKET_DATA_MODE=demo` do not display invented statements. Missing identity, blocked requests, unavailable facts or unsupported accounting standards produce an explicit unavailable state. ETFs, crypto and non-US issuers are outside this adapter. A supported CEDEAR follows its stored US issuer relation, and the table explains that the statements belong to that issuer in USD. It never converts issuer statements to ARS or divides them by a certificate ratio.

The server caches the ticker directory for 24 hours and **normalized** issuer statements for six hours. Raw large Company Facts documents are not retained in the process cache. A shared SQL budget allows two HTTP attempts per second, including retries. This leaves headroom below SEC's documented ten-request/second ceiling. Other applications sharing the same IP still count toward SEC's limits. Manual refresh can return a cached response; it does not bypass access controls.

## Offline SEC snapshots

An operator can use downloaded SEC JSON without network access. Prepare a bundle containing:

```json
{
  "retrievedAt": "ACTUAL_ISO_UTC_DOWNLOAD_TIMESTAMP",
  "companyTickers": "THE_PARSED_company_tickers_exchange.json_OBJECT",
  "companyFacts": ["THE_PARSED_COMPANY_FACTS_OBJECT_FOR_EACH_ISSUER"]
}
```

The quoted placeholders above describe objects to insert; they are not valid bundle values. Preserve the complete original `cik`, `entityName` and `facts` structure for each issuer and the `fields`/`data` ticker directory. Use files actually downloaded from SEC, with an honest retrieval timestamp. The import validates shape, annual availability and duplicate CIKs; it is not a cryptographic authenticity check.

```sh
npm run data:import-sec -- /absolute/path/sec-bundle.json
```

The default destination is `.data/sec-companyfacts.json`. Set `SEC_COMPANYFACTS_FILE` to that absolute path and restart the app. If this variable is set during import, it selects the destination instead. The importer validates before atomically replacing the destination. Files are limited to 25 MB and 100 issuers; large universes need a separate ingestion service. The embedded app database is not involved in this import.

When a snapshot file is configured, it is authoritative: missing or invalid contents cause unavailability, never a hidden network or demo fallback. The original retrieval time remains visible; it is not replaced with the time of the request. Normalized file results are cached for one minute. Keep imported files outside the public directory and source control. A serverless deployment needs a persistent source or a storage adapter; local disk snapshots are a development/Node-host option.

## Period and version rules

- Only `10-K` and `10-K/A`, standard `us-gaap` concepts and supported USD units are used. EPS retains `USD/shares`. IFRS and custom extensions are not guessed or converted.
- Candidate annual durations must span 335–395 days, covering ordinary 52/53-week years. Short transition periods are not supported. Dates come from `start` and `end`, not the reporting `fy`, `fp` or calendar-frame label.
- For each filing, the latest annual end identifies its own exercise. The most widely supported exact start context is used, with duplicate copies of the same tag counted once. Conflicting filing metadata invalidates that filing.
- Up to five fiscal exercises are shown. Each column selects the latest filed version of **that exercise's own annual filing** and reads all its facts from the same accession and exact dates. Instant balance facts must have that end and no duration start.
- An amendment is not filled with missing values from the older filing. Contradictory values for an identical concept/context are left absent. Later filings' comparative columns do not silently replace older annual presentations. Restatements found only in later comparative periods need separate reconciliation and remain pending.
- The retrieval date limits which filings can be considered; this module is not a historical point-in-time backtesting dataset.
- Missing facts stay absent. Zero and negative reported values remain valid. Unsafe integer JSON values are omitted with an explanation rather than silently rounded. Monetary arithmetic uses Decimal; the millions display rounds only its presentation to two decimals, while full units retain available precision.
- Simplified free cash flow is explicitly derived as operating cash flow minus nonnegative payments to acquire PP&E, from the same filing/context. It is not a US-GAAP line item or a complete definition of free cash flow. It is not calculated for financial-sector issuers or unknown sectors; generic revenue/gross/operating-profit rows are also excluded there. Sector classification comes from the instrument catalog and still needs issuer-level verification for release.

Every value links to its accession's SEC filing index. Hover text identifies its XBRL tags, full value and unit; headers show start, end, filing date and form. The methodology panel shows retrieval time, imported/API delivery and known limitations. Financial-source IDs can join the configured AI evidence tool, capped at three annual periods. No model call was made to verify that integration with live credentials.

## Verification and remaining work

Unit tests use explicitly synthetic SEC-shaped fixtures for periods, versions, precision, currency, share classes, missing facts, contact gating and offline ingestion. Browser tests cover tables, exact/millions scale, EPS, filing links, keyboard navigation and mobile scrolling. Test fixtures are never imported by application code or used as default application data.

Live SEC network access is **not verified** in this session because no real operator `SEC_USER_AGENT` was supplied. The network contract was checked against official documentation, and its request/response boundary is tested with mocks. Quarterly/YTD reconciliation, trailing periods, custom tags, IFRS, primary-filing completeness, comparative restatements, DCF and financial-industry-specific analysis remain pending.

Primary references reviewed 2026-10-17: [SEC disclosure APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [SEC access policy, directory and filing paths](https://www.sec.gov/search-filings/edgar-search-assistance/accessing-edgar-data), [developer resources](https://www.sec.gov/about/developer-resources).
