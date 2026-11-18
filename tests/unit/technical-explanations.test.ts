import { describe, expect, it } from 'vitest';
import { buildChartIndicators } from '@/lib/finance/chart-indicators';
import { technicalExplanations } from '@/lib/finance/technical-explanations';
import { instruments } from '@/lib/market/catalog';
import type { Candle } from '@/lib/market/types';
const now = Date.parse('2026-11-17T12:00:00Z');
const seed = (size = 21): Candle[] =>
  Array.from({ length: size }, (_, i) => ({
    time: Date.parse('2025-01-01T00:00:00Z') / 1000 + i * 86400,
    open: 100 + i,
    high: 102 + i,
    low: 98 + i,
    close: 100 + i,
    volume: 100,
  }));
const build = (candles = seed()) =>
  buildChartIndicators(
    instruments[0],
    candles,
    {
      source: 'Test',
      url: '',
      asOf: '',
      retrievedAt: '',
      status: 'eod',
      delayMinutes: 0,
      adjusted: 'unadjusted',
    },
    now,
  );
describe('support and resistance references', () => {
  it('uses the prior twenty closed sessions and excludes the latest close from the range', () => {
    const candles = seed();
    candles[20] = { ...candles[20], close: 150, high: 151 };
    const result = build(candles);
    expect(result.close).toBe(150);
    expect(result.levels.support).toBe(98);
    expect(result.levels.resistance).toBe(121);
    expect(result.levels.supportDistancePercent).toBeCloseTo((150 / 98 - 1) * 100);
    expect(result.levels.resistanceDistancePercent).toBeCloseTo((1 - 150 / 121) * 100);
    expect(result.levels.state).toBe('above_resistance');
    expect(result.levels.position).toBe(100);
    expect(result.levels.to).toBe(new Date(candles[19].time * 1000).toISOString());
    candles[20] = { ...candles[20], close: 90, low: 89 };
    const down = build(candles);
    expect(down.levels.support).toBe(98);
    expect(down.levels.state).toBe('below_support');
    expect(down.levels.position).toBe(0);
  });
  it('keeps levels unavailable until twenty reference bars plus the latest close exist', () => {
    const result = build(seed(20));
    expect(result.levels.support).toBeNull();
    expect(result.levels.resistance).toBeNull();
    expect(result.levels.state).toBe('unavailable');
    const noData = build([]);
    expect(noData.close).toBeNull();
    expect(noData.levels.position).toBeNull();
  });
  it('treats closely spaced averages as neutral and computes a long-term average only with enough history', () => {
    const candles = seed(220).map((c, i) => ({
      ...c,
      open: 100 + i * 0.0001,
      high: 101,
      low: 99,
      close: 100 + i * 0.0001,
    }));
    const data = build(candles);
    expect(data.trend.state).toBe('neutral');
    expect(data.trend.ema200).not.toBeNull();
    expect(build(seed(80)).trend.ema200).toBeNull();
  });
});
describe('beginner-friendly technical explanations', () => {
  it('separates oversold and overbought conditions from promises to buy or sell', () => {
    const data = build(seed(80));
    data.rsi = { value: 25, state: 'oversold' };
    expect(technicalExplanations(data).rsi.label).toBe('Bajista');
    expect(technicalExplanations(data).rsi.summary).toContain('impulso bajista intenso');
    expect(technicalExplanations(data).rsi.watch).toContain('presión vendedora extrema');
    data.rsi = { value: 75, state: 'overbought' };
    expect(technicalExplanations(data).rsi.label).toBe('Alcista');
    expect(technicalExplanations(data).rsi.summary).toContain('impulso alcista intenso');
    data.rsi = { value: 50, state: 'neutral' };
    expect(technicalExplanations(data).rsi.label).toBe('Neutral');
  });
  it('explains improving momentum below zero without calling it a confirmed uptrend', () => {
    const data = build();
    data.macd.state = 'bullish';
    data.macd.line = -2;
    const result = technicalExplanations(data).macd;
    expect(result.summary).toContain('mejora el impulso');
    expect(result.summary).toContain('tendencia de fondo débil');
    expect(result.watch).toContain('lecturas distintas');
  });
  it('does not invent a direction or support when data is missing', () => {
    for (const reading of Object.values(technicalExplanations()))
      expect(reading.label).toBe('No disponible');
    expect(technicalExplanations(build([])).levels.label).toBe('No disponible');
  });
});

describe('technical horizons', () => {
  it('recomputes momentum, moving averages and range rather than relabeling the same reading', () => {
    const input = seed(300);
    const short = build(input);
    const medium = buildChartIndicators(instruments[0], input, short.provenance, now, 'medium');
    const long = buildChartIndicators(instruments[0], input, short.provenance, now, 'long');
    expect(short.horizon).toBe('short');
    expect(short.config.fast).toBe(20);
    expect(medium.config.fast).toBe(50);
    expect(long.config.slow).toBe(200);
    expect(long.trend.slow).toBe(long.trend.ema200);
    expect(long.levels.lookback).toBe(200);
    expect(long.levels.support).toBeLessThan(short.levels.support!);
    expect(medium.macd.histogram).not.toBe(short.macd.histogram);
    expect(long.trend.ema200).toBe(short.trend.ema200);
  });
});
