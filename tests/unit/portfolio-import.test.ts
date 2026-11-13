import { describe, expect, it } from 'vitest';
import { buildImportRows, importDecimal, importInputSchema } from '@/lib/portfolio-import/parser';
import { receiptRows } from '@/lib/portfolio-import/text-parser';
import { calculatePortfolio, type Transaction } from '@/lib/finance/portfolio';
import { instruments } from '@/lib/market/catalog';
import { isSolanaAddress } from '@/lib/portfolio-import/wallet';
const make = (rows: Record<string, string>[], mode: 'trades' | 'holdings' = 'trades') =>
  importInputSchema.parse({ portfolioId: 'test', mode, numberFormat: 'es', rows });
const row = {
  symbol: 'AAPL',
  currency: 'USD',
  date: '2025-01-15',
  type: 'compra',
  quantity: '10',
  price: '123,45',
};
describe('portfolio import interpretation', () => {
  it.each([
    ['1.234,56', 'es', '1234.56'],
    ['1,234.56', 'en', '1234.56'],
    ['0,00000001', 'es', '0.00000001'],
    ['1.000', 'es', '1000'],
    ['1.000', 'en', '1'],
  ])('parses %s using %s', (input, locale, expected) =>
    expect(importDecimal(input, locale as 'es' | 'en')).toBe(expected),
  );
  it.each(['NaN', '1e6', '1,2,3', '100000000000000000000', '0.0000000000000000001'])(
    'rejects invalid decimal %s',
    (input) => expect(() => importDecimal(input, 'en')).toThrow(),
  );
  it('matches exact currency and exchange instead of choosing an ambiguous listing', () => {
    const result = buildImportRows(make([row]));
    expect(result[0].errors).toEqual([]);
    expect(result[0].transaction).toMatchObject({
      instrumentId: 'NASDAQ:AAPL:USD',
      quantity: '10',
      price: '123.45',
      type: 'BUY',
      date: '2025-01-15',
    });
    const ambiguous = buildImportRows(make([{ ...row, currency: '' }]));
    expect(ambiguous[0].errors.length).toBeGreaterThan(0);
    expect(ambiguous[0].transaction).toBeUndefined();
  });
  it('does not invent a trade price, operation or valid date', () => {
    for (const changes of [
      { price: '' },
      { type: '' },
      { date: '31/02/2025' },
      { date: '2099-01-01' },
    ])
      expect(buildImportRows(make([{ ...row, ...changes }]))[0].errors.length).toBeGreaterThan(0);
  });
  it('marks snapshot cost as unknown instead of a zero-cost purchase', () => {
    const result = buildImportRows(make([{ ...row, price: '' }], 'holdings'))[0];
    expect(result.errors).toEqual([]);
    expect(result.transaction).toMatchObject({ type: 'TRANSFER_IN', costBasisUnknown: true });
  });
  it('detects a duplicated asset in a holdings snapshot', () => {
    expect(buildImportRows(make([row, row], 'holdings'))[1].errors.length).toBeGreaterThan(0);
  });
  it('allows an empty complete wallet snapshot only', () => {
    expect(() => make([])).toThrow();
    expect(() =>
      importInputSchema.parse({
        portfolioId: 'p',
        mode: 'holdings',
        rows: [],
        sourceKey: 'wallet:ethereum:0x123',
        completeSnapshot: true,
      }),
    ).not.toThrow();
  });
  it('extracts receipts without assuming that every image is a purchase', () => {
    expect(receiptRows('AAPL 10 100 USD\n2025-01-15', 'trades')[0].type).toBe('');
    expect(
      receiptRows(
        'Compra\nTicker: AAPL\nCantidad: 10\nPrecio: 123,45 USD\n2025-01-15',
        'trades',
      )[0],
    ).toMatchObject({ symbol: 'AAPL', quantity: '10', price: '123,45', type: 'BUY' });
  });
  it('distinguishes Solana addresses from malformed addresses and secret-key arrays', () => {
    expect(isSolanaAddress('11111111111111111111111111111111')).toBe(true);
    expect(isSolanaAddress('0x123')).toBe(false);
    expect(isSolanaAddress('[1,2,3,4]')).toBe(false);
    expect(isSolanaAddress('11111111111111111111111111111111111111111111')).toBe(false);
  });
});
describe('imported holdings accounting', () => {
  const tx = (data: Partial<Transaction>): Transaction => ({
    id: '1',
    instrumentId: 'NASDAQ:AAPL:USD',
    type: 'TRANSFER_IN',
    quantity: '10',
    price: '0',
    fees: '0',
    currency: 'USD',
    date: '2025-01-15',
    fxRate: null,
    ...data,
  });
  it('retains an unknown basis and prevents fictitious gains on subsequent sales', () => {
    const result = calculatePortfolio(
      [
        tx({ costBasisUnknown: true }),
        tx({ id: '2', type: 'SELL', quantity: '2', price: '100', date: '2025-01-16' }),
      ],
      instruments,
      [],
      'USD',
    );
    expect(result.positions[0]).toMatchObject({
      quantity: '8',
      costBasis: null,
      realizedPnl: null,
    });
  });
  it('removes FIFO cost on outgoing adjustments without recording sales proceeds', () => {
    const result = calculatePortfolio(
      [
        tx({ price: '100' }),
        tx({ id: '2', type: 'TRANSFER_OUT', quantity: '4', date: '2025-01-16' }),
      ],
      instruments,
      [],
      'USD',
    );
    expect(result.positions[0]).toMatchObject({
      quantity: '6',
      costBasis: '600',
      realizedPnl: '0',
    });
  });
});
