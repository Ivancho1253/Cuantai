import { afterEach, describe, expect, it, vi } from 'vitest';
import { BinanceProvider } from '@/lib/market/binance';
import { BymaProvider, bymaExportSchema } from '@/lib/market/byma';
import { TwelveDataProvider } from '@/lib/market/twelve-data';
import { instruments } from '@/lib/market/catalog';
import { marketSnapshot } from '@/lib/market/service';
import { cached, fetchJson } from '@/lib/market/transport';
import { demoHistory } from '@/lib/market/demo';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('provider boundaries', () => {
  it('never creates demo prices after a live provider failure', async () => {
    vi.stubEnv('MARKET_DATA_MODE', 'live');
    vi.stubEnv('TWELVE_DATA_API_KEY', '');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    const snapshot = await marketSnapshot('NASDAQ:MSFT:USD', '1W');
    expect(snapshot.quote).toBeNull();
    expect(snapshot.candles).toEqual([]);
    expect(snapshot.provenance.status).toBe('unavailable');
    expect(snapshot.error).toContain('cotización verificable');
  });
  it('retains demo provenance and reproducible fixture timestamps', () => {
    const first = demoHistory(instruments[0]),
      second = demoHistory(instruments[0]);
    expect(first).toEqual(second);
    expect(first.quote?.status).toBe('demo');
    expect(new Set(first.candles.map((c) => c.time)).size).toBe(first.candles.length);
  });
  it('rejects unconfigured BYMA access', async () => {
    vi.stubEnv('BYMA_AUTHORIZED_DATA_FILE', '');
    await expect(
      new BymaProvider().quote(instruments.find((i) => i.exchange === 'BYMA')!),
    ).rejects.toThrow('feed autorizado');
  });
  it('validates authorized exports and OHLC integrity', () => {
    expect(bymaExportSchema.safeParse({ source: 'bad' }).success).toBe(false);
    const c = { time: 1700000000, open: 10, high: 5, low: 8, close: 11, volume: 100 };
    expect(
      bymaExportSchema.safeParse({
        source: 'Licensed',
        sourceUrl: 'https://example.com',
        retrievedAt: '2025-01-01T00:00:00Z',
        status: 'eod',
        delayMinutes: null,
        quotes: [],
        histories: [
          { instrumentId: 'BYMA:JPM:ARS', timeframe: '1D', adjusted: 'unknown', candles: [c] },
        ],
      }).success,
    ).toBe(false);
  });
  it('requires configured US credentials', async () => {
    vi.stubEnv('TWELVE_DATA_API_KEY', '');
    await expect(new TwelveDataProvider().quote(instruments[0])).rejects.toThrow(
      'TWELVE_DATA_API_KEY',
    );
  });
  it('normalizes Binance OHLCV with exact interval requests', async () => {
    const mock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([[1700000000000, '10', '12', '9', '11', '100']]), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', mock);
    const result = await new BinanceProvider().history(
      instruments.find((i) => i.symbol === 'BTCUSDT')!,
      '4h',
    );
    expect(result.candles[0]).toEqual({
      time: 1700000000,
      open: 10,
      high: 12,
      low: 9,
      close: 11,
      volume: 100,
    });
    expect(String(mock.mock.calls[0][0])).toContain('interval=4h');
    expect(result.provenance.status).toBe('realtime');
  });
  it('deduplicates concurrent loads and retries only after a failed load', async () => {
    const load = vi.fn().mockResolvedValue({ ok: true });
    await Promise.all([cached('unit:dedup', 10000, load), cached('unit:dedup', 10000, load)]);
    expect(load).toHaveBeenCalledTimes(1);
    const fail = vi.fn().mockRejectedValueOnce(new Error('down')).mockResolvedValue('up');
    await expect(cached('unit:retry', 10000, fail)).rejects.toThrow();
    expect(await cached('unit:retry', 10000, fail)).toBe('up');
  });
  it('does not retry exhausted provider quota', async () => {
    const mock = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', mock);
    await expect(fetchJson('https://quota.example.com')).rejects.toThrow('Cuota');
    expect(mock).toHaveBeenCalledTimes(1);
  });
  it('counts provider access budgets on every HTTP attempt, including a retry', async () => {
    const budget = vi.fn().mockResolvedValue(undefined);
    const mock = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('{"ok":true}'));
    vi.stubGlobal('fetch', mock);
    expect(await fetchJson('https://retry-budget.example.test', undefined, budget)).toEqual({
      ok: true,
    });
    expect(budget).toHaveBeenCalledTimes(2);
    expect(mock).toHaveBeenCalledTimes(2);
  });
});

describe('cash instrument boundary', () => {
  it('never generates synthetic security prices for cash balances', async () => {
    const snapshot = await marketSnapshot('CASH:USD:USD', '1D', true);
    expect(snapshot.candles).toEqual([]);
    expect(snapshot.quote).toBeNull();
    expect(snapshot.error).toContain('saldo');
  });
});

describe('invalid provider prices', () => {
  it('rejects a malformed live price instead of converting it to zero', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            lastPrice: 'NaN',
            priceChangePercent: '1',
            volume: '100',
            closeTime: 1700000000000,
          }),
          { status: 200 },
        ),
      ),
    );
    await expect(
      new BinanceProvider().quote(instruments.find((i) => i.symbol === 'ETHUSDT')!),
    ).rejects.toThrow();
  });
});
