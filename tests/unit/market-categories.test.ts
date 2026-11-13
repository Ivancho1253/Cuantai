import { describe, expect, it } from 'vitest';
import { discoverInstruments, catalogCounts } from '@/lib/market/discovery';
import { marketCategories } from '@/lib/market/categories';

describe('separate market categories', () => {
  it('covers the catalog without mixing asset classes or countries', () => {
    const ids = new Set<string>();
    for (const category of marketCategories) {
      const first = discoverInstruments({ category, pageSize: 100 });
      expect(first.total).toBeGreaterThan(0);
      for (let page = 1; page <= Math.ceil(first.total / 100); page++) {
        const result = discoverInstruments({ category, page, pageSize: 100 });
        for (const instrument of result.instruments) {
          expect(ids.has(instrument.id)).toBe(false);
          ids.add(instrument.id);
          if (category === 'Acciones USA')
            expect(instrument).toMatchObject({ type: 'stock', country: 'US' });
          if (category === 'Acciones ARG')
            expect(instrument).toMatchObject({ type: 'stock', country: 'AR' });
          if (category === 'Cedears ARG') expect(instrument.type).toBe('cedear');
          if (category === 'ETFs') expect(instrument.type).toBe('etf');
          if (category === 'Crypto') expect(instrument.type).toBe('crypto');
        }
      }
    }
    expect(ids.size).toBe(catalogCounts.total);
  });
  it('keeps search within the selected category and crypto market-cap ranking', () => {
    expect(discoverInstruments({ category: 'Acciones ARG', query: 'AAPL' }).total).toBe(0);
    expect(
      discoverInstruments({ category: 'Acciones ARG', query: 'GGAL' }).instruments[0].type,
    ).toBe('stock');
    expect(
      discoverInstruments({ category: 'Cedears ARG', query: 'AAPL' }).instruments.every(
        (i) => i.type === 'cedear',
      ),
    ).toBe(true);
    expect(discoverInstruments({ category: 'Crypto' }).instruments[0].marketCapRank).toBe(1);
  });
});
