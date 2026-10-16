import { eq, asc, and, desc, lte } from 'drizzle-orm';
import { getDb } from './db';
import * as s from './db/schema';
import {
  calculatePortfolio,
  type Transaction,
  type FxRecord,
  underlyingExposure,
} from './finance/portfolio';
import { marketSnapshot, resolveInstrument } from './market/service';
import type { Currency, Quote } from './market/types';
import { HttpError } from './security';
export async function ownedPortfolio(userId: string, id: string) {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(s.portfolios)
    .where(and(eq(s.portfolios.id, id), eq(s.portfolios.userId, userId)));
  if (!p) throw new HttpError(404, 'Cartera no encontrada');
  return p;
}
export async function portfolioDetail(userId: string, id: string) {
  const p = await ownedPortfolio(userId, id);
  const db = await getDb();
  const rows = await db
    .select()
    .from(s.transactions)
    .where(eq(s.transactions.portfolioId, id))
    .orderBy(asc(s.transactions.date), asc(s.transactions.createdAt));
  const list = await Promise.all(
    [...new Set(rows.map((t) => t.instrumentId))].map(resolveInstrument),
  );
  const manual = await db.select().from(s.manualQuotes).where(eq(s.manualQuotes.userId, userId));
  const fx = await db.select().from(s.exchangeRates).where(eq(s.exchangeRates.userId, userId));
  const quotes = await Promise.all(
    list.map(async (i) => {
      if (i.type === 'cash') return null;
      const m = manual.find((m) => m.instrumentId === i.id);
      if (m)
        return {
          instrumentId: i.id,
          currency: i.currency,
          price: m.price,
          changePercent: '0',
          volume: null,
          source: m.source,
          url: '',
          asOf: m.asOf,
          retrievedAt: new Date().toISOString(),
          status: 'manual',
          delayMinutes: null,
          adjusted: 'unknown',
          stale: Date.now() - new Date(m.asOf).getTime() > 4 * 86400000,
        } satisfies Quote;
      return (await marketSnapshot(i.id)).quote;
    }),
  );
  const result = calculatePortfolio(
    rows as Transaction[],
    list,
    quotes.filter((q): q is Quote => q !== null),
    p.baseCurrency as Currency,
    fx as FxRecord[],
  );
  const ratios = await db
    .select()
    .from(s.cedearRatios)
    .where(lte(s.cedearRatios.effectiveFrom, new Date().toISOString().slice(0, 10)))
    .orderBy(desc(s.cedearRatios.effectiveFrom));
  const cedearExposures = result.positions.flatMap((position) => {
    const ratio = ratios.find((r) => r.instrumentId === position.instrumentId);
    return ratio
      ? [
          {
            instrumentId: position.instrumentId,
            underlyingQuantity: underlyingExposure(position.quantity, ratio.certificatesPerShare),
            certificatesPerShare: ratio.certificatesPerShare,
            source: ratio.source,
            effectiveFrom: ratio.effectiveFrom,
          },
        ]
      : [];
  });
  return {
    cedearExposures,
    portfolio: p,
    transactions: rows,
    instruments: list,
    quotes: quotes.filter(Boolean),
    fx,
    ...result,
  };
}
