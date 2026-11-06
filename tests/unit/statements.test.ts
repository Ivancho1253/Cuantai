import { describe, expect, it, vi } from 'vitest';
import { normalizeStatements } from '@/lib/finance/statements';
import { secFixture } from '../fixtures/sec';
const options = {
  instrumentId: 'NASDAQ:AAPL:USD',
  retrievedAt: '2026-10-16T00:00:00Z',
  financialSector: false,
  delivery: 'sec-api' as const,
};
const value = (
  result: ReturnType<typeof normalizeStatements>,
  row: string,
  period = '2025-12-31',
) => result.rows.find((r) => r.id === row)?.values[period];
describe('annual filing normalization', () => {
  it('keeps fiscal dates, units, exact values and original filing links', () => {
    const result = normalizeStatements(secFixture(), options);
    expect(result.periods.map((p) => p.end)).toEqual(['2025-12-31', '2024-12-31', '2023-12-31']);
    expect(result.cik).toBe('0000123456');
    expect(result.periods[0].url).toBe(
      'https://www.sec.gov/Archives/edgar/data/123456/000012345626000001/0000123456-26-000001-index.html',
    );
    expect(value(result, 'revenue')).toMatchObject({
      value: '12000000',
      unit: 'USD',
      tags: ['us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax'],
    });
    expect(value(result, 'epsDiluted')).toMatchObject({ value: '2.5', unit: 'USD/shares' });
    expect(value(result, 'assets')?.value).toBe('52000000');
    expect(value(result, 'freeCashFlow')).toMatchObject({ value: '3000000', derived: true });
  });
  it('does not mistake quarterly or YTD durations for annual income', () => {
    const input = secFixture();
    const facts =
      input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    facts.push({ ...facts[2], start: '2025-10-01', val: 999999 });
    facts.push({ ...facts[2], start: '2025-04-01', val: 555555 });
    expect(value(normalizeStatements(input, options), 'revenue')?.value).toBe('12000000');
  });
  it('uses actual non-calendar fiscal dates and accepts 53-week years', () => {
    const input = secFixture();
    for (const concept of Object.values(input.facts['us-gaap'])) {
      for (const facts of Object.values(concept.units))
        for (const fact of facts) {
          if (fact.end !== '2025-12-31') continue;
          fact.end = '2025-09-27';
          if ('start' in fact) fact.start = '2024-09-22';
        }
    }
    const result = normalizeStatements(input, options);
    expect(result.periods[0]).toMatchObject({ start: '2024-09-22', end: '2025-09-27' });
    expect(value(result, 'revenue', '2025-09-27')?.value).toBe('12000000');
  });
  it('never blends a later comparative with an original annual filing', () => {
    const input = secFixture();
    const facts =
      input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    facts.push({ ...facts[2], start: '2024-01-01', end: '2024-12-31', val: 77777777 });
    const result = normalizeStatements(input, options);
    expect(value(result, 'revenue', '2024-12-31')?.value).toBe('11000000');
    expect(result.periods[1].filed).toBe('2025-02-01');
  });
  it('uses an amendment without filling its missing concepts from the older filing', () => {
    const input = secFixture();
    const facts =
      input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    facts.push({
      ...facts[2],
      form: '10-K/A',
      filed: '2026-03-01',
      accn: '0000123456-26-000002',
      val: 13000000,
    });
    const result = normalizeStatements(input, options);
    expect(result.periods[0].form).toBe('10-K/A');
    expect(value(result, 'revenue')?.value).toBe('13000000');
    expect(value(result, 'assets')).toBeNull();
    expect(value(result, 'freeCashFlow')).toBeNull();
    expect(result.warnings.join(' ')).toContain('modificada');
  });
  it('rejects contradictory facts for the same concept and context', () => {
    const input = secFixture();
    const facts =
      input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    facts.push({ ...facts[2], val: 999999 });
    const result = normalizeStatements(input, options);
    expect(value(result, 'revenue')).toBeNull();
    expect(result.warnings.join(' ')).toContain('contradictorios');
  });
  it('deduplicates identical contexts and ignores fiscal-year labels on comparative facts', () => {
    const input = secFixture();
    const facts = input.facts['us-gaap'].NetIncomeLoss.units.USD;
    facts.push({ ...facts[2], fy: 2099 });
    expect(value(normalizeStatements(input, options), 'netIncome')?.value).toBe('4000000');
  });
  it('does not infer missing concepts or free cash flow from incomplete evidence', () => {
    const input = secFixture();
    input.facts['us-gaap'].PaymentsToAcquirePropertyPlantAndEquipment.units.USD = [];
    const result = normalizeStatements(input, options);
    expect(value(result, 'capex')).toBeNull();
    expect(value(result, 'freeCashFlow')).toBeNull();
    expect(value(result, 'netIncome')?.value).toBe('4000000');
  });
  it('does not combine currency units or mismatched fiscal starts', () => {
    const input = secFixture();
    input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD[2].start =
      '2025-01-04';
    const revenueFacts =
      input.facts['us-gaap'].RevenueFromContractWithCustomerExcludingAssessedTax.units.USD;
    revenueFacts.push(...Array.from({ length: 20 }, () => ({ ...revenueFacts[2] })));
    input.facts['us-gaap'].Assets.units = {
      EUR: input.facts['us-gaap'].Assets.units.USD,
    } as unknown as (typeof input.facts)['us-gaap']['Assets']['units'];
    const result = normalizeStatements(input, options);
    expect(value(result, 'revenue')).toBeNull();
    expect(value(result, 'assets')).toBeNull();
  });
  it('does not invent IFRS conversion or apply generic operating metrics to banks', () => {
    const input = secFixture();
    const result = normalizeStatements(input, { ...options, financialSector: true });
    expect(
      result.rows.some((r) =>
        ['revenue', 'grossProfit', 'operatingIncome', 'freeCashFlow'].includes(r.id),
      ),
    ).toBe(false);
    expect(value(result, 'netIncome')?.value).toBe('4000000');
    expect(result.warnings.join(' ')).toContain('Sector financiero');
    expect(
      normalizeStatements({ ...input, facts: { 'ifrs-full': input.facts['us-gaap'] } }, options)
        .periods,
    ).toEqual([]);
  });
  it('does not assume an unclassified issuer is a nonfinancial business', () => {
    const result = normalizeStatements(secFixture(), { ...options, sectorKnown: false });
    expect(result.rows.some((row) => row.id === 'freeCashFlow' || row.id === 'revenue')).toBe(
      false,
    );
    expect(result.rows.some((row) => row.id === 'netIncome')).toBe(true);
    expect(result.warnings.join(' ')).toContain('sector del emisor');
  });
  it('honors retrieval date and rejects unsafe numeric values', () => {
    const input = secFixture();
    const original = normalizeStatements(input, {
      ...options,
      retrievedAt: '2025-10-01T00:00:00Z',
    });
    expect(original.periods[0].end).toBe('2024-12-31');
    input.facts['us-gaap'].Assets.units.USD[2].val = 9007199254740992;
    const result = normalizeStatements(input, options);
    expect(value(result, 'assets')).toBeNull();
    expect(result.warnings.join(' ')).toContain('entero seguro');
  });
  it('keeps zero and negative reported results distinct from missing evidence', () => {
    const input = secFixture();
    input.facts['us-gaap'].NetIncomeLoss.units.USD[2].val = 0;
    input.facts['us-gaap'].OperatingIncomeLoss.units.USD[2].val = -0.25;
    const result = normalizeStatements(input, options);
    expect(value(result, 'netIncome')?.value).toBe('0');
    expect(value(result, 'operatingIncome')?.value).toBe('-0.25');
  });
  it('flags an old snapshot against the current date rather than its old download date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z'));
    try {
      const result = normalizeStatements(secFixture(), {
        ...options,
        retrievedAt: '2024-03-01T00:00:00Z',
      });
      expect(result.periods[0].end).toBe('2023-12-31');
      expect(result.warnings.join(' ')).toContain('550 días');
      expect(result.warnings.join(' ')).toContain('treinta días');
    } finally {
      vi.useRealTimers();
    }
  });
});
