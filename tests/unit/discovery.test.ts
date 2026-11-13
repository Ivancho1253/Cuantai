import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discoverInstruments,
  catalogCounts,
  findDiscoveryInstrument,
  findDiscoveryListing,
} from '@/lib/market/discovery';
import { CoinGeckoProvider } from '@/lib/market/coingecko';
import { assetHref } from '@/lib/market/asset-href';
import { marketListings } from '@/lib/market/service';
import cedears from '@/lib/market/data/cedears.json';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('complete discovery catalog', () => {
  it('exposes the entire S&P snapshot through disjoint pages, with listing exchanges', () => {
    const ids: string[] = [];
    for (let page = 1; page <= Math.ceil(catalogCounts.sp500 / 100); page++) {
      const result = discoverInstruments({ category: 'S&P 500', page, pageSize: 100 });
      expect(result.total).toBe(catalogCounts.sp500);
      expect(
        result.instruments.every(
          (i) =>
            i.type === 'stock' &&
            i.currency === 'USD' &&
            ['NYSE', 'NASDAQ', 'CBOE'].includes(i.exchange),
        ),
      ).toBe(true);
      ids.push(...result.instruments.map((i) => i.id));
    }
    expect(ids.length).toBeGreaterThanOrEqual(500);
    expect(new Set(ids).size).toBe(ids.length);
    expect(findDiscoveryInstrument('NASDAQ:AMD:USD')).toBeDefined();
    expect(
      findDiscoveryInstrument('NYSE:WMT:USD') ?? findDiscoveryInstrument('NASDAQ:WMT:USD'),
    ).toBeDefined();
  });
  it('exposes exactly the top 100 in market-cap rank order without duplicate Binance pairs', () => {
    expect(catalogCounts.crypto).toBe(100);
    const ranked = discoverInstruments({ category: 'Coin100', pageSize: 100 });
    expect(ranked.total).toBe(100);
    expect(ranked.instruments.map((i) => i.marketCapRank)).toEqual(
      Array.from({ length: 100 }, (_, index) => index + 1),
    );
    expect(ranked.instruments.every((i) => i.exchange === 'COINGECKO')).toBe(true);
    expect(new Set(ranked.instruments.map((i) => i.id)).size).toBe(100);
    expect(findDiscoveryInstrument('BINANCE:BTCUSDT:USDT')).toBeDefined();
    const coin = ranked.instruments.at(-1)!;
    const found = discoverInstruments({ query: coin.providerSymbol, category: 'Cripto' });
    expect(found.instruments.map((i) => i.id)).toContain(coin.id);
    const doge = discoverInstruments({ query: 'DOGE', category: 'Cripto' });
    expect(doge.instruments[0].symbol).toBe('DOGE');
    expect(doge.instruments.some((i) => i.providerSymbol === 'dogecoin')).toBe(true);
  });
  it('includes every official CEDEAR program and retains existing dollar listings', () => {
    expect(catalogCounts.cedears).toBe(cedears.entries.length);
    expect(catalogCounts.cedears).toBeGreaterThan(400);
    for (const entry of cedears.entries) {
      expect(findDiscoveryInstrument(`BYMA:${entry.symbol}:ARS`)).toMatchObject({
        type: 'cedear',
        currency: 'ARS',
        exchange: 'BYMA',
        symbol: entry.symbol,
      });
    }
    const ids: string[] = [];
    for (let page = 1; page <= Math.ceil(catalogCounts.cedearListings / 100); page++) {
      const result = discoverInstruments({ category: 'CEDEARs', pageSize: 100, page });
      expect(result.instruments.every((i) => i.type === 'cedear')).toBe(true);
      ids.push(...result.instruments.map((i) => i.id));
    }
    expect(new Set(ids).size).toBe(catalogCounts.cedearListings);
    expect(ids).toContain('BYMA:JPMD:USD');
    expect(ids).toContain('BYMA:AAPLD:USD');
    expect(findDiscoveryInstrument('BYMA:XLU:ARS')).toMatchObject({
      cedearKind: 'etf',
      cedearRatio: '15:1',
    });
    expect(findDiscoveryInstrument('BYMA:CIBR:ARS')).toMatchObject({
      cedearKind: 'etf',
      cedearRatio: '10:1',
    });
    expect(findDiscoveryInstrument('BYMA:NVDA:ARS')?.underlyingId).toBe('NASDAQ:NVDA:USD');
    expect(findDiscoveryInstrument('BYMA:ADGO:ARS')?.underlyingId).toBeUndefined();
  });
  it('uses provider IDs in routes so identically named tickers are independent', () => {
    const coin = findDiscoveryInstrument('COINGECKO:dogecoin:USD')!;
    expect(assetHref(coin, true)).toBe('/asset/COINGECKO/dogecoin?demo=true');
    expect(findDiscoveryListing('COINGECKO', 'dogecoin')?.id).toBe(coin.id);
    expect(discoverInstruments({ category: 'S&P 500', page: 1000 }).page).toBe(
      Math.ceil(catalogCounts.sp500 / 50),
    );
  });
  it('keeps unavailable live stocks visible and never substitutes demo prices', async () => {
    vi.stubEnv('MARKET_DATA_MODE', 'live');
    vi.stubEnv('TWELVE_DATA_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    const result = await marketListings({ query: 'AMD', category: 'S&P 500' });
    expect(result.rows[0].instrument.symbol).toBe('AMD');
    expect(result.rows[0].quote).toBeNull();
    expect(result.rows[0].provenance.status).toBe('unavailable');
  });
});

describe('CoinGecko quote boundaries', () => {
  it('batches coin IDs and preserves very small prices as decimals', async () => {
    const doge = findDiscoveryInstrument('COINGECKO:dogecoin:USD')!;
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          dogecoin: { usd: 0.000000000123, usd_24h_change: -2.5, last_updated_at: 1794270000 },
        }),
      ),
    );
    vi.stubGlobal('fetch', fetch);
    const quote = await new CoinGeckoProvider().quote(doge);
    expect(quote.price).toBe('0.000000000123');
    expect(quote.changePercent).toBe('-2.5');
    expect(quote.status).toBe('delayed');
    expect(quote.volume).toBeNull();
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get('ids')).toBe('dogecoin');
  });
  it('does not manufacture missing prices or OHLCV history', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    const bitcoin = findDiscoveryInstrument('COINGECKO:bitcoin:USD')!;
    await expect(new CoinGeckoProvider().quote(bitcoin)).rejects.toThrow('no tiene una cotización');
    await expect(new CoinGeckoProvider().history(bitcoin, '1D')).rejects.toThrow('no disponible');
  });
  it('retains valid quotes when another coin in the batch has no usable price', async () => {
    const eth = findDiscoveryInstrument('COINGECKO:ethereum:USD')!;
    const ada = findDiscoveryInstrument('COINGECKO:cardano:USD')!;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ethereum: { usd: 2000, usd_24h_change: 0, last_updated_at: 1794270000 },
            cardano: { usd: null, usd_24h_change: null, last_updated_at: 0 },
          }),
        ),
      ),
    );
    const quotes = await new CoinGeckoProvider().quotes([eth, ada]);
    expect(quotes.get(eth.id)?.changePercent).toBe('0');
    expect(quotes.has(ada.id)).toBe(false);
  });
});
