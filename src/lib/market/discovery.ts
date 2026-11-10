import sp500 from './data/sp500.json';
import crypto from './data/crypto.json';
import cedearData from './data/cedears.json';
import { instruments } from './catalog';
import type { Instrument } from './types';

// This module is imported by server routes/services only. The complete catalog stays off the client.
const stocks: Instrument[] = sp500.entries.map(([exchange, symbol, name]) => ({
  id: `${exchange}:${symbol}:USD`,
  exchange,
  symbol,
  name,
  currency: 'USD',
  type: 'stock',
  country: 'US',
  sector: 'S&P 500',
  color: '#91bca7',
  source: 'State Street SPY holdings + SEC listing exchange',
}));
const coins: Instrument[] = crypto.entries.map(([id, symbol, name]) => ({
  id: `COINGECKO:${id}:USD`,
  exchange: 'COINGECKO',
  symbol: (symbol || id).toUpperCase(),
  name: name || id,
  currency: 'USD',
  type: 'crypto',
  providerSymbol: id,
  marketCapRank: (crypto.marketCapRanks as Record<string, number>)[id],
  country: 'Global',
  sector: 'Crypto',
  color: '#b69aee',
  source: 'Coin100 · CoinGecko market-cap ranking',
}));
const knownIssuers = [...stocks, ...instruments].filter(
  (i) => i.type === 'stock' || i.type === 'etf',
);
const issuerName = (name: string) =>
  name
    .toLowerCase()
    .replace(/\b(the|incorporated|inc|corporation|corp|company|co|plc|limited|ltd)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
const certificates: Instrument[] = cedearData.entries.map((entry) => {
  const underlyingSymbol = 'underlyingSymbol' in entry ? entry.underlyingSymbol : undefined;
  // A local symbol is not sufficient to guess the issuer of a certificate.
  const issuer = knownIssuers.find((i) =>
    underlyingSymbol
      ? i.symbol === underlyingSymbol
      : i.symbol === entry.symbol && issuerName(i.name) === issuerName(entry.name),
  );
  return {
    id: `BYMA:${entry.symbol}:ARS`,
    exchange: 'BYMA',
    symbol: entry.symbol,
    name: `${entry.name} · CEDEAR${entry.kind === 'etf' ? ' ETF' : ''}`,
    currency: 'ARS',
    type: 'cedear',
    country: 'AR',
    sector: entry.kind === 'etf' ? 'CEDEAR ETF' : 'CEDEAR de acciones',
    color: '#91bca7',
    source: `${entry.source} · listado de CEDEARs`,
    cedearKind: entry.kind === 'etf' ? 'etf' : 'stock',
    cedearRatio: entry.ratio,
    ...(issuer ? { underlyingId: issuer.id } : {}),
  };
});
const catalog = [
  ...new Map(
    [...stocks, ...coins, ...certificates, ...instruments].map((instrument) => [
      instrument.id,
      instrument,
    ]),
  ).values(),
];
const byId = new Map(catalog.map((instrument) => [instrument.id, instrument]));
const coin100Ids = new Set(coins.map((instrument) => instrument.id));
const visibleCatalog = catalog.filter((i) => i.type !== 'crypto' || coin100Ids.has(i.id));
const sp500Ids = new Set(stocks.map((instrument) => instrument.id));
const featured = new Set(instruments.map((instrument) => instrument.id));
export const catalogCounts = {
  sp500: stocks.length,
  crypto: coins.length,
  cedears: certificates.length,
  cedearListings: visibleCatalog.filter((i) => i.type === 'cedear').length,
  total: visibleCatalog.filter((i) => i.type !== 'cash').length,
};
export const catalogDates = {
  sp500: sp500.asOf,
  crypto: crypto.retrievedAt,
  cedears: cedearData.asOf,
};
export const findDiscoveryInstrument = (id: string) => byId.get(id);
export const findDiscoveryListing = (exchange: string, symbol: string) =>
  catalog.find((i) => i.exchange === exchange && (i.providerSymbol ?? i.symbol) === symbol);

export function discoverInstruments({
  query = '',
  category = 'Todos',
  page = 1,
  pageSize = 50,
}: { query?: string; category?: string; page?: number; pageSize?: number } = {}) {
  const needle = query.trim().toLowerCase();
  const rows = visibleCatalog.filter(
    (i) =>
      i.type !== 'cash' &&
      (category === 'S&P 500'
        ? sp500Ids.has(i.id)
        : category === 'Estados Unidos'
          ? i.country === 'US'
          : category === 'Cripto' || category === 'Coin100'
            ? coin100Ids.has(i.id)
            : category === 'CEDEARs'
              ? i.type === 'cedear'
              : category === 'Argentina'
                ? i.country === 'AR'
                : category === 'ETFs'
                  ? i.type === 'etf'
                  : true) &&
      `${i.symbol} ${i.name} ${i.exchange} ${i.currency} ${i.sector} ${i.providerSymbol ?? ''}`
        .toLowerCase()
        .includes(needle),
  );
  rows.sort((a, b) => {
    if (['Cripto', 'Coin100'].includes(category)) return a.marketCapRank! - b.marketCapRank!;
    const rank = (i: Instrument) =>
      needle && i.symbol.toLowerCase() === needle ? 0 : featured.has(i.id) ? 1 : 2;
    return rank(a) - rank(b) || a.symbol.localeCompare(b.symbol) || a.id.localeCompare(b.id);
  });
  const size = Math.max(1, Math.min(100, Math.floor(pageSize) || 50));
  const current = Math.min(
    Math.max(1, Math.floor(page) || 1),
    Math.max(1, Math.ceil(rows.length / size)),
  );
  return {
    instruments: rows.slice((current - 1) * size, current * size),
    total: rows.length,
    page: current,
    pageSize: size,
    counts: catalogCounts,
    dates: catalogDates,
  };
}
