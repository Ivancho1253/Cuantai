# Asset logos

Every instrument in the shipped discovery catalog has a local visual identity: company marks, fund-manager marks, crypto marks or fiat currency symbols. `AssetIcon` is shared by market rows, related listings, global search, watchlists, portfolios, research, landing previews and asset headers. Chart selectors now use it too. These are independent of the logo rendered inside the TradingView iframe.

`src/lib/market/logos.ts` resolves the exact listing identity, with no database migration or credentials. A CEDEAR resolves its explicit `underlyingId`, so JPM, JPMD and the US JPM issuer share a mark while their prices/listing identities remain separate. The resolver never removes a trailing D to guess an issuer. A missing underlying retains the neutral fallback. ETFs identify the fund manager/brand, not an invented constituent company.

The current 25 catalog instruments use 21 files under `public/asset-logos`, including shared certificate/issuer images. Known assets load from the application origin without third-party image requests. Existing database rows receive the new logos through the resolver and do not need to be rewritten. Images reserve space, preserve their aspect ratio, load lazily and have accessible names. A white brand plate preserves dark marks in either theme; Invesco's white mark uses a navy plate. Marks are never color-inverted. An unavailable/broken image becomes a neutral asset-type icon, and changing the listing resets that failure state.

For new instruments discovered after the seed catalog, supported US stock/ETF identities use the FMP symbol image host; native BYMA stocks use the vendor's `.BA` identifier; Binance USDT pairs use the pinned crypto icon collection. External requests use `referrerPolicy=no-referrer`. Only generated paths on these fixed hosts are used; arbitrary supplied URLs are not accepted. External logo coverage is best effort, not a claim that every financial instrument in existence has a verified mark. Unknown venues, unsupported classes and unmapped certificates keep the neutral icon.

## Sources and attribution

Company/fund images were retrieved on **2026-10-18 UTC** from `https://images.financialmodelingprep.com/symbol/<symbol>.png`, with these exact vendor symbols: NVDA, AAPL, MSFT, GOOGL, AMZN, META, TSLA, JPM, BRK.B, KO, SPY, QQQ, DIA and GGAL.BA. See [FMP company image documentation](https://site.financialmodelingprep.com/developer/docs/company-image-api). This image source is separate from market quotes and research; logo availability does not imply an active financial-data subscription or an affiliation with an issuer.

BTC, ETH, SOL, USDT, USD and EUR SVGs are from [spothq/cryptocurrency-icons](https://github.com/spothq/cryptocurrency-icons/tree/1a63530be6e374711a8554f31b17e4cb92c25fa5), pinned to commit `1a63530be6e374711a8554f31b17e4cb92c25fa5`. The project's CC0 text is preserved at [public/licenses/cryptocurrency-icons.txt](../public/licenses/cryptocurrency-icons.txt). The ARS visual is an original Cuantai currency symbol inspired by the national colors; it is not presented as a company's logo. Brand and trademark ownership remains with the respective issuers/projects.

To update a known brand, replace its local image and, if needed, adjust its exact identity entry and background. Do not infer an underlying from a local ticker or swap an ETF's mark for a single holding. Check both themes and mobile rendering. Unit checks cover catalog files and identity/security boundaries; browser checks exercise all 25 images, both themes, failure fallback and switching an existing chart to a different issuer.

## Catálogo ampliado

Se agregaron 626 imágenes descargadas y verificadas por firma PNG/JPEG/WebP bajo `public/asset-logos/catalog`, incluyendo las 100 monedas de Coin100. `src/lib/market/data/asset-logos.json` asocia cada identidad exacta con su archivo local y URL de procedencia. Los CEDEARs comparten el logo de su subyacente verificado. El resto usa un monograma con ticker cuando no hay marca publicada o falla una imagen; el monograma no se presenta como logo oficial.

Actualizar con `node --import tsx scripts/sync-asset-logos.ts`. La sincronización solo acepta imágenes de hosts fijos de FMP y CoinGecko y conserva las existentes si una descarga falla. La imagen se obtiene por el ID de CoinGecko, sin confundir símbolos iguales.
