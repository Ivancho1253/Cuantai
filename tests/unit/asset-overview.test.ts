import { describe, expect, it } from 'vitest';
import { buildAssetOverview } from '@/lib/finance/asset-overview';
import { demoHistory } from '@/lib/market/demo';
import { instruments } from '@/lib/market/catalog';
import { normalizeStatements } from '@/lib/finance/statements';
import type { MarketSnapshot } from '@/lib/market/types';
import { secFixture } from '../fixtures/sec';
const cryptoAsset = instruments.find((i) => i.symbol === 'BTCUSDT')!;
const apple = instruments.find((i) => i.symbol === 'AAPL' && i.exchange === 'NASDAQ')!;
const now = new Date('2026-10-17T12:00:00Z');
function snapshot(end = '2026-10-17', count = 500): MarketSnapshot {
  const source = demoHistory(cryptoAsset);
  const endTime = Date.parse(`${end}T00:00:00Z`) / 1000;
  return {
    ...source,
    candles: Array.from({ length: count }, (_, index) => ({
      time: endTime - (count - 1 - index) * 86400,
      open: 100 + index,
      high: 101 + index,
      low: 99 + index,
      close: 100 + index,
      volume: 1000,
    })),
    quote: { ...source.quote!, price: '999999' },
    provenance: { ...source.provenance, status: 'realtime', asOf: end },
  };
}
const build = (input: MarketSnapshot) =>
  buildAssetOverview(input, { metrics: [] }, { data: null, error: 'No verified statements' }, now);
describe('Asset intelligence calculations', () => {
  it('uses completed daily closes for all four periods, never the live quote or today’s candle', () => {
    const input = snapshot();
    input.candles.at(-1)!.close = 1000000;
    const data = build(input);
    expect(data.dataAsOf).toBe('2026-10-16');
    expect(data.performance.map((p) => p.from)).toEqual([
      '2026-10-15',
      '2026-10-09',
      '2026-09-16',
      '2025-10-16',
    ]);
    expect(data.performance[0].value).toBeCloseTo((598 / 597 - 1) * 100, 10);
    expect(data.performance[3].value).toBeCloseTo((598 / 233 - 1) * 100, 10);
    expect(data.facts.find((fact) => fact.id === 'quote-price')?.value).toBe('999999');
    expect(data.sources.find((source) => source.id === 'quote')?.asOf).toBe(input.quote!.asOf);
  });
  it('does not call incomplete annual history an annual return', () => {
    const data = build(demoHistory(apple));
    expect(data.performance[3]).toMatchObject({ value: null, from: null });
    expect(data.performance[3].reason).toContain('completo');
    expect(data.demo).toBe(true);
  });
  it('clamps month ends and leap years to the previous calendar date', () => {
    const march = build(snapshot('2026-03-31'));
    expect(march.performance[2].from).toBe('2026-02-28');
    const leap = buildAssetOverview(snapshot('2024-02-29'), { metrics: [] }, { data: null }, now);
    expect(leap.performance[3].from).toBe('2023-02-28');
  });
  it('uses the prior available close around a non-trading day and rejects excessive gaps', () => {
    const input = snapshot();
    input.candles = input.candles.filter(
      (c) =>
        !['2026-09-16', '2026-09-15'].includes(new Date(c.time * 1000).toISOString().slice(0, 10)),
    );
    expect(build(input).performance[2].from).toBe('2026-09-14');
    input.candles = input.candles.filter(
      (c) => c.time < Date.parse('2026-09-01') / 1000 || c.time > Date.parse('2026-09-16') / 1000,
    );
    expect(build(input).performance[2].value).toBeNull();
    expect(build(input).risk.volatility).toBeNull();
  });
  it('requires provenance and a sufficient daily sample rather than showing zero risk', () => {
    const small = build(snapshot('2026-10-16', 30));
    expect(small.risk).toMatchObject({
      label: 'Sin determinar',
      volatility: null,
      maxDrawdown: null,
    });
    const untrusted = snapshot();
    untrusted.provenance.asOf = '';
    expect(build(untrusted).performance.every((p) => p.value === null)).toBe(true);
    expect(build(untrusted).technical.metrics).toBeNull();
  });
  it('calculates sample log-return volatility and closing peak-to-trough drawdown', () => {
    const input = snapshot('2026-10-16', 100);
    input.candles.forEach((c, i) => {
      c.close = i % 2 ? 80 : 100;
    });
    const risk = build(input).risk;
    expect(risk.maxDrawdown).toBeCloseTo(-20);
    expect(risk.volatility).toBeGreaterThan(400);
    expect(risk.label).toBe('Volatilidad alta');
    expect(build(snapshot('2025-10-16')).stale).toBe(true);
  });
  it('concludes only from fiscal results and comparable annual revenue, with both filing sources', () => {
    const data = normalizeStatements(secFixture(), {
      instrumentId: apple.id,
      retrievedAt: now.toISOString(),
      financialSector: false,
      delivery: 'imported-snapshot',
    });
    const overview = buildAssetOverview(
      { ...snapshot(), instrument: apple },
      { metrics: [] },
      { data },
      now,
    );
    expect(overview.fundamental.conclusion).toContain('resultado neto fue positivo');
    expect(overview.fundamental.conclusion).toContain('flujo operativo fue positivo');
    expect(overview.fundamental.revenueGrowth).toBeCloseTo((12 / 11 - 1) * 100);
    expect(overview.sources.map((s) => s.id)).toEqual(
      expect.arrayContaining(['financials', 'financials-prior']),
    );
    data.periods[1].start = '2024-04-01';
    expect(
      buildAssetOverview({ ...snapshot(), instrument: apple }, { metrics: [] }, { data }, now)
        .fundamental.revenueGrowth,
    ).toBeNull();
  });
  it('does not invent financial conclusions for missing statements, crypto, or funds', () => {
    expect(build({ ...snapshot(), instrument: apple }).fundamental.title).toBe('No concluyente');
    expect(build(snapshot()).fundamental.conclusion).toContain('no tiene beneficios empresariales');
    expect(
      build({ ...snapshot(), instrument: { ...apple, type: 'etf' } }).fundamental.conclusion,
    ).toContain('composición');
  });
});
