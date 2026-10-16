import { z } from 'zod';
import {
  candleSchema,
  positiveDecimalSchema,
  signedDecimalSchema,
  volumeDecimalSchema,
  ProviderError,
  type HistoricalDataProvider,
  type Instrument,
  type InstrumentSearchProvider,
  type QuoteProvider,
  type Timeframe,
} from './types';
import { fetchJson } from './transport';
import { rateLimit } from '../security';
const intervals: Record<Timeframe, string> = {
  '1m': '1min',
  '5m': '5min',
  '15m': '15min',
  '30m': '30min',
  '1h': '1h',
  '4h': '4h',
  '1D': '1day',
  '1W': '1week',
  '1M': '1month',
};
export class TwelveDataProvider
  implements QuoteProvider, HistoricalDataProvider, InstrumentSearchProvider
{
  private async get(endpoint: string, params: Record<string, string>) {
    if (!process.env.TWELVE_DATA_API_KEY)
      throw new ProviderError(
        'Configurá TWELVE_DATA_API_KEY para habilitar acciones y ETFs.',
        'CREDENTIALS',
      );
    await rateLimit(
      'provider:twelve-data',
      Number(process.env.TWELVE_DATA_REQUESTS_PER_MINUTE ?? 8),
      60,
    );
    const url = new URL(`https://api.twelvedata.com/${endpoint}`);
    for (const [k, v] of Object.entries({ ...params, apikey: process.env.TWELVE_DATA_API_KEY }))
      url.searchParams.set(k, v);
    const data = await fetchJson(url);
    if (z.object({ status: z.literal('error') }).safeParse(data).success)
      throw new ProviderError(
        'Twelve Data no pudo servir este instrumento. Revisá cobertura y cuota.',
      );
    return data;
  }
  async search(query: string) {
    const d = z
      .object({
        data: z.array(
          z.object({
            symbol: z.string(),
            instrument_name: z.string(),
            exchange: z.string(),
            currency: z.string().optional(),
            country: z.string().optional(),
            instrument_type: z.string().optional(),
          }),
        ),
      })
      .parse(await this.get('symbol_search', { symbol: query, outputsize: '30' }));
    return d.data
      .filter((i) => i.currency === 'USD' && ['NASDAQ', 'NYSE'].includes(i.exchange))
      .map((i) => ({
        id: `${i.exchange}:${i.symbol}:USD`,
        symbol: i.symbol,
        name: i.instrument_name,
        exchange: i.exchange,
        currency: 'USD' as const,
        type: i.instrument_type === 'ETF' ? ('etf' as const) : ('stock' as const),
        country: 'US',
        sector: 'Unknown',
        color: '#94a2bd',
        source: 'Twelve Data symbol_search',
      }));
  }
  async quote(i: Instrument) {
    const d = z
      .object({
        close: positiveDecimalSchema,
        percent_change: signedDecimalSchema,
        volume: volumeDecimalSchema.optional(),
        timestamp: z.number(),
        currency: z.string().optional(),
        is_market_open: z.boolean().optional(),
      })
      .parse(
        await this.get('quote', { symbol: i.providerSymbol ?? i.symbol, exchange: i.exchange }),
      );
    if (d.currency && d.currency !== i.currency)
      throw new ProviderError('Moneda de cotización incompatible.');
    return {
      instrumentId: i.id,
      currency: i.currency,
      price: d.close,
      changePercent: d.percent_change,
      volume: d.volume ?? null,
      source: 'Twelve Data',
      url: 'https://twelvedata.com/',
      asOf: new Date(d.timestamp * 1000).toISOString(),
      retrievedAt: new Date().toISOString(),
      status: d.is_market_open ? ('delayed' as const) : ('eod' as const),
      delayMinutes: process.env.TWELVE_DATA_DELAY_MINUTES
        ? Number(process.env.TWELVE_DATA_DELAY_MINUTES)
        : null,
      adjusted: 'unknown' as const,
    };
  }
  async history(i: Instrument, tf: Timeframe) {
    const d = z
      .object({
        values: z.array(
          z.object({
            datetime: z.string(),
            open: z.string(),
            high: z.string(),
            low: z.string(),
            close: z.string(),
            volume: z.string().optional(),
          }),
        ),
      })
      .parse(
        await this.get('time_series', {
          symbol: i.providerSymbol ?? i.symbol,
          exchange: i.exchange,
          interval: intervals[tf],
          outputsize: '500',
          timezone: 'UTC',
          order: 'ASC',
          adjust: 'splits',
        }),
      );
    const candles = d.values
      .map((c) =>
        candleSchema.parse({
          time: Math.floor(
            new Date(
              c.datetime.length === 10
                ? `${c.datetime}T00:00:00Z`
                : `${c.datetime.replace(' ', 'T')}Z`,
            ).getTime() / 1000,
          ),
          open: Number(c.open),
          high: Number(c.high),
          low: Number(c.low),
          close: Number(c.close),
          volume: Number(c.volume ?? 0),
        }),
      )
      .sort((a, b) => a.time - b.time);
    return {
      candles,
      provenance: {
        source: 'Twelve Data · split-adjusted',
        url: 'https://twelvedata.com/',
        asOf: new Date((candles.at(-1)?.time ?? 0) * 1000).toISOString(),
        retrievedAt: new Date().toISOString(),
        status: 'delayed' as const,
        delayMinutes: null,
        adjusted: 'split' as const,
      },
    };
  }
}
