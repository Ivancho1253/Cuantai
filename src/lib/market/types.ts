import { z } from 'zod';
import Decimal from 'decimal.js';
export const positiveDecimalSchema = z
  .string()
  .max(100)
  .regex(/^\d+(\.\d+)?$/)
  .refine((value) => new Decimal(value).gt(0), 'Price must be positive');
export const signedDecimalSchema = z
  .string()
  .max(100)
  .regex(/^[+-]?\d+(\.\d+)?$/);
export const volumeDecimalSchema = z
  .string()
  .max(100)
  .regex(/^\d+(\.\d+)?$/);
export const currencies = ['USD', 'ARS', 'USDT', 'EUR'] as const;
export type Currency = (typeof currencies)[number];
export type Instrument = {
  id: string;
  symbol: string;
  name: string;
  exchange: string;
  currency: Currency;
  type: 'stock' | 'etf' | 'crypto' | 'cedear' | 'index' | 'cash';
  country: string;
  sector: string;
  color: string;
  underlyingId?: string;
  providerSymbol?: string;
  source: string;
};
export const timeframes = ['1m', '5m', '15m', '30m', '1h', '4h', '1D', '1W', '1M'] as const;
export type Timeframe = (typeof timeframes)[number];
export const candleSchema = z
  .object({
    time: z.number().int().positive(),
    open: z.number().positive(),
    high: z.number().positive(),
    low: z.number().positive(),
    close: z.number().positive(),
    volume: z.number().nonnegative(),
  })
  .refine(
    (c) => c.high >= Math.max(c.open, c.close, c.low) && c.low <= Math.min(c.open, c.close),
    'Invalid OHLC',
  );
export type Candle = z.infer<typeof candleSchema>;
export type Provenance = {
  source: string;
  url: string;
  asOf: string;
  retrievedAt: string;
  status: 'demo' | 'realtime' | 'delayed' | 'eod' | 'manual' | 'unavailable';
  delayMinutes: number | null;
  adjusted: 'split' | 'unadjusted' | 'unknown';
  stale?: boolean;
};
export type Quote = Provenance & {
  instrumentId: string;
  currency: Currency;
  price: string;
  changePercent: string;
  volume: string | null;
};
export type MarketSnapshot = {
  instrument: Instrument;
  quote: Quote | null;
  candles: Candle[];
  provenance: Provenance;
  error?: string;
  timeframe: Timeframe;
};
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  category: string;
  summary?: string;
};
export type Fundamental = { label: string; value: string | null; unit?: string; period?: string };
export interface InstrumentSearchProvider {
  search(query: string): Promise<Instrument[]>;
}
export interface QuoteProvider {
  quote(instrument: Instrument): Promise<Quote>;
}
export interface HistoricalDataProvider {
  history(
    instrument: Instrument,
    timeframe: Timeframe,
  ): Promise<{ candles: Candle[]; provenance: Provenance }>;
}
export interface FundamentalsProvider {
  fundamentals(instrument: Instrument): Promise<{ metrics: Fundamental[]; provenance: Provenance }>;
}
export interface NewsProvider {
  news(instrument?: Instrument): Promise<NewsItem[]>;
}
export interface CorporateActionsProvider {
  actions(
    instrument: Instrument,
  ): Promise<{ type: 'split' | 'dividend'; date: string; value: string; source: string }[]>;
}
export interface ExchangeRateProvider {
  rate(
    from: Currency,
    to: Currency,
    date: string,
    kind: string,
  ): Promise<{ rate: string; provenance: Provenance }>;
}
export class ProviderError extends Error {
  constructor(
    message: string,
    public code = 'UNAVAILABLE',
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}
