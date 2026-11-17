import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

it('coalesces quote-only dashboard refreshes for ten seconds without downloading histories', async () => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubEnv('MARKET_DATA_MODE', 'live');
  vi.stubEnv('TWELVE_DATA_API_KEY', '');
  const { YahooProvider } = await import('@/lib/market/yahoo');
  const { BinanceProvider } = await import('@/lib/market/binance');
  const { dashboardBenchmarks } = await import('@/lib/market/service');
  const quote = {
    price: '563.92',
    changePercent: '1.2',
    volume: '100',
    currency: 'USD' as const,
    instrumentId: 'fixture',
    source: 'Test provider',
    url: '',
    asOf: new Date().toISOString(),
    retrievedAt: new Date().toISOString(),
    status: 'delayed' as const,
    delayMinutes: null,
    adjusted: 'unknown' as const,
  };
  const yahoo = vi.spyOn(YahooProvider.prototype, 'quote').mockResolvedValue(quote);
  const binance = vi
    .spyOn(BinanceProvider.prototype, 'quote')
    .mockResolvedValue({
      ...quote,
      currency: 'USDT',
      status: 'realtime',
      delayMinutes: 0,
      adjusted: 'unadjusted',
    });
  const yahooHistory = vi.spyOn(YahooProvider.prototype, 'history');
  const binanceHistory = vi.spyOn(BinanceProvider.prototype, 'history');
  const [first, simultaneous] = await Promise.all([dashboardBenchmarks(), dashboardBenchmarks()]);
  expect(first).toEqual(simultaneous);
  expect(first).toHaveLength(4);
  expect(yahoo).toHaveBeenCalledTimes(3);
  expect(binance).toHaveBeenCalledTimes(1);
  expect(yahoo.mock.calls.every((call) => call[1] === 10000)).toBe(true);
  await vi.advanceTimersByTimeAsync(10001);
  yahoo.mockRejectedValue(new Error('Provider unavailable'));
  const refreshed = await dashboardBenchmarks();
  expect(yahoo).toHaveBeenCalledTimes(6);
  expect(binance).toHaveBeenCalledTimes(2);
  expect(refreshed[0].quote).toBeNull();
  expect(refreshed[0].provenance.status).toBe('unavailable');
  expect(refreshed[3].quote?.price).toBe('563.92');
  expect(yahooHistory).not.toHaveBeenCalled();
  expect(binanceHistory).not.toHaveBeenCalled();
});

it('keeps explicit demo quotes stable across refreshes', async () => {
  const { dashboardBenchmarks } = await import('@/lib/market/service');
  const first = await dashboardBenchmarks(true);
  const second = await dashboardBenchmarks(true);
  expect(second.map((row) => row.quote?.price)).toEqual(first.map((row) => row.quote?.price));
  expect(first.every((row) => row.quote?.status === 'demo' && row.candles.length === 0)).toBe(true);
});
