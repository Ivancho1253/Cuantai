import type { Candle } from '../market/types';
export type Point = { time: number; value: number };
export type IndicatorKind = 'SMA' | 'EMA' | 'RSI' | 'MACD' | 'BB' | 'ATR' | 'OBV' | 'VWAP';
export type IndicatorConfig = {
  id: string;
  kind: IndicatorKind;
  period: number;
  color: string;
  visible: boolean;
};
const validPeriod = (period: number) => {
  if (!Number.isInteger(period) || period < 1 || period > 2000)
    throw new Error('Period must be an integer between 1 and 2000');
};
export function sma(data: Point[], period: number): Point[] {
  validPeriod(period);
  let sum = 0;
  return data.flatMap((p, i) => {
    sum += p.value;
    if (i >= period) sum -= data[i - period].value;
    return i < period - 1 ? [] : [{ time: p.time, value: sum / period }];
  });
}
export function ema(data: Point[], period: number): Point[] {
  validPeriod(period);
  if (data.length < period) return [];
  let avg = data.slice(0, period).reduce((a, p) => a + p.value, 0) / period;
  const result = [{ time: data[period - 1].time, value: avg }];
  const alpha = 2 / (period + 1);
  for (let i = period; i < data.length; i++) {
    avg = data[i].value * alpha + avg * (1 - alpha);
    result.push({ time: data[i].time, value: avg });
  }
  return result;
}
export function rsi(data: Point[], period = 14): Point[] {
  validPeriod(period);
  if (data.length <= period) return [];
  let gain = 0,
    loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = data[i].value - data[i - 1].value;
    gain += Math.max(0, d);
    loss += Math.max(0, -d);
  }
  gain /= period;
  loss /= period;
  const value = () =>
    gain === 0 && loss === 0 ? 50 : loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  const out = [{ time: data[period].time, value: value() }];
  for (let i = period + 1; i < data.length; i++) {
    const d = data[i].value - data[i - 1].value;
    gain = (gain * (period - 1) + Math.max(0, d)) / period;
    loss = (loss * (period - 1) + Math.max(0, -d)) / period;
    out.push({ time: data[i].time, value: value() });
  }
  return out;
}
export function macd(data: Point[], fast = 12, slow = 26, signal = 9) {
  if (fast >= slow) throw new Error('Fast period must be below slow');
  const fastMap = new Map(ema(data, fast).map((p) => [p.time, p.value]));
  const line = ema(data, slow).map((p) => ({
    time: p.time,
    value: fastMap.get(p.time)! - p.value,
  }));
  const sig = ema(line, signal);
  const byTime = new Map(line.map((p) => [p.time, p.value]));
  return {
    line,
    signal: sig,
    histogram: sig.map((p) => ({ time: p.time, value: byTime.get(p.time)! - p.value })),
  };
}
export function bollinger(data: Point[], period = 20, multiplier = 2) {
  const middle = sma(data, period);
  return {
    middle,
    upper: middle.map((p, i) => ({
      time: p.time,
      value:
        p.value +
        multiplier *
          Math.sqrt(
            data.slice(i, i + period).reduce((s, x) => s + (x.value - p.value) ** 2, 0) / period,
          ),
    })),
    lower: middle.map((p, i) => ({
      time: p.time,
      value:
        p.value -
        multiplier *
          Math.sqrt(
            data.slice(i, i + period).reduce((s, x) => s + (x.value - p.value) ** 2, 0) / period,
          ),
    })),
  };
}
export function atr(candles: Candle[], period = 14): Point[] {
  validPeriod(period);
  const tr = candles.slice(1).map((c, i) => ({
    time: c.time,
    value: Math.max(
      c.high - c.low,
      Math.abs(c.high - candles[i].close),
      Math.abs(c.low - candles[i].close),
    ),
  }));
  if (tr.length < period) return [];
  let avg = tr.slice(0, period).reduce((a, p) => a + p.value, 0) / period;
  const out = [{ time: tr[period - 1].time, value: avg }];
  for (let i = period; i < tr.length; i++) {
    avg = (avg * (period - 1) + tr[i].value) / period;
    out.push({ time: tr[i].time, value: avg });
  }
  return out;
}
export function obv(candles: Candle[]): Point[] {
  let value = 0;
  return candles.map((c, i) => {
    if (i) value += Math.sign(c.close - candles[i - 1].close) * c.volume;
    return { time: c.time, value };
  });
}
// UTC-session VWAP, intentionally unavailable on daily or longer intervals in the UI.
export function vwap(candles: Candle[]): Point[] {
  let total = 0,
    volume = 0,
    day = '';
  return candles.flatMap((c) => {
    const current = new Date(c.time * 1000).toISOString().slice(0, 10);
    if (day !== current) {
      day = current;
      total = 0;
      volume = 0;
    }
    total += ((c.high + c.low + c.close) / 3) * c.volume;
    volume += c.volume;
    return volume ? [{ time: c.time, value: total / volume }] : [];
  });
}
export const closePoints = (candles: Candle[]): Point[] =>
  candles.map((c) => ({ time: c.time, value: c.close }));
export function technicalMetrics(candles: Candle[]) {
  const p = closePoints(candles);
  const last = candles.at(-1);
  if (!last) return null;
  const recent = candles.slice(-20);
  const e20 = ema(p, 20).at(-1)?.value ?? null;
  const e50 = ema(p, 50).at(-1)?.value ?? null;
  return {
    close: last.close,
    ema20: e20,
    ema50: e50,
    ema200: ema(p, 200).at(-1)?.value ?? null,
    rsi: rsi(p).at(-1)?.value ?? null,
    macd: macd(p).histogram.at(-1)?.value ?? null,
    atr: atr(candles).at(-1)?.value ?? null,
    support: Math.min(...recent.map((c) => c.low)),
    resistance: Math.max(...recent.map((c) => c.high)),
    trend:
      e20 !== null && e50 !== null
        ? Math.abs(e20 - e50) <= Math.max(Math.abs(e20), Math.abs(e50)) * 1e-10
          ? 'neutral'
          : e20 > e50
            ? 'uptrend'
            : 'downtrend'
        : 'unavailable',
  };
}
export const defaultIndicators: IndicatorConfig[] = [
  { id: 'ema20', kind: 'EMA', period: 20, color: '#c8ef84', visible: true },
  { id: 'ema50', kind: 'EMA', period: 50, color: '#b79aff', visible: true },
  { id: 'ema200', kind: 'EMA', period: 200, color: '#6c9fe8', visible: false },
  { id: 'rsi', kind: 'RSI', period: 14, color: '#ba9aef', visible: true },
  { id: 'macd', kind: 'MACD', period: 26, color: '#60b4df', visible: true },
];
