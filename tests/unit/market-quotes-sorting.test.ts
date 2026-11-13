import { describe, it, expect, vi, afterEach } from 'vitest';
import { YahooProvider, yahooSymbol } from '@/lib/market/yahoo';
import { findDiscoveryInstrument } from '@/lib/market/discovery';
import { demoHistory } from '@/lib/market/demo';
import { sortMarketRows } from '@/lib/market/sorting';
import type { MarketSnapshot } from '@/lib/market/types';
afterEach(() => vi.unstubAllGlobals());
describe('public market quote identity', () => {
  it('uses local shares in ARS and declines unsupported USD certificates', () => {
    expect(yahooSymbol(findDiscoveryInstrument('BYMA:YPFD:ARS')!)).toBe('YPFD.BA');
    expect(() => yahooSymbol(findDiscoveryInstrument('BYMA:JPMD:USD')!)).toThrow();
  });
  it('preserves real price, previous close, volume and provider time', async () => {
    const i = findDiscoveryInstrument('BYMA:PAMP:ARS')!;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'PAMP.BA',
                    currency: 'ARS',
                    exchangeName: 'BUE',
                    regularMarketPrice: 3010,
                    chartPreviousClose: 3000,
                    regularMarketTime: 1794517200,
                    regularMarketVolume: 12000,
                  },
                },
              ],
            },
          }),
        ),
      ),
    );
    expect(await new YahooProvider().quote(i)).toMatchObject({
      instrumentId: i.id,
      currency: 'ARS',
      price: '3010',
      volume: '12000',
      status: 'delayed',
      asOf: '2026-11-12T21:00:00.000Z',
    });
  });
  it('rejects another market or currency without substituting a price', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            chart: {
              result: [
                {
                  meta: {
                    symbol: 'ALUA.BA',
                    currency: 'USD',
                    exchangeName: 'NYQ',
                    regularMarketPrice: 100,
                    chartPreviousClose: 90,
                    regularMarketTime: 1794517200,
                  },
                },
              ],
            },
          }),
        ),
      ),
    );
    await expect(
      new YahooProvider().quote(findDiscoveryInstrument('BYMA:ALUA:ARS')!),
    ).rejects.toThrow();
  });
  it('does not assign 100 or another generic price to catalog entries absent from the demo', () => {
    for (const id of ['NASDAQ:AMD:USD', 'BYMA:ALUA:ARS', 'COINGECKO:bitcoin:USD', 'BYMA:CIBR:ARS'])
      expect(demoHistory(findDiscoveryInstrument(id)!).quote).toBeNull();
  });
});
describe('market column ordering', () => {
  const row = (id: string, price: string | null, volume: string | null, change: string = '0') =>
    ({
      instrument: { id, symbol: id },
      quote: price === null ? null : { price, volume, changePercent: change },
    }) as MarketSnapshot;
  it('orders decimals numerically and retains missing values at the end in either direction', () => {
    const rows = [
      row('two', '2', '3'),
      row('ten', '10', null),
      row('missing', null, null),
      row('small', '0.000000001', '0'),
    ];
    expect(
      sortMarketRows(rows, { key: 'price', direction: 'asc' }).map((r) => r.instrument.id),
    ).toEqual(['small', 'two', 'ten', 'missing']);
    expect(
      sortMarketRows(rows, { key: 'price', direction: 'desc' }).map((r) => r.instrument.id),
    ).toEqual(['ten', 'two', 'small', 'missing']);
    expect(
      sortMarketRows(rows, { key: 'volume', direction: 'asc' }).map((r) => r.instrument.id),
    ).toEqual(['small', 'two', 'ten', 'missing']);
    expect(rows[0].instrument.id).toBe('two');
  });
  it('orders signed changes and high-precision crypto prices without rounding them away', () => {
    const rows = [
      row('a', '0.000000000000000012', '1', '-10'),
      row('b', '0.000000000000000011', '2', '2'),
    ];
    expect(sortMarketRows(rows, { key: 'change', direction: 'desc' })[0].instrument.id).toBe('b');
    expect(sortMarketRows(rows, { key: 'price', direction: 'asc' })[0].instrument.id).toBe('b');
  });
});

it('missing listings do not pause other symbols at the same provider', async () => {
  const { fetchJson } = await import('@/lib/market/transport');
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('{}', { status: 404 }))
    .mockResolvedValueOnce(new Response('{}', { status: 404 }))
    .mockResolvedValueOnce(new Response('{}', { status: 404 }))
    .mockResolvedValueOnce(new Response('{"price":25}'));
  vi.stubGlobal('fetch', fetcher);
  for (let n = 0; n < 3; n++)
    await expect(fetchJson(`https://missing-listing.test/${n}`)).rejects.toThrow('este activo');
  expect(await fetchJson('https://missing-listing.test/available')).toEqual({ price: 25 });
  expect(fetcher).toHaveBeenCalledTimes(4);
});
