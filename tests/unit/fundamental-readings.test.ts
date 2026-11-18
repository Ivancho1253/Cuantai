import { describe, it, expect } from 'vitest';
import { fundamentalReading } from '@/lib/finance/fundamental-readings';
import { parseEarningsComparison } from '@/lib/market/earnings-comparison';
import type { FundamentalResearch, ResearchMetric } from '@/lib/market/public-fundamentals';
const research: FundamentalResearch = {
  instrumentId: 'NASDAQ:TEST:USD',
  issuer: 'Test company',
  source: 'Test fixture',
  url: 'https://example.test',
  asOf: '2025-12-31',
  retrievedAt: '2026-11-18T00:00:00Z',
  metrics: [],
  title: 'Test',
  conclusion: 'Test',
  coverage: [],
  kind: 'stock',
  periods: [
    { date: '2025-12-31', currency: 'USD', values: { NetIncome: 20 } },
    { date: '2024-12-31', currency: 'USD', values: { NetIncome: 30 } },
  ],
};
const metric = (id: string, value: number): ResearchMetric => ({
  id,
  value,
  label: id,
  unit: 'USD',
  explanation: 'Dato anual.',
});
describe('explainable fundamental readings', () => {
  it('distinguishes profitability from deterioration and growth from consensus', () => {
    expect(fundamentalReading(metric('netIncome', 20), research)).toMatchObject({
      label: 'Positivo, pero en baja',
      tone: 'warning',
    });
    expect(fundamentalReading(metric('netIncome', -5), research)).toMatchObject({
      label: 'Con pérdidas',
      tone: 'negative',
    });
    expect(fundamentalReading(metric('growth', 12), research).label).toBe(
      'Ingresos en crecimiento',
    );
    expect(fundamentalReading(metric('growth', 12), research).text).not.toContain('consenso');
  });
  it('does not compare annual results across currencies or nonannual gaps', () => {
    const mixed = {
      ...research,
      periods: [research.periods[0], { ...research.periods[1], currency: 'ARS' }],
    };
    expect(fundamentalReading(metric('netIncome', 20), mixed).label).toBe('Con ganancias');
    expect(fundamentalReading(metric('netIncome', 20), mixed).text).not.toContain('Disminuyó');
  });
});
const payload = (actual: number, estimate: number, date = '10/29/2026') => ({
  data: {
    symbol: 'amzn',
    earningsSurpriseTable: {
      rows: [
        {
          fiscalQtrEnd: 'Sep 2026',
          dateReported: date,
          eps: actual,
          consensusForecast: String(estimate),
        },
      ],
    },
  },
});
describe('published earnings consensus comparisons', () => {
  it('compares the same source row and handles zero and negative estimates', () => {
    expect(
      parseEarningsComparison(payload(1.89, 2.01), 'AMZN', Date.parse('2026-11-18'))
        ?.surprisePercent,
    ).toBeCloseTo(-5.97);
    expect(
      parseEarningsComparison(payload(-0.5, -1), 'AMZN', Date.parse('2026-11-18'))?.surprisePercent,
    ).toBe(50);
    expect(
      parseEarningsComparison(payload(1, 0), 'AMZN', Date.parse('2026-11-18'))?.surprisePercent,
    ).toBeNull();
  });
  it('rejects an unrelated issuer, invalid dates and future reports', () => {
    expect(() => parseEarningsComparison(payload(1, 2), 'AAPL')).toThrow('emisor');
    expect(parseEarningsComparison(payload(1, 2, '2/31/2026'), 'AMZN')).toBeNull();
    expect(parseEarningsComparison(payload(1, 2, '10/29/2099'), 'AMZN')).toBeNull();
  });
});
