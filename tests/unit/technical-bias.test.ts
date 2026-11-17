import { expect, it } from 'vitest';
import { technicalBias } from '@/lib/finance/technical-bias';
import { buildChartIndicators } from '@/lib/finance/chart-indicators';
import { instruments } from '@/lib/market/catalog';

const data = () =>
  buildChartIndicators(instruments[0], [], {
    source: 'Test',
    url: '',
    asOf: '',
    retrievedAt: '',
    status: 'unavailable',
    delayMinutes: null,
    adjusted: 'unknown',
  });
it('does not assign a neutral score to missing evidence', () => {
  expect(technicalBias().score).toBeNull();
  expect(technicalBias(data()).score).toBeNull();
});
it('combines momentum, MACD and trend with equal weight and preserves disagreements', () => {
  const fixture = data();
  fixture.rsi = { value: 60, state: 'neutral' };
  fixture.macd.state = 'bullish';
  fixture.trend.state = 'bullish';
  expect(technicalBias(fixture)).toMatchObject({
    score: 100,
    label: 'Alcista fuerte',
    votes: [1, 1, 1],
  });
  fixture.rsi.value = 20;
  fixture.macd.state = 'bearish';
  fixture.trend.state = 'bearish';
  expect(technicalBias(fixture)).toMatchObject({
    score: 0,
    label: 'Bajista fuerte',
    votes: [-1, -1, -1],
  });
  fixture.rsi.value = 50;
  fixture.macd.state = 'bullish';
  fixture.trend.state = 'bearish';
  expect(technicalBias(fixture)).toMatchObject({ score: 50, label: 'Neutral', votes: [0, 1, -1] });
  fixture.rsi.value = 25;
  fixture.macd.state = 'bullish';
  fixture.trend.state = 'bullish';
  expect(technicalBias(fixture).score).toBe(67);
  fixture.macd.state = 'unavailable';
  expect(technicalBias(fixture).score).toBeNull();
});
