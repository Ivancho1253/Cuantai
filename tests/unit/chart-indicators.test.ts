import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildChartIndicators } from '@/lib/finance/chart-indicators';
import { instruments } from '@/lib/market/catalog';
import { YahooProvider } from '@/lib/market/yahoo';
import type { Candle, Provenance } from '@/lib/market/types';

const today = Date.parse('2026-11-17T12:00:00Z');
const start = Date.parse('2026-08-01T00:00:00Z') / 1000;
const provenance: Provenance = {
  source: 'Test',
  url: '',
  asOf: '',
  retrievedAt: '',
  status: 'eod',
  delayMinutes: 0,
  adjusted: 'unadjusted',
};
const series = (n: number, price: (i: number) => number): Candle[] =>
  Array.from({ length: n }, (_, i) => ({
    time: start + i * 86400,
    open: price(i),
    high: price(i) + 1,
    low: price(i) - 1,
    close: price(i),
    volume: 100,
  }));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('daily chart readings', () => {
  it('distinguishes oversold, overbought and flat prices', () => {
    const up = buildChartIndicators(
      instruments[0],
      series(80, (i) => 10 + i * i),
      provenance,
      today,
    );
    const down = buildChartIndicators(
      instruments[0],
      series(80, (i) => 10000 - i * i),
      provenance,
      today,
    );
    const flat = buildChartIndicators(
      instruments[0],
      series(80, () => 100),
      provenance,
      today,
    );
    expect(up.rsi).toEqual({ value: 100, state: 'overbought' });
    expect(up.macd.state).toBe('bullish');
    expect(up.trend.state).toBe('bullish');
    expect(down.rsi).toEqual({ value: 0, state: 'oversold' });
    expect(down.macd.state).toBe('bearish');
    expect(down.trend.state).toBe('bearish');
    expect(flat.rsi).toEqual({ value: 50, state: 'neutral' });
    expect(flat.macd.histogram).toBe(0);
    expect(flat.macd.state).toBe('neutral');
    expect(flat.trend.state).toBe('neutral');
  });
  it('ignores the open daily candle, future and invalid candles, and orders the remaining history', () => {
    const closed = series(70, (i) => 100 + i);
    const open = {
      ...closed[0],
      time: Date.parse('2026-11-17T00:00:00Z') / 1000,
      close: 999999,
      high: 1000000,
    };
    const future = { ...open, time: open.time + 86400 };
    const invalid = { ...closed[0], high: 1 };
    const actual = buildChartIndicators(
      instruments[0],
      [...closed.slice().reverse(), closed[0], open, future, invalid],
      provenance,
      today,
    );
    const expected = buildChartIndicators(instruments[0], closed, provenance, today);
    expect(actual).toEqual(expected);
    expect(actual.sampleSize).toBe(70);
  });
  it('keeps unavailable metrics null and allows RSI before longer averages have enough sessions', () => {
    const none = buildChartIndicators(instruments[0], [], provenance, today);
    expect(none.rsi.value).toBeNull();
    expect(none.macd.histogram).toBeNull();
    expect(none.trend.ema50).toBeNull();
    expect(none.rsi.state).toBe('unavailable');
    const short = buildChartIndicators(
      instruments[0],
      series(16, (i) => 100 + i),
      provenance,
      today,
    );
    expect(short.rsi.value).toBe(100);
    expect(short.macd.histogram).toBeNull();
    expect(short.trend.state).toBe('unavailable');
  });
});

it('validates public historical instrument identity and drops incomplete candles', async () => {
  const fixture = (symbol: string, currency = 'USD') => ({
    chart: {
      result: [
        {
          meta: {
            symbol,
            currency,
            exchangeName: 'NMS',
            regularMarketPrice: 101,
            regularMarketTime: 1794888000,
            chartPreviousClose: 100,
          },
          timestamp: [1700000000, 1700086400, 1700172800],
          indicators: {
            quote: [
              {
                open: [100, null, 102],
                high: [102, 103, 104],
                low: [99, 100, 101],
                close: [101, 102, 103],
                volume: [1000, 1100, 1200],
              },
            ],
          },
        },
      ],
    },
  });
  const fetch = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(fixture('NVDA'))));
  vi.stubGlobal('fetch', fetch);
  const provider = new YahooProvider();
  const history = await provider.dailyHistory(instruments.find((i) => i.symbol === 'NVDA')!);
  expect(history.candles).toHaveLength(2);
  expect(history.candles.map((c) => c.close)).toEqual([101, 103]);
  expect(history.provenance.source).toContain('Yahoo');
  fetch.mockImplementation(async () => new Response(JSON.stringify(fixture('MSFT', 'ARS'))));
  await expect(
    provider.dailyHistory(instruments.find((i) => i.symbol === 'MSFT')!),
  ).rejects.toThrow('activo, mercado y moneda');
});

it('uses real chart history in a demo workspace and reserves sample readings for explicit fixtures', async () => {
  vi.resetModules();
  vi.stubEnv('MARKET_DATA_MODE', 'demo');
  vi.stubEnv('TWELVE_DATA_API_KEY', '');
  const { YahooProvider: PublicHistory } = await import('@/lib/market/yahoo');
  const history = vi
    .spyOn(PublicHistory.prototype, 'dailyHistory')
    .mockResolvedValue({
      candles: series(70, (i) => 100 + i),
      provenance: { ...provenance, status: 'delayed', delayMinutes: null, adjusted: 'unknown' },
    });
  const { chartIndicators } = await import('@/lib/market/service');
  const live = await chartIndicators('NASDAQ:NVDA:USD');
  expect(live.provenance.status).toBe('delayed');
  expect(live.sampleSize).toBe(70);
  expect(history).toHaveBeenCalledTimes(1);
  const fixture = await chartIndicators('NASDAQ:NVDA:USD', true);
  expect(fixture.provenance.status).toBe('demo');
  expect(history).toHaveBeenCalledTimes(1);
});
