import type { ChartIndicatorData } from './chart-indicators';

/** A transparent directional summary, not a probability or a trade recommendation. */
export function technicalBias(data?: ChartIndicatorData) {
  if (
    !data ||
    data.rsi.value === null ||
    data.macd.state === 'unavailable' ||
    data.trend.state === 'unavailable'
  )
    return { score: null, label: 'Sin lectura suficiente', votes: [] as number[] };
  const direction = (state: string) => (state === 'bullish' ? 1 : state === 'bearish' ? -1 : 0);
  const votes = [
    data.rsi.value > 55 ? 1 : data.rsi.value < 45 ? -1 : 0,
    direction(data.macd.state),
    direction(data.trend.state),
  ];
  const score = Math.round((votes.reduce((sum, vote) => sum + vote, 0) / 3 + 1) * 50);
  return {
    score,
    label:
      score >= 80
        ? 'Alcista fuerte'
        : score > 60
          ? 'Alcista'
          : score <= 20
            ? 'Bajista fuerte'
            : score < 40
              ? 'Bajista'
              : 'Neutral',
    votes,
  };
}
