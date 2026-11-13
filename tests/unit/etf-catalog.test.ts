import { describe, it, expect } from 'vitest';
import {
  discoverInstruments,
  catalogCounts,
  findDiscoveryInstrument,
  findPrimaryEtf,
} from '@/lib/market/discovery';
import { resolveInstrument } from '@/lib/market/service';
import { tradingViewSymbol } from '@/lib/market/tradingview';
import { yahooSymbol } from '@/lib/market/yahoo';
import snapshot from '@/lib/market/data/etfs.json';
describe('US ETF directory', () => {
  it('contains the complete source snapshot with pagination and unique primary listings', () => {
    const seen = new Set<string>(),
      symbols = new Set<string>();
    expect(snapshot.entries.length).toBeGreaterThan(1000);
    for (let page = 1; page <= Math.ceil(snapshot.entries.length / 100); page++) {
      const result = discoverInstruments({ category: 'ETFs', page, pageSize: 100 });
      expect(result.total).toBe(snapshot.entries.length);
      for (const instrument of result.instruments) {
        expect(instrument).toMatchObject({ type: 'etf', country: 'US', currency: 'USD' });
        expect(seen.has(instrument.id)).toBe(false);
        expect(symbols.has(instrument.symbol)).toBe(false);
        seen.add(instrument.id);
        symbols.add(instrument.symbol);
      }
    }
    expect(seen.size).toBe(catalogCounts.etfs);
  });
  it.each(['VOO', 'IVV', 'VTI', 'IWM', 'TLT', 'GLD', 'IBIT', 'SCHD'])(
    'finds %s in its exact listing',
    (symbol) => {
      const first = discoverInstruments({ category: 'ETFs', query: symbol }).instruments[0];
      expect(first.symbol).toBe(symbol);
      expect(first.type).toBe('etf');
      expect(first.exchange).not.toBe('BYMA');
      expect(yahooSymbol(first)).toBe(symbol);
      expect(tradingViewSymbol(first)).toBeTruthy();
    },
  );
  it('keeps legacy portfolio identities working while using their verified primary exchange', async () => {
    expect(findPrimaryEtf('SPY')?.id).toBe('ARCA:SPY:USD');
    expect(findDiscoveryInstrument('NYSE:SPY:USD')).toBeTruthy();
    expect(await resolveInstrument('NYSE:SPY:USD')).toMatchObject({
      id: 'NYSE:SPY:USD',
      exchange: 'ARCA',
    });
    expect(
      discoverInstruments({ category: 'ETFs', query: 'SPY' }).instruments.filter(
        (i) => i.symbol === 'SPY',
      ),
    ).toHaveLength(1);
  });
});
