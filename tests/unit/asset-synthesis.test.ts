import { describe, it, expect } from 'vitest';
import { assetSynthesis } from '@/lib/finance/asset-synthesis';
import type { FundamentalResearch } from '@/lib/market/public-fundamentals';
const data = (income = 20, cash = 30): FundamentalResearch => ({
  instrumentId: 'NASDAQ:TEST:USD',
  issuer: 'Test',
  kind: 'stock',
  source: 'Test',
  url: 'https://example.test',
  asOf: '2025-12-31',
  retrievedAt: '2026-11-18T00:00:00Z',
  title: 'Test',
  conclusion: 'Test',
  coverage: [],
  metrics: [
    { id: 'netIncome', label: 'Resultado', value: income, unit: 'USD', explanation: 'Test' },
    { id: 'cashflow', label: 'Caja', value: cash, unit: 'USD', explanation: 'Test' },
    { id: 'growth', label: 'Crecimiento', value: 12, unit: '%', explanation: 'Test' },
  ],
  periods: [
    { date: '2025-12-31', currency: 'USD', values: { FreeCashFlow: 10 } },
    { date: '2024-12-31', currency: 'USD', values: { FreeCashFlow: 15 } },
  ],
  earnings: {
    period: 'Sep 2026',
    reportedAt: '2026-10-29',
    actual: 1.89,
    estimate: 2.01,
    surprisePercent: -5.97,
    source: 'Test',
    url: 'https://example.test',
    currency: 'USD',
  },
});
describe('general asset synthesis', () => {
  it('keeps operating strength separate from a quarterly earnings miss', () => {
    const result = assetSynthesis({ fundamentals: data() });
    expect(result.tone).toBe('warning');
    expect(result.title).toContain('último trimestre bajo el consenso');
    expect(result.strengths.map((f) => f.text).join(' ')).toContain('ganancias');
    expect(result.attention.map((f) => f.text).join(' ')).toContain('EPS del último trimestre');
    expect(result.attention.map((f) => f.text).join(' ')).toContain(
      'flujo de caja libre disminuyó',
    );
  });
  it('does not turn missing data into a neutral technical opinion or a positive business conclusion', () => {
    const result = assetSynthesis({});
    expect(result.title).toContain('Lectura parcial');
    expect(result.strengths).toHaveLength(0);
    expect(result.technicalLabel).toBe('Sin lectura suficiente');
    expect(result.missing.length).toBeGreaterThan(0);
  });
  it('describes operating losses and distinguishes cash generation from accounting profit', () => {
    expect(assetSynthesis({ fundamentals: data(-20, -30) })).toMatchObject({
      tone: 'negative',
      fundamentalLabel: 'Pérdidas y consumo de caja',
    });
    expect(assetSynthesis({ fundamentals: data(-20, 30) }).title).toContain(
      'generación de efectivo',
    );
    expect(assetSynthesis({ fundamentals: data(0, 0) }).title).toContain('en cero');
  });
  it('does not compare free cash flow across different reporting currencies', () => {
    const fundamentals = data();
    fundamentals.periods[1].currency = 'ARS';
    expect(
      assetSynthesis({ fundamentals }).attention.some((f) =>
        f.text.includes('caja libre disminuyó'),
      ),
    ).toBe(false);
  });
});
