import { describe, expect, it } from 'vitest';
import argentina from '@/lib/market/data/argentina.json';
import {
  catalogCounts,
  discoverInstruments,
  findDiscoveryInstrument,
} from '@/lib/market/discovery';
import { tradingViewSymbol } from '@/lib/market/tradingview';

describe('verified local Argentine shares', () => {
  it('imports the verified share universe without padding it with foreign certificates or suspended symbols', () => {
    expect(argentina.entries.length).toBeGreaterThan(60);
    expect(argentina.entries.length).toBeLessThan(100);
    expect(catalogCounts.argentina).toBe(argentina.entries.length);
    const seen = new Set<string>();
    for (let page = 1; page <= Math.ceil(catalogCounts.argentina / 50); page++) {
      for (const stock of discoverInstruments({ category: 'Acciones ARG', page }).instruments) {
        expect(stock).toMatchObject({
          exchange: 'BYMA',
          country: 'AR',
          currency: 'ARS',
          type: 'stock',
        });
        expect(stock.isin).toMatch(/^AR[A-Z0-9]{10}$/);
        expect(seen.has(stock.isin!)).toBe(false);
        seen.add(stock.isin!);
      }
    }
    expect(seen.size).toBe(catalogCounts.argentina);
    for (const excluded of argentina.excluded)
      expect(
        discoverInstruments({ category: 'Acciones ARG', query: excluded.symbol }).instruments.some(
          (i) => i.symbol === excluded.symbol,
        ),
      ).toBe(false);
  });
  it('orders all pages by dated ADTV, keeping unmeasured shares after ranked ones', () => {
    const rows = [1, 2].flatMap(
      (page) => discoverInstruments({ category: 'Acciones ARG', page }).instruments,
    );
    const measured = rows.filter((i) => i.liquidityRank != null);
    expect(measured.length).toBe(argentina.rankedCount);
    expect(measured.map((i) => i.liquidityRank)).toEqual(
      Array.from({ length: measured.length }, (_, i) => i + 1),
    );
    for (let i = 1; i < measured.length; i++)
      expect(Number(measured[i].liquidityAdtvARS)).toBeLessThanOrEqual(
        Number(measured[i - 1].liquidityAdtvARS),
      );
    expect(rows.slice(0, measured.length).every((i) => i.liquidityRank != null)).toBe(true);
    expect(rows.slice(measured.length).every((i) => i.liquidityRank == null)).toBe(true);
    expect(measured.every((i) => i.liquidityAsOf === argentina.asOf)).toBe(true);
  });
  it('resolves local listings and the verified CEPU alias without creating another issuer', () => {
    for (const symbol of [
      'GGAL',
      'YPFD',
      'PAMP',
      'BMA',
      'CEPU',
      'ALUA',
      'TXAR',
      'EDN',
      'TECO2',
      'LOMA',
    ]) {
      const stock = findDiscoveryInstrument(`BYMA:${symbol}:ARS`)!;
      expect(stock?.type).toBe('stock');
      expect(tradingViewSymbol(stock)).toBe(`BCBA:${symbol}`);
    }
    expect(argentina.aliases).toContainEqual({
      directorySymbol: 'CEPU2',
      symbol: 'CEPU',
      isin: findDiscoveryInstrument('BYMA:CEPU:ARS')!.isin,
    });
    expect(
      discoverInstruments({ category: 'Acciones ARG', query: 'CEPU' }).instruments,
    ).toHaveLength(1);
    expect(catalogCounts.argentinaMerval).toBe(19);
    expect(discoverInstruments({ category: 'Acciones ARG', query: 'MSCI Merval' }).total).toBe(19);
  });
});
