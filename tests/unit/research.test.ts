import { describe, expect, it } from 'vitest';
import { deterministicReport, validateNarrative } from '@/lib/ai/report';
import { demoHistory } from '@/lib/market/demo';
import { instruments } from '@/lib/market/catalog';
describe('research integrity', () => {
  const snapshot = demoHistory(instruments[0]);
  it('declares synthetic data and deterministic synthesis', () => {
    const report = deterministicReport(snapshot);
    expect(report.mode).toBe('deterministic');
    expect(report.dataStatus).toBe('demo');
    expect(report.sources[0].asOf).toContain('2025-03-14');
    expect(report.narrative.limitations.join(' ')).toContain('sintético');
    expect(report.metrics?.rsi).toBeGreaterThanOrEqual(0);
  });
  it('rejects invented and absent source references', () => {
    const narrative = deterministicReport(snapshot).narrative;
    expect(() => validateNarrative({ ...narrative, sourceIds: ['invented'] }, ['market'])).toThrow(
      'referencias',
    );
    expect(() => validateNarrative({ ...narrative, sourceIds: [] }, ['market'])).toThrow(
      'referencias',
    );
  });
  it('rejects numerical prose outside deterministic metric cards', () => {
    const narrative = deterministicReport(snapshot).narrative;
    expect(() =>
      validateNarrative({ ...narrative, summary: 'El precio llegará a 200.' }, ['market']),
    ).toThrow('cifras');
  });
  it('accepts sourced qualitative scenarios', () => {
    const narrative = deterministicReport(snapshot).narrative;
    expect(validateNarrative(narrative, ['market']).sourceIds).toEqual(['market']);
  });
  it('refuses an empty historical series', () => {
    expect(() => deterministicReport({ ...snapshot, candles: [] })).toThrow('histórico');
  });
});
describe('insufficient or stale evidence', () => {
  const snapshot = demoHistory(instruments[0]);
  it('requires indicator warm-up and market provenance', () => {
    expect(() =>
      deterministicReport({ ...snapshot, candles: snapshot.candles.slice(0, 20) }),
    ).toThrow('cincuenta');
    expect(() =>
      deterministicReport({ ...snapshot, provenance: { ...snapshot.provenance, source: '' } }),
    ).toThrow('procedencia');
  });
  it('labels stale real historical evidence', () => {
    const report = deterministicReport({
      ...snapshot,
      provenance: { ...snapshot.provenance, status: 'eod' },
    });
    expect(report.dataStatus).toBe('eod');
    expect(report.narrative.limitations.join(' ')).toContain('desactualizado');
  });
});

describe('flat-market classification', () => {
  it('does not describe equal averages as a bearish trend', () => {
    const snapshot = demoHistory(instruments[0]);
    const report = deterministicReport({
      ...snapshot,
      candles: snapshot.candles.map((c) => ({ ...c, open: 100, high: 101, low: 99, close: 100 })),
    });
    expect(report.metrics?.trend).toBe('neutral');
    expect(report.narrative.summary).toContain('mismo nivel');
    expect(report.narrative.technicalAnalysis).toContain('sin dirección definida');
  });
});
