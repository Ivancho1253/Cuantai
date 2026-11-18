import { describe, it, expect } from 'vitest';
import { parsePublicPeriods, corporateMetrics } from '@/lib/market/public-fundamentals';
const series = (symbol: string, concept: string, facts: unknown[]) => ({
  meta: { symbol: [symbol], type: ['annual' + concept] },
  ['annual' + concept]: facts,
});
const fact = (date: string, value: number, currency = 'USD') => ({
  asOfDate: date,
  periodType: '12M',
  currencyCode: currency,
  reportedValue: { raw: value },
});
describe('source-backed annual fundamentals', () => {
  it('rejects another issuer and ignores quarterly, invalid and future facts', () => {
    expect(() =>
      parsePublicPeriods({ timeseries: { result: [series('MSFT', 'NetIncome', [])] } }, 'AAPL'),
    ).toThrow('emisor');
    const data = parsePublicPeriods(
      {
        timeseries: {
          result: [
            series('AAPL', 'NetIncome', [
              fact('2025-09-30', 12),
              fact('2099-09-30', 40),
              { ...fact('2025-06-30', 4), periodType: '3M' },
              fact('2024-09-30', NaN),
            ]),
          ],
        },
      },
      'AAPL',
    );
    expect(data).toHaveLength(1);
    expect(data[0].values.NetIncome).toBe(12);
  });
  it('keeps reporting currencies separate and only compares comparable annual periods', () => {
    const raw = {
      timeseries: {
        result: [
          series('GGAL.BA', 'TotalRevenue', [
            fact('2025-12-31', 120, 'ARS'),
            fact('2024-12-31', 100, 'USD'),
          ]),
          series('GGAL.BA', 'NetIncome', [fact('2025-12-31', 12, 'ARS')]),
        ],
      },
    };
    const periods = parsePublicPeriods(raw, 'GGAL.BA');
    expect(corporateMetrics(periods).find((m) => m.id === 'growth')).toBeUndefined();
    expect(corporateMetrics(periods).find((m) => m.id === 'margin')?.value).toBe(10);
    expect(corporateMetrics(periods).find((m) => m.id === 'cashflow')).toBeUndefined();
    raw.timeseries.result[0].annualTotalRevenue = [
      fact('2025-12-31', 120, 'ARS'),
      fact('2024-12-31', 100, 'ARS'),
    ];
    expect(
      corporateMetrics(parsePublicPeriods(raw, 'GGAL.BA')).find((m) => m.id === 'growth')?.value,
    ).toBeCloseTo(20);
  });
});
