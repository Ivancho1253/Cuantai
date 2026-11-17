import { candleSchema, type Candle, type Instrument, type Provenance } from '../market/types';
import { closePoints, ema, macd, rsi } from './indicators';

export function buildChartIndicators(
  instrument: Instrument,
  input: Candle[],
  provenance: Provenance,
  now = Date.now(),
) {
  // Today is deliberately excluded: readings only use completed daily sessions.
  const today = Math.floor(now / 86400000) * 86400;
  const candles = [
    ...new Map(
      input
        .filter((c) => candleSchema.safeParse(c).success && c.time < today)
        .map((c) => [c.time, c]),
    ).values(),
  ].sort((a, b) => a.time - b.time);
  const points = closePoints(candles);
  const strength = rsi(points, 14).at(-1)?.value ?? null;
  const convergence = macd(points, 12, 26, 9);
  const histogram = convergence.histogram.at(-1)?.value ?? null;
  const ema20 = ema(points, 20).at(-1)?.value ?? null;
  const ema50 = ema(points, 50).at(-1)?.value ?? null;
  const tolerance = (points.at(-1)?.value ?? 1) * 1e-10;
  return {
    instrument: { id: instrument.id, symbol: instrument.symbol, currency: instrument.currency },
    timeframe: '1D' as const,
    sampleSize: candles.length,
    asOf: candles.length ? new Date(candles.at(-1)!.time * 1000).toISOString() : null,
    provenance,
    rsi: {
      value: strength,
      state:
        strength === null
          ? 'unavailable'
          : strength >= 70
            ? 'overbought'
            : strength <= 30
              ? 'oversold'
              : 'neutral',
    },
    macd: {
      line: convergence.line.at(-1)?.value ?? null,
      signal: convergence.signal.at(-1)?.value ?? null,
      histogram,
      recent: convergence.histogram.slice(-20).map((p) => p.value),
      state:
        histogram === null
          ? 'unavailable'
          : Math.abs(histogram) <= tolerance
            ? 'neutral'
            : histogram > 0
              ? 'bullish'
              : 'bearish',
    },
    trend: {
      ema20,
      ema50,
      spreadPercent: ema20 !== null && ema50 !== null ? (ema20 / ema50 - 1) * 100 : null,
      state:
        ema20 === null || ema50 === null
          ? 'unavailable'
          : Math.abs(ema20 - ema50) <= tolerance
            ? 'neutral'
            : ema20 > ema50
              ? 'bullish'
              : 'bearish',
    },
  };
}
export type ChartIndicatorData = ReturnType<typeof buildChartIndicators> & { error?: string };
