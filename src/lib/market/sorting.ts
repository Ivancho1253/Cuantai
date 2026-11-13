import Decimal from 'decimal.js';
import type { MarketSnapshot } from './types';
export type MarketSortKey = 'asset' | 'price' | 'change' | 'volume' | 'rank';
export type MarketSort = { key: MarketSortKey; direction: 'asc' | 'desc' };
export function sortMarketRows(rows: MarketSnapshot[], sort?: MarketSort | null) {
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const value = (row: MarketSnapshot) =>
      sort.key === 'asset'
        ? row.instrument.symbol
        : sort.key === 'rank'
          ? (row.instrument.liquidityRank ?? row.instrument.marketCapRank ?? null)
          : (row.quote?.[sort.key === 'change' ? 'changePercent' : sort.key] ?? null);
    const av = value(a),
      bv = value(b);
    if (av === null) return bv === null ? 0 : 1;
    if (bv === null) return -1;
    const cmp =
      sort.key === 'asset' ? String(av).localeCompare(String(bv)) : new Decimal(av).cmp(bv);
    return (
      (sort.direction === 'asc' ? cmp : -cmp) || a.instrument.id.localeCompare(b.instrument.id)
    );
  });
}
