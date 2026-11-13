import { z } from 'zod';
import Decimal from 'decimal.js';
import { cached, fetchJson } from './transport';
import {
  ProviderError,
  type Candle,
  type Instrument,
  type Provenance,
  type Quote,
  type Timeframe,
} from './types';

const headers = () =>
  process.env.COINGECKO_API_KEY
    ? { 'x-cg-demo-api-key': process.env.COINGECKO_API_KEY }
    : undefined;
const quoteValue = z.object({
  usd: z.number().positive(),
  usd_24h_change: z.number(),
  last_updated_at: z.number().positive(),
  usd_24h_vol: z.number().nonnegative().nullable().optional(),
});
export class CoinGeckoProvider {
  async quotes(instruments: Instrument[]): Promise<Map<string, Quote>> {
    if (!instruments.length) return new Map();
    const ids = [...new Set(instruments.map((i) => i.providerSymbol!))].sort();
    return cached(`coingecko:quotes:${ids.join(',')}`, 60000, async () => {
      const url = new URL('https://api.coingecko.com/api/v3/simple/price');
      url.search = new URLSearchParams({
        ids: ids.join(','),
        vs_currencies: 'usd',
        include_24hr_change: 'true',
        include_24hr_vol: 'true',
        include_last_updated_at: 'true',
      }).toString();
      const data = z.record(z.string(), z.unknown()).parse(await fetchJson(url, headers()));
      const quotes = new Map<string, Quote>();
      for (const instrument of instruments) {
        const parsed = quoteValue.safeParse(data[instrument.providerSymbol!]);
        // An absent price, change or timestamp is unavailable, never an invented zero.
        if (!parsed.success) continue;
        const value = parsed.data;
        quotes.set(instrument.id, {
          instrumentId: instrument.id,
          currency: 'USD',
          price: new Decimal(value.usd).toFixed(),
          changePercent: new Decimal(value.usd_24h_change).toFixed(),
          volume: value.usd_24h_vol == null ? null : new Decimal(value.usd_24h_vol).toFixed(),
          volumeUnit: 'USD',
          source: 'CoinGecko aggregate · rolling 24h',
          url: `https://www.coingecko.com/en/coins/${encodeURIComponent(instrument.providerSymbol!)}`,
          asOf: new Date(value.last_updated_at * 1000).toISOString(),
          retrievedAt: new Date().toISOString(),
          status: 'delayed',
          delayMinutes: null,
          adjusted: 'unadjusted',
          stale: Date.now() - value.last_updated_at * 1000 > 180000,
        });
      }
      return quotes;
    });
  }
  async quote(instrument: Instrument) {
    const quote = (await this.quotes([instrument])).get(instrument.id);
    if (!quote)
      throw new ProviderError('CoinGecko no tiene una cotización disponible para esta moneda.');
    return quote;
  }
  async history(
    instrument: Instrument,
    timeframe: Timeframe,
  ): Promise<{ candles: Candle[]; provenance: Provenance }> {
    throw new ProviderError(
      `Historial OHLCV ${timeframe} no disponible para ${instrument.name} en CoinGecko. Su cotización se consulta por separado.`,
    );
  }
}
