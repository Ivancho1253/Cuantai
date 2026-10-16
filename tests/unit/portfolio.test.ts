import { describe, expect, it } from 'vitest';
import {
  calculatePortfolio,
  convert,
  underlyingExposure,
  theoreticalCedear,
  type Transaction,
  type FxRecord,
} from '@/lib/finance/portfolio';
import { instruments } from '@/lib/market/catalog';
import type { Quote, Currency } from '@/lib/market/types';
import { formatQuantity } from '@/lib/utils';
const usd = 'NYSE:JPM:USD',
  ars = 'BYMA:JPM:ARS',
  cedearUsd = 'BYMA:JPMD:USD',
  crypto = 'BINANCE:BTCUSDT:USDT';
const tx = (partial: Partial<Transaction> = {}): Transaction => ({
  id: 't',
  instrumentId: usd,
  type: 'BUY',
  quantity: '10',
  price: '100',
  fees: '0',
  currency: 'USD',
  date: '2025-01-01',
  fxRate: null,
  ...partial,
});
const quote = (instrumentId = usd, price = '120', currency: Currency = 'USD'): Quote => ({
  instrumentId,
  currency,
  price,
  changePercent: '0',
  volume: null,
  source: 'Test licensed close',
  url: 'https://example.com/close',
  asOf: '2025-01-03T20:00:00Z',
  retrievedAt: '2025-01-03T20:00:00Z',
  status: 'eod',
  delayMinutes: null,
  adjusted: 'unadjusted',
});
const fx = (rate = '0.001'): FxRecord => ({
  from: 'ARS',
  to: 'USD',
  rate,
  kind: 'MEP',
  source: 'Test FX',
  asOf: '2025-01-03T20:00:00Z',
});
describe('FIFO and exact decimal accounting', () => {
  it('includes buy fees in cost and sell fees in realized P&L', () => {
    const p = calculatePortfolio(
      [
        tx({ fees: '10' }),
        tx({
          id: 'sell',
          type: 'SELL',
          quantity: '4',
          price: '120',
          fees: '4',
          date: '2025-01-02',
        }),
      ],
      instruments,
      [quote()],
      'USD',
    );
    expect(p.positions[0]).toMatchObject({
      quantity: '6',
      costBasis: '606',
      value: '720',
      realizedPnl: '72',
      unrealizedPnl: '114',
    });
  });
  it('consumes multiple lots FIFO on partial sale', () => {
    const p = calculatePortfolio(
      [
        tx(),
        tx({ id: 'b2', quantity: '5', price: '200', date: '2025-01-02' }),
        tx({ id: 's', type: 'SELL', quantity: '12', price: '300', date: '2025-01-03' }),
      ],
      instruments,
      [quote()],
      'USD',
    );
    expect(p.positions[0]).toMatchObject({ quantity: '3', costBasis: '600', realizedPnl: '2200' });
  });
  it('rejects overselling including backdated transactions', () => {
    expect(() =>
      calculatePortfolio(
        [tx(), tx({ type: 'SELL', quantity: '11', date: '2025-01-02' })],
        instruments,
        [],
        'USD',
      ),
    ).toThrow('Sale exceeds');
    expect(() =>
      calculatePortfolio(
        [tx(), tx({ type: 'SELL', quantity: '1', date: '2024-12-31' })],
        instruments,
        [],
        'USD',
      ),
    ).toThrow('Sale exceeds');
  });
  it('keeps decimal quantities exact', () => {
    const p = calculatePortfolio(
      [tx({ quantity: '0.1', price: '0.2' }), tx({ quantity: '0.2', price: '0.2' })],
      instruments,
      [quote(usd, '0.2')],
      'USD',
    );
    expect(p.positions[0]).toMatchObject({
      quantity: '0.3',
      costBasis: '0.06',
      value: '0.06',
      unrealizedPnl: '0',
    });
  });
  it('applies splits to quantity without changing historical cost', () => {
    const p = calculatePortfolio(
      [tx(), tx({ type: 'SPLIT', quantity: '2', price: '0', date: '2025-01-02' })],
      instruments,
      [quote(usd, '50')],
      'USD',
    );
    expect(p.positions[0]).toMatchObject({ quantity: '20', costBasis: '1000', value: '1000' });
  });
  it('rejects split costs instead of silently dropping them', () => {
    for (const amounts of [
      { price: '1', fees: '0' },
      { price: '0', fees: '1' },
    ])
      expect(() =>
        calculatePortfolio(
          [tx(), tx({ type: 'SPLIT', quantity: '2', date: '2025-01-02', ...amounts })],
          instruments,
          [],
          'USD',
        ),
      ).toThrow('Split price and fees must be zero');
  });
  it('displays fractional and large quantities without floating-point rounding', () => {
    expect(formatQuantity('1e-8')).toBe('0.00000001');
    expect(formatQuantity('9007199254740993.123456789012')).toBe(
      '9,007,199,254,740,993.123456789012',
    );
    expect(formatQuantity('174.000000')).toBe('174');
    expect(formatQuantity(null)).toBe('—');
  });
  it('records dividends separately from capital gains', () => {
    const p = calculatePortfolio(
      [tx(), tx({ type: 'DIVIDEND', quantity: '10', price: '2', fees: '1', date: '2025-01-02' })],
      instruments,
      [quote()],
      'USD',
    );
    expect(p.dividends).toBe('19');
    expect(p.realizedPnl).toBe('0');
    expect(p.positions[0].quantity).toBe('10');
  });
  it('values cash deposits and withdrawals without a quote', () => {
    const p = calculatePortfolio(
      [
        tx({ instrumentId: 'CASH:USD:USD', type: 'DEPOSIT', quantity: '2000', price: '1' }),
        tx({
          instrumentId: 'CASH:USD:USD',
          type: 'WITHDRAWAL',
          quantity: '500',
          price: '1',
          date: '2025-01-02',
        }),
      ],
      instruments,
      [],
      'USD',
    );
    expect(p.value).toBe('1500');
    expect(p.unrealizedPnl).toBe('0');
  });
});
describe('Argentina, currencies and certificates', () => {
  it('values CEDEAR quantity × certificate price without a second ratio', () => {
    const p = calculatePortfolio(
      [
        tx({
          instrumentId: ars,
          currency: 'ARS',
          quantity: '174',
          price: '10000',
          fxRate: '0.001',
        }),
      ],
      instruments,
      [quote(ars, '12000', 'ARS')],
      'USD',
      [fx('0.0008')],
    );
    expect(p.positions[0]).toMatchObject({
      quantity: '174',
      costBasis: '1740',
      value: '1670.4',
      unrealizedPnl: '-69.6',
    });
  });
  it('does not reconvert USD CEDEARs even when historical FX is supplied', () => {
    const p = calculatePortfolio(
      [tx({ instrumentId: cedearUsd, quantity: '174', price: '10', fxRate: '0.001' })],
      instruments,
      [quote(cedearUsd, '12')],
      'USD',
      [fx()],
    );
    expect(p.value).toBe('2088');
    expect(p.costBasis).toBe('1740');
  });
  it('keeps historical and current FX separate', () => {
    const p = calculatePortfolio(
      [tx({ instrumentId: ars, currency: 'ARS', quantity: '10', price: '1000', fxRate: '0.001' })],
      instruments,
      [quote(ars, '1200', 'ARS')],
      'USD',
      [fx('0.0005')],
    );
    expect(p.costBasis).toBe('10');
    expect(p.value).toBe('6');
    expect(p.unrealizedPnl).toBe('-4');
  });
  it('marks missing historical FX incomplete without substituting current FX', () => {
    const p = calculatePortfolio(
      [tx({ instrumentId: ars, currency: 'ARS' })],
      instruments,
      [quote(ars, '120', 'ARS')],
      'USD',
      [fx()],
    );
    expect(p.costBasis).toBeNull();
    expect(p.unrealizedPnl).toBeNull();
    expect(p.complete).toBe(false);
    expect(p.value).toBe('1.2');
  });
  it('never sums a missing current conversion as zero', () => {
    const p = calculatePortfolio(
      [tx(), tx({ instrumentId: ars, currency: 'ARS', fxRate: '0.001' })],
      instruments,
      [quote(), quote(ars, '120', 'ARS')],
      'USD',
    );
    expect(p.value).toBeNull();
    expect(p.positions.every((p) => p.weight === null)).toBe(true);
  });
  it('does not assume USDT equals USD', () => {
    const p = calculatePortfolio(
      [
        tx({
          instrumentId: crypto,
          currency: 'USDT',
          quantity: '0.025',
          price: '80000',
          fxRate: '0.999',
        }),
      ],
      instruments,
      [quote(crypto, '90000', 'USDT')],
      'USD',
    );
    expect(p.value).toBeNull();
    expect(p.costBasis).toBe('1998');
  });
  it('rejects listing and quote currency mismatches', () => {
    expect(() => calculatePortfolio([tx({ instrumentId: ars })], instruments, [], 'USD')).toThrow(
      'currency',
    );
    expect(() =>
      calculatePortfolio([tx()], instruments, [quote(usd, '120', 'ARS')], 'USD'),
    ).toThrow('Quote currency');
  });
  it('computes underlying exposure and theoretical value explicitly', () => {
    expect(underlyingExposure('174', '15')).toBe('11.6');
    expect(theoreticalCedear('240', '15', '1200')).toBe('19200');
    expect(() => underlyingExposure('1', '0')).toThrow();
  });
  it('flags demo or stale valuations', () => {
    const q = { ...quote(), status: 'demo' as const, stale: true };
    const p = calculatePortfolio([tx()], instruments, [q], 'USD');
    expect(p.complete).toBe(false);
    expect(p.positions[0].issues).toHaveLength(2);
  });
  it('identity conversion ignores an unrelated supplied rate', () => {
    expect(convert('100', 'USD', 'USD', '0.001')?.toString()).toBe('100');
    expect(convert('100', 'ARS', 'USD', null)).toBeNull();
  });
});

describe('stablecoin cash denomination', () => {
  it('values a USDT balance through an explicit USD rate instead of a dollar peg', () => {
    const p = calculatePortfolio(
      [
        tx({
          instrumentId: 'CASH:USDT:USDT',
          type: 'DEPOSIT',
          quantity: '2000',
          price: '1',
          currency: 'USDT',
          fxRate: '1',
        }),
      ],
      instruments,
      [],
      'USD',
      [
        {
          from: 'USDT',
          to: 'USD',
          rate: '0.999',
          asOf: new Date().toISOString(),
          kind: 'spot',
          source: 'Test spot conversion',
        },
      ],
    );
    expect(p.value).toBe('1998');
    expect(p.unrealizedPnl).toBe('-2');
  });
});
