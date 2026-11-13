import sp500 from './data/sp500.json';
import crypto from './data/crypto.json';
import cedearData from './data/cedears.json';
import argentinaData from './data/argentina.json';
import etfData from './data/etfs.json';
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
const listedEtfs: Instrument[] = etfData.entries.map((entry) => ({
  id: `${entry.exchange}:${entry.symbol}:USD`,
  exchange: entry.exchange,
  symbol: entry.symbol,
  name: entry.name,
  currency: 'USD',
  type: 'etf',
  country: 'US',
  sector: 'ETF',
  color: '#91bca7',
  source: 'Nasdaq Trader · US ETF symbol directories',
}));
const argentinaStocks: Instrument[] = argentinaData.entries.map((entry) => ({
  id: `BYMA:${entry.symbol}:ARS`,
  exchange: 'BYMA',
  symbol: entry.symbol,
  name: entry.name,
  currency: 'ARS',
  type: 'stock',
  country: 'AR',
  sector: entry.sector,
  color: '#8fc0e8',
  isin: entry.isin,
  source: `BYMA · empresas listadas · ${argentinaData.asOf}`,
  ...('index' in entry ? { indexMembership: entry.index } : {}),
  ...('liquidityRank' in entry
    ? {
        liquidityRank: entry.liquidityRank,
        liquidityAdtvARS: entry.adtv40ARS,
        liquidityAsOf: argentinaData.asOf,
      }
    : {}),
}));
const knownIssuers = [...stocks, ...instruments, ...listedEtfs].filter(
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
    [...stocks, ...coins, ...certificates, ...instruments, ...argentinaStocks, ...listedEtfs].map(
      (instrument) => [instrument.id, instrument],
    ),
  ).values(),
];
const byId = new Map(catalog.map((instrument) => [instrument.id, instrument]));
const coin100Ids = new Set(coins.map((instrument) => instrument.id));
const listedEtfIds = new Set(listedEtfs.map((i) => i.id));
const primaryEtfBySymbol = new Map(listedEtfs.map((i) => [i.symbol, i]));
export const findPrimaryEtf = (symbol: string) => primaryEtfBySymbol.get(symbol);
const visibleCatalog = catalog.filter(
  (i) =>
    (i.type !== 'crypto' || coin100Ids.has(i.id)) && (i.type !== 'etf' || listedEtfIds.has(i.id)),
);
const sp500Ids = new Set(stocks.map((instrument) => instrument.id));
const featured = new Set(instruments.map((instrument) => instrument.id));
const featuredEtfs = new Map(
  [
    'SPY',
    'QQQ',
    'DIA',
    'VOO',
    'IVV',
    'VTI',
    'VEA',
    'VWO',
    'BND',
    'AGG',
    'TLT',
    'GLD',
    'SLV',
    'SGOV',
    'SCHD',
    'IWM',
    'HYG',
    'LQD',
    'XLK',
    'XLF',
    'ARKK',
    'IBIT',
  ].map((symbol, index) => [symbol, index]),
);
export const catalogCounts = {
  argentina: argentinaStocks.length,
  argentinaRanked: argentinaData.rankedCount,
  argentinaMerval: argentinaStocks.filter((i) => i.indexMembership === 'MSCI Merval').length,
  sp500: stocks.length,
  crypto: coins.length,
  etfs: listedEtfs.length,
  cedears: certificates.length,
  cedearListings: visibleCatalog.filter((i) => i.type === 'cedear').length,
  total: visibleCatalog.filter((i) => i.type !== 'cash').length,
};
export const catalogDates = {
  argentina: argentinaData.asOf,
  sp500: sp500.asOf,
  crypto: crypto.retrievedAt,
  etfs: etfData.retrievedAt,
  cedears: cedearData.asOf,
};
export const findDiscoveryInstrument = (id: string) => byId.get(id);
export const findDiscoveryListing = (exchange: string, symbol: string) =>
  catalog.find((i) => i.exchange === exchange && (i.providerSymbol ?? i.symbol) === symbol);

function matchesCategory(instrument: Instrument, category: string) {
  switch (category) {
    case 'Acciones USA':
      return instrument.type === 'stock' && instrument.country === 'US';
    case 'Acciones ARG':
      return instrument.type === 'stock' && instrument.country === 'AR';
    case 'Cedears ARG':
    case 'CEDEARs':
      return instrument.type === 'cedear';
    case 'ETFs':
      return instrument.type === 'etf';
    case 'Crypto':
    case 'Cripto':
    case 'Coin100':
      return coin100Ids.has(instrument.id);
    case 'S&P 500':
      return sp500Ids.has(instrument.id);
    case 'Estados Unidos':
      return instrument.country === 'US';
    case 'Argentina':
      return instrument.country === 'AR';
    default:
      return true;
  }
}

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
      matchesCategory(i, category) &&
      `${i.symbol} ${i.name} ${i.exchange} ${i.currency} ${i.sector} ${i.providerSymbol ?? ''} ${i.indexMembership ?? ''}`
        .toLowerCase()
        .includes(needle),
  );
  rows.sort((a, b) => {
    if (category === 'Acciones ARG') {
      const exact = (i: Instrument) => (needle && i.symbol.toLowerCase() === needle ? 0 : 1);
      return (
        exact(a) - exact(b) ||
        (a.liquidityRank ?? 100000) - (b.liquidityRank ?? 100000) ||
        a.symbol.localeCompare(b.symbol)
      );
    }
    if (['Crypto', 'Cripto', 'Coin100'].includes(category))
      return a.marketCapRank! - b.marketCapRank!;
    if (category === 'ETFs') {
      const rank = (i: Instrument) =>
        needle && i.symbol.toLowerCase() === needle ? -1 : (featuredEtfs.get(i.symbol) ?? 10000);
      return rank(a) - rank(b) || a.symbol.localeCompare(b.symbol);
    }
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
