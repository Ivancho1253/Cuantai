# Argentine local share catalog

`src/lib/market/data/argentina.json` contains the verified local share universe used by **Acciones ARG**. This is a discovery catalog, not an investment recommendation or a replacement for the live quote adapter.

The snapshot retrieved on 2026-11-12 contains **80 distinct local ARS listings**. **71** have a published liquidity observation dated **2026-11-12**; **19** belong to MSCI Merval. The request for one hundred shares is recorded in the metadata, but the importer does not add ADRs, CEDEARs, dollar species or repeated company identities to reach that count.

## Sources

- [BYMA listed companies directory](https://www.byma.com.ar/financiarse/para-emisoras/empresas-listadas): local symbol, issuer name, sector, ISIN and explicit trading-interruption notices.
- [BYMA daily equity dashboard](https://www.iamc.com.ar/informesanuales/): the public embedded reference catalog, observation date and index membership.
- [Deferred equity report JSON linked by the dashboard](https://www.iamc.com.ar/d/acc.json): ADTV and the local daily report rows.
- [BYMA announcement of the MSCI indices](https://www.byma.com.ar/en/newsroom/byma-y-msci-lanzan-nuevos-indices-que-ofrecen-acceso-al-mercado-de-acciones-argentino): index scope and launch context. Index membership in the application follows the dated report rather than a hand-maintained leader list.

The directory's `CEPU2` identity is matched to the report's `CEPU` by the same ISIN, `ARP2354W1188`, and is represented once. `COMO` and `OVOP` are excluded because the directory explicitly marks trading as interrupted. These resolutions are retained in the snapshot metadata.

## Order and data boundaries

The default order is descending **average daily traded value over forty trading sessions**, in ARS, as published by the source. Entries without that measurement follow alphabetically and have no numerical liquidity rank. The date and number of measured listings are visible in Mercado. This is not an ordering by expected return or business quality.

All listings use `BYMA:<symbol>:ARS`, `type: stock`, and `country: AR`. They remain separate from US shares, CEDEARs, ETFs and crypto. Local TradingView charts use `BCBA:<symbol>`; publisher feeds use the Buenos Aires ticker suffix. Global instrument search, favorites and exact-listing asset pages reuse the catalog.

No closing prices or histories are copied from the directory/report into the application quote store. Demo prices remain explicitly synthetic. Live BYMA quotes still require the existing authorized data source; missing prices stay unavailable.

## Refresh

Run `npm run data:sync-argentina` (Python standard library only). The importer parses published HTML/JSON as data and does not execute remote scripts. It rejects unresolved report listings, duplicate identities, invalid liquidity data and unexpected universe sizes; writing is atomic.

For a repeatable offline import, pass `--directory-file`, `--dashboard-file` and `--report-file` paths to `scripts/sync-argentina-catalog.py`. Every imported listing retains source identity and the ranking observation date. Refresh is explicit; the checked-in order does not pretend to be real time.
