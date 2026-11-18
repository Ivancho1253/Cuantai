import { candleSchema, type Candle, type Instrument, type Provenance } from '../market/types';
import { closePoints, ema, macd, rsi } from './indicators';

export const technicalHorizons = {
  short: { label: 'Corto plazo', rsi: 14, macd: [12, 26, 9], fast: 20, slow: 50, lookback: 20 },
  medium: { label: 'Mediano plazo', rsi: 21, macd: [19, 39, 9], fast: 50, slow: 100, lookback: 60 },
  long: { label: 'Largo plazo', rsi: 28, macd: [50, 100, 20], fast: 50, slow: 200, lookback: 200 },
} as const;
export type TechnicalHorizon = keyof typeof technicalHorizons;

export function buildChartIndicators(
  instrument: Instrument,
  input: Candle[],
  provenance: Provenance,
  now = Date.now(),
  horizon: TechnicalHorizon = 'short',
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
  const config = technicalHorizons[horizon];
  const points = closePoints(candles);
  const strength = rsi(points, config.rsi).at(-1)?.value ?? null;
  const convergence = macd(points, ...config.macd);
  const histogram = convergence.histogram.at(-1)?.value ?? null;
  const ema20 = ema(points, 20).at(-1)?.value ?? null;
  const ema50 = ema(points, 50).at(-1)?.value ?? null;
  const ema200 = ema(points, 200).at(-1)?.value ?? null;
  const close = candles.at(-1)?.close ?? null;
  const fast = ema(points, config.fast).at(-1)?.value ?? null;
  const slow = ema(points, config.slow).at(-1)?.value ?? null;
  const spreadPercent = fast !== null && slow !== null ? (fast / slow - 1) * 100 : null;
  // References exclude the latest bar, so a new breakout can actually be detected.
  const reference = candles.slice(-config.lookback - 1, -1);
  const support =
    reference.length === config.lookback ? Math.min(...reference.map((c) => c.low)) : null;
  const resistance =
    reference.length === config.lookback ? Math.max(...reference.map((c) => c.high)) : null;
  const supportDistance =
    close !== null && support !== null ? ((close - support) / support) * 100 : null;
  const resistanceDistance =
    close !== null && resistance !== null ? ((resistance - close) / resistance) * 100 : null;
  const nearSupport = close !== null && support !== null && ((close - support) / close) * 100 <= 1;
  const nearResistance =
    close !== null && resistance !== null && ((resistance - close) / close) * 100 <= 1;
  const tolerance = (points.at(-1)?.value ?? 1) * 1e-10;
  return {
    instrument: { id: instrument.id, symbol: instrument.symbol, currency: instrument.currency },
    timeframe: '1D' as const,
    horizon,
    config,
    sampleSize: candles.length,
    close,
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
      fast,
      slow,
      ema20,
      ema50,
      ema200,
      spreadPercent,
      state:
        fast === null || slow === null
          ? 'unavailable'
          : Math.abs(spreadPercent!) <= 0.5
            ? 'neutral'
            : fast > slow
              ? 'bullish'
              : 'bearish',
    },
    levels: {
      lookback: config.lookback,
      observations: reference.length,
      support,
      resistance,
      supportDistancePercent: supportDistance,
      resistanceDistancePercent: resistanceDistance,
      from: reference.length ? new Date(reference[0].time * 1000).toISOString() : null,
      to: reference.length ? new Date(reference.at(-1)!.time * 1000).toISOString() : null,
      position:
        close !== null && support !== null && resistance !== null
          ? resistance === support
            ? 50
            : Math.max(0, Math.min(100, ((close - support) / (resistance - support)) * 100))
          : null,
      state:
        close === null || support === null || resistance === null
          ? 'unavailable'
          : close < support - tolerance
            ? 'below_support'
            : close > resistance + tolerance
              ? 'above_resistance'
              : nearSupport && nearResistance
                ? 'within_range'
                : nearSupport
                  ? 'near_support'
                  : nearResistance
                    ? 'near_resistance'
                    : 'within_range',
    },
  };
}
export type ChartIndicatorData = ReturnType<typeof buildChartIndicators> & { error?: string };
