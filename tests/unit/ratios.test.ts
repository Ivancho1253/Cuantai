import { describe, expect, it } from 'vitest';
import { ratioImportSchema } from '@/lib/market/ratio-import';
describe('dated CEDEAR ratio imports', () => {
  const record = {
    source: 'https://issuer.example.com/authorized-ratios',
    retrievedAt: '2025-01-01T12:00:00Z',
    ratios: [
      {
        instrumentId: 'BYMA:JPM:ARS',
        underlyingId: 'NYSE:JPM:USD',
        certificatesPerShare: '15',
        effectiveFrom: '2025-01-01',
      },
    ],
  };
  it('accepts sourced effective-dated records without manufacturing a ratio', () =>
    expect(ratioImportSchema.parse(record).ratios[0].certificatesPerShare).toBe('15'));
  it('rejects missing provenance, invalid dates and zero ratios', () => {
    expect(ratioImportSchema.safeParse({ ...record, source: '' }).success).toBe(false);
    expect(
      ratioImportSchema.safeParse({
        ...record,
        ratios: [{ ...record.ratios[0], certificatesPerShare: '0' }],
      }).success,
    ).toBe(false);
    expect(
      ratioImportSchema.safeParse({
        ...record,
        ratios: [{ ...record.ratios[0], effectiveFrom: 'unknown' }],
      }).success,
    ).toBe(false);
  });
});
