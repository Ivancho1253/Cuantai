import Decimal from 'decimal.js';
import type { Currency, Instrument, Quote } from '../market/types';
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_EVEN });
export type Transaction = {
  id: string;
  instrumentId: string;
  type: 'BUY' | 'SELL' | 'DIVIDEND' | 'DEPOSIT' | 'WITHDRAWAL' | 'SPLIT';
  quantity: string;
  price: string;
  fees: string;
  currency: Currency;
  date: string;
  fxRate: string | null;
  fxKind?: string | null;
  fxSource?: string | null;
  broker?: string | null;
  notes?: string | null;
};
export type Position = {
  instrumentId: string;
  quantity: string;
  costBasis: string | null;
  value: string | null;
  unrealizedPnl: string | null;
  realizedPnl: string | null;
  dividends: string | null;
  weight: string | null;
  issues: string[];
};
export type FxRecord = {
  from: Currency;
  to: Currency;
  rate: string;
  asOf: string;
  source: string;
  kind: string;
};
export function convert(amount: Decimal.Value, from: Currency, to: Currency, rate?: string | null) {
  if (from === to) return new Decimal(amount);
  if (!rate || new Decimal(rate).lte(0)) return null;
  return new Decimal(amount).mul(rate);
}
export function underlyingExposure(certificates: string, certificatesPerShare: string) {
  const r = new Decimal(certificatesPerShare);
  if (r.lte(0)) throw new Error('Invalid CEDEAR ratio');
  return new Decimal(certificates).div(r).toString();
}
export function theoreticalCedear(
  underlyingPrice: string,
  certificatesPerShare: string,
  arsPerUsd: string,
) {
  return new Decimal(underlyingExposure('1', certificatesPerShare))
    .mul(underlyingPrice)
    .mul(arsPerUsd)
    .toString();
}
export function calculatePortfolio(
  transactions: Transaction[],
  instruments: Instrument[],
  quotes: Quote[],
  base: Currency,
  fx: FxRecord[] = [],
) {
  const positions: Position[] = [];
  for (const id of new Set(transactions.map((t) => t.instrumentId))) {
    const instrument = instruments.find((i) => i.id === id);
    if (!instrument) throw new Error('Unknown instrument');
    const rows = transactions
      .filter((t) => t.instrumentId === id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const lots: { quantity: Decimal; cost: Decimal | null }[] = [];
    let realized: Decimal | null = new Decimal(0),
      dividends: Decimal | null = new Decimal(0);
    const issues: string[] = [];
    for (const t of rows) {
      if (t.currency !== instrument.currency)
        throw new Error('Transaction currency must match the exact listing');
      const qty = new Decimal(t.quantity),
        price = new Decimal(t.price),
        fees = new Decimal(t.fees);
      if (qty.lte(0) || price.lt(0) || fees.lt(0)) throw new Error('Invalid transaction amount');
      if (t.type === 'SPLIT' && (!price.isZero() || !fees.isZero()))
        throw new Error('Split price and fees must be zero');
      const gross = qty.mul(price);
      const fxRate = t.currency === base ? '1' : t.fxRate;
      if (!fxRate && t.type !== 'SPLIT')
        issues.push(`Missing historical ${t.currency}/${base} FX on ${t.date}`);
      if (t.type === 'BUY' || t.type === 'DEPOSIT') {
        lots.push({ quantity: qty, cost: convert(gross.plus(fees), t.currency, base, fxRate) });
      } else if (t.type === 'SELL' || t.type === 'WITHDRAWAL') {
        const held = lots.reduce((s, l) => s.plus(l.quantity), new Decimal(0));
        if (qty.gt(held)) throw new Error('Sale exceeds available position');
        let remaining = qty,
          removedCost: Decimal | null = new Decimal(0);
        for (const lot of lots) {
          if (remaining.isZero()) break;
          const used = Decimal.min(remaining, lot.quantity);
          if (used.isZero()) continue;
          const cost = lot.cost?.mul(used.div(lot.quantity)) ?? null;
          removedCost = removedCost && cost ? removedCost.plus(cost) : null;
          lot.quantity = lot.quantity.minus(used);
          lot.cost = lot.cost && cost ? lot.cost.minus(cost) : null;
          remaining = remaining.minus(used);
        }
        const proceeds = convert(gross.minus(fees), t.currency, base, fxRate);
        realized =
          realized && proceeds && removedCost ? realized.plus(proceeds.minus(removedCost)) : null;
      } else if (t.type === 'DIVIDEND') {
        const income = convert(gross.minus(fees), t.currency, base, fxRate);
        dividends = dividends && income ? dividends.plus(income) : null;
      } else if (t.type === 'SPLIT') {
        for (const lot of lots) lot.quantity = lot.quantity.mul(qty);
      }
    }
    const remainingLots = lots.filter((l) => l.quantity.gt(0));
    const quantity = remainingLots.reduce((s, l) => s.plus(l.quantity), new Decimal(0));
    const costBasis = remainingLots.some((l) => l.cost === null)
      ? null
      : remainingLots.reduce((s, l) => s.plus(l.cost!), new Decimal(0));
    const quote = quotes.find((q) => q.instrumentId === id);
    const rate = fx.find((f) => f.from === instrument.currency && f.to === base);
    if (rate && instrument.currency !== base && Date.now() - Date.parse(rate.asOf) > 4 * 86400000)
      issues.push('Stale current FX rate');
    let value: Decimal | null = quantity.isZero() ? new Decimal(0) : null;
    if (!quantity.isZero()) {
      if (instrument.type === 'cash')
        value = convert(quantity, instrument.currency, base, rate?.rate);
      else if (quote) {
        if (quote.currency !== instrument.currency) throw new Error('Quote currency mismatch');
        value = convert(quantity.mul(quote.price), quote.currency, base, rate?.rate);
        if (quote.status === 'demo') issues.push('Valued using synthetic demo prices');
        if (quote.stale) issues.push('Stale market quote');
      } else issues.push('Missing market price');
      if (instrument.currency !== base && !rate)
        issues.push(`Missing current ${instrument.currency}/${base} FX`);
    }
    positions.push({
      instrumentId: id,
      quantity: quantity.toString(),
      costBasis: costBasis?.toString() ?? null,
      value: value?.toString() ?? null,
      unrealizedPnl: value && costBasis ? value.minus(costBasis).toString() : null,
      realizedPnl: realized?.toString() ?? null,
      dividends: dividends?.toString() ?? null,
      weight: null,
      issues: [...new Set(issues)],
    });
  }
  const sum = (key: 'value' | 'costBasis' | 'unrealizedPnl' | 'realizedPnl' | 'dividends') =>
    positions.some((p) => p[key] === null)
      ? null
      : positions.reduce((s, p) => s.plus(p[key]!), new Decimal(0)).toString();
  const value = sum('value');
  for (const p of positions)
    if (value && new Decimal(value).gt(0) && p.value !== null)
      p.weight = new Decimal(p.value).div(value).mul(100).toString();
  return {
    positions,
    value,
    costBasis: sum('costBasis'),
    unrealizedPnl: sum('unrealizedPnl'),
    realizedPnl: sum('realizedPnl'),
    dividends: sum('dividends'),
    complete: positions.every((p) => !p.issues.length),
    method: 'FIFO' as const,
    baseCurrency: base,
  };
}
