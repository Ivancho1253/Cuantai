# Market discovery catalog

The small client-side featured list is separate from the complete server-side discovery catalog. Markets and global search use the complete catalog, including in demo mode. No provider key is needed to browse the imported listings.

The included snapshot contains 503 US equity listings from State Street's published SPY holdings dated November 6, 2026. Listing exchanges are matched against the SEC company tickers/exchanges dataset. Cash, derivatives and numeric contra positions are excluded. This is a dated holdings snapshot used to discover the S&P 500 equities, not a licensed index feed or a guarantee of future membership. US prices and histories still require Twelve Data coverage and quota.

Coin100 contains exactly 100 unique coins from CoinGecko's `/coins/markets` endpoint ordered by USD market capitalization. The import requires ranks 1 through 100 in that order. It includes stablecoins and wrapped assets; this selection is not the licensed CMC100 index or a calculated index value. Market-cap rank is the default order and is shown in the table. Existing Binance spot identities remain resolvable for saved favorites and links, but do not add duplicate assets to the 100-coin browsing list. This replaces the previous unbounded crypto snapshot.

The CEDEAR snapshot includes all 445 unique programs in BYMA's public instrument list dated September 16, 2026, reconciled against Caja de Valores' issuer spreadsheet. It includes certificates of shares and ETFs. Local symbols are preserved; only known existing dollar species are retained, without manufacturing new `D` or `C` symbols. The 447 browsable species include the existing AAPLD and JPMD dollar listings. Publication/retrieval dates and sources are saved in the snapshot. A duplicate XLU row in BYMA's PDF is recorded in the import manifest and resolved using Caja's explicit XLU and CIBR definitions. Ratios are reference metadata, not historical effective-date records for portfolio accounting. An underlying is linked only when an explicit source ticker or matching issuer identity verifies it.

## Refresh

Install the import dependency with `python -m pip install -r scripts/requirements-catalog.txt`, then run `npm run data:sync-catalog` with Node.js 22+ and Python 3. The script downloads SPY holdings, SEC exchange identities, the top 100 CoinGecko market-cap ranking, BYMA's currently linked CEDEAR PDF, and Caja's issuer spreadsheet. It validates every source, exact crypto ranks and complete PDF row extraction before replacing the three JSON snapshots in `src/lib/market/data/`. `SEC_USER_AGENT` and `COINGECKO_API_KEY` can be supplied through the process environment. Source URLs, retrieval timestamps and publication dates are saved with the data. Refresh regularly to pick up ranking and listing changes; membership does not refresh automatically in the background.

## Runtime behavior

- `GET /api/data/market-catalog` supports `category`, `q` and `page`. Categories include `S&P 500`, `Coin100` (`Cripto` remains an API alias), `CEDEARs`, `Estados Unidos`, `Argentina`, `ETFs` and `Todos`. Pages contain 50 listings plus totals and source dates. User-selected price/change/volume sorting applies to the displayed page; Coin100's default ranking applies across the entire selection.
- Global search queries the complete catalog, with exact ticker matches first. Opening an asset and adding it to a watchlist resolves its full identity. Provider IDs identify CoinGecko URLs, preventing ticker collisions.
- Discovery data stays on the server. The dashboard's existing small overview does not launch requests for the entire catalog.
- Live catalog pages request quotes only, not histories for every listing. CoinGecko quotes are batched by ID and cached for one minute. US quotes share the provider's existing quota; missing data stays unavailable. Demo pages contain explicitly marked synthetic quotes, including for newly imported listings.
- CoinGecko USD quotes use aggregate prices and rolling 24-hour changes. Aggregated dollar turnover is not represented as asset-unit volume. The adapter does not invent missing prices, changes, timestamps or OHLCV. Complete OHLCV history and TradingView coverage are unavailable for CoinGecko-only listings; Binance assets keep their existing chart support.
- Small crypto prices keep significant decimal digits in the table and ribbon.

The ribbon animates automatically in both system motion modes, more slowly with reduced motion, and has an explicit pause/resume control. Keyboard focus on an asset link pauses scrolling for navigation; selecting a mode does not pause it.

Sources: [State Street SPY](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-sp-500-etf-trust-spy), [SEC exchange identities](https://www.sec.gov/files/company_tickers_exchange.json), [CoinGecko ranking](https://docs.coingecko.com/reference/coins-markets), [CoinGecko prices](https://docs.coingecko.com/reference/simple-price), [BYMA public CEDEAR list](https://www.byma.com.ar/productos/productos-financieros/cedears), [Caja de Valores issuer data](https://cajadevalores.com.ar/Servicios/Cedears).
