import { describe, expect, it } from 'vitest';
import {
  sma,
  ema,
  rsi,
  macd,
  bollinger,
  atr,
  obv,
  vwap,
  technicalMetrics,
} from '@/lib/finance/indicators';
import type { Candle } from '@/lib/market/types';
const points = (values: number[]) =>
  values.map((value, i) => ({ time: 1700000000 + i * 86400, value }));
const candles = (values: number[]): Candle[] =>
  values.map((close, i) => ({
    time: 1700000000 + i * 86400,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 10,
  }));
describe('independent numerical references', () => {
  it('SMA has a full warm-up and correct rolling windows', () => {
    expect(sma(points([1, 2, 3, 4, 5]), 3).map((p) => p.value)).toEqual([2, 3, 4]);
  });
  it('EMA seeds with an SMA, then uses 2/(n+1)', () => {
    expect(ema(points([1, 2, 3, 4, 5, 6]), 3).map((p) => p.value)).toEqual([2, 3, 4, 5]);
  });
  it('Wilder RSI matches the classic fourteen-period worked example', () => {
    const values = [
      44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61,
      46.28, 46.28, 46, 46.03, 46.41, 46.22, 45.64,
    ];
    const result = rsi(points(values), 14);
    expect(result[0].value).toBeCloseTo(70.46413502, 7);
    expect(result[1].value).toBeCloseTo(66.24961855, 7);
  });
  it('RSI handles rising, falling and constant sequences', () => {
    expect(rsi(points(Array.from({ length: 30 }, (_, i) => i + 1))).at(-1)?.value).toBe(100);
    expect(rsi(points(Array.from({ length: 30 }, (_, i) => 30 - i))).at(-1)?.value).toBe(0);
    expect(rsi(points(Array(30).fill(5))).at(-1)?.value).toBe(50);
  });
  it('MACD of a linear series has known constant separation', () => {
    const m = macd(points([1, 2, 3, 4, 5, 6, 7]), 2, 3, 2);
    expect(m.line.every((p) => p.value === 0.5)).toBe(true);
    expect(m.signal.every((p) => p.value === 0.5)).toBe(true);
    expect(m.histogram.every((p) => p.value === 0)).toBe(true);
  });
  it('Bollinger uses population variance', () => {
    const b = bollinger(points([1, 2, 3, 4, 5]), 5, 2);
    expect(b.middle[0].value).toBe(3);
    expect(b.upper[0].value).toBeCloseTo(3 + 2 * Math.sqrt(2), 12);
    expect(b.lower[0].value).toBeCloseTo(3 - 2 * Math.sqrt(2), 12);
  });
  it('ATR includes price gaps and Wilder smoothing', () => {
    const c = candles([10, 13, 12, 16, 17]);
    expect(atr(c, 2).map((p) => p.value)).toEqual([3, 4, 3]);
  });
  it('OBV signs volume using close-to-close movement', () => {
    expect(obv(candles([10, 11, 10, 10, 12])).map((p) => p.value)).toEqual([0, 10, 0, 0, 10]);
  });
  it('VWAP resets at UTC-session boundaries', () => {
    const c = candles([10, 20, 30]);
    c[0].time = Date.parse('2025-01-01T10:00:00Z') / 1000;
    c[1].time = c[0].time + 60;
    c[2].time = Date.parse('2025-01-02T10:00:00Z') / 1000;
    expect(vwap(c).map((p) => p.value)).toEqual([10, 15, 30]);
  });
  it('does not fabricate warm-up values', () => {
    expect(ema(points([1, 2]), 3)).toEqual([]);
    expect(rsi(points([1, 2]), 14)).toEqual([]);
    expect(technicalMetrics([])).toBeNull();
  });
  it('rejects invalid periods', () => {
    expect(() => ema(points([1, 2]), 0)).toThrow();
    expect(() => sma(points([1]), 1.5)).toThrow();
    expect(() => macd(points([1, 2]), 26, 12)).toThrow();
  });
});
