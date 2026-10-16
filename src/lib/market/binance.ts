import { z } from 'zod';
import {
  candleSchema,
  positiveDecimalSchema,
  signedDecimalSchema,
  volumeDecimalSchema,
  type HistoricalDataProvider,
  type Instrument,
  type InstrumentSearchProvider,
  type QuoteProvider,
  type Timeframe,
} from './types';
import { fetchJson, cached } from './transport';
const base = 'https://data-api.binance.vision/api/v3/';
const interval: Record<Timeframe, string> = {
  '1m': '1m',
  '5m': '5m',
  '15m': '15m',
  '30m': '30m',
  '1h': '1h',
  '4h': '4h',
  '1D': '1d',
  '1W': '1w',
  '1M': '1M',
};
export class BinanceProvider
  implements QuoteProvider, HistoricalDataProvider, InstrumentSearchProvider
{
  async search(query: string) {
    const data = await cached('binance:instruments', 3600000, async () =>
      z
        .object({
          symbols: z.array(
            z.object({
              symbol: z.string(),
              baseAsset: z.string(),
              quoteAsset: z.string(),
              status: z.string(),
            }),
          ),
        })
        .parse(await fetchJson(`${base}exchangeInfo`)),
    );
    return data.symbols
      .filter(
        (s) =>
          s.status === 'TRADING' &&
          s.quoteAsset === 'USDT' &&
          s.symbol.includes(query.toUpperCase()),
      )
      .slice(0, 30)
      .map((s) => ({
        id: `BINANCE:${s.symbol}:USDT`,
        symbol: s.symbol,
        name: `${s.baseAsset} / Tether`,
        exchange: 'BINANCE',
        currency: 'USDT' as const,
        type: 'crypto' as const,
        country: 'Global',
        sector: 'Crypto',
        color: '#b69aee',
        source: 'Binance exchangeInfo',
      }));
  }
  async quote(i: Instrument) {
    const url = new URL(`${base}ticker/24hr`);
    url.searchParams.set('symbol', i.symbol);
    const d = z
      .object({
        lastPrice: positiveDecimalSchema,
        priceChangePercent: signedDecimalSchema,
        volume: volumeDecimalSchema,
        closeTime: z.number(),
      })
      .parse(await fetchJson(url));
    return {
      instrumentId: i.id,
      currency: i.currency,
      price: d.lastPrice,
      changePercent: d.priceChangePercent,
      volume: d.volume,
      source: 'Binance Spot · rolling 24h',
      url: 'https://www.binance.com/en/trade/' + i.symbol.replace('USDT', '_USDT'),
      asOf: new Date(d.closeTime).toISOString(),
      retrievedAt: new Date().toISOString(),
      status: 'realtime' as const,
      delayMinutes: 0,
      adjusted: 'unadjusted' as const,
    };
  }
  async history(i: Instrument, tf: Timeframe) {
    const url = new URL(`${base}klines`);
    url.searchParams.set('symbol', i.symbol);
    url.searchParams.set('interval', interval[tf]);
    url.searchParams.set('limit', '500');
    const raw = z.array(z.array(z.union([z.string(), z.number()]))).parse(await fetchJson(url));
    const candles = raw.map((c) =>
      candleSchema.parse({
        time: Math.floor(Number(c[0]) / 1000),
        open: Number(c[1]),
        high: Number(c[2]),
        low: Number(c[3]),
        close: Number(c[4]),
        volume: Number(c[5]),
      }),
    );
    return {
      candles,
      provenance: {
        source: 'Binance Spot OHLCV',
        url: 'https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints',
        asOf: new Date(Number(raw.at(-1)?.[0] ?? Date.now())).toISOString(),
        retrievedAt: new Date().toISOString(),
        status: 'realtime' as const,
        delayMinutes: 0,
        adjusted: 'unadjusted' as const,
      },
    };
  }
}
