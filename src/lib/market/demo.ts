import type { Candle, Instrument, MarketSnapshot, Timeframe } from './types';
import { findInstrument } from './catalog';
export const DEMO_AS_OF = '2025-03-14T20:00:00.000Z';
const bases: Record<string, number> = {
  NVDA: 121.67,
  AAPL: 213.07,
  MSFT: 388.56,
  GOOGL: 165.49,
  AMZN: 198.15,
  META: 607.6,
  TSLA: 249.98,
  JPM: 232.9,
  'BRK.B': 513.6,
  KO: 69.03,
  SPY: 562.81,
  QQQ: 479.66,
  DIA: 414.88,
  BTCUSDT: 84213.5,
  ETHUSDT: 1924.63,
  SOLUSDT: 134.68,
  GGAL: 5980,
};
export function demoHistory(instrument: Instrument, timeframe: Timeframe = '1D'): MarketSnapshot {
  if (
    !findInstrument(instrument.id) ||
    (!(instrument.symbol in bases) && instrument.type !== 'cedear')
  )
    return {
      instrument,
      candles: [],
      quote: null,
      timeframe,
      provenance: {
        source: 'Cuantai demo · sin muestra para este activo',
        url: '/data-policy',
        asOf: '',
        retrievedAt: DEMO_AS_OF,
        status: 'unavailable',
        delayMinutes: null,
        adjusted: 'unknown',
      },
      error:
        'Este activo no tiene una cotización de demostración. Consultá el mercado fuera de la demo.',
    };
  let seed = [...instrument.id].reduce((a, c) => a + c.charCodeAt(0) * 71, 11);
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const last =
    instrument.exchange === 'BYMA' && instrument.type === 'cedear'
      ? instrument.currency === 'ARS'
        ? 14650
        : 12.5
      : bases[instrument.symbol];
  const seconds: Record<Timeframe, number> = {
    '1m': 60,
    '5m': 300,
    '15m': 900,
    '30m': 1800,
    '1h': 3600,
    '4h': 14400,
    '1D': 86400,
    '1W': 604800,
    '1M': 2592000,
  };
  // All synthetic intervals are explicitly demo. Daily/week/month fixtures use calendar boundaries.
  let price = last * 0.73;
  const candles: Candle[] = [];
  for (let n = 0; n < 280; n++) {
    const open = price;
    const drift = 0.0015 + Math.sin(n / 11) * 0.004;
    const close = open * (1 + drift + (random() - 0.49) * 0.032);
    const d = new Date(DEMO_AS_OF);
    if (timeframe === '1M') {
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() - (279 - n));
      d.setUTCHours(0, 0, 0, 0);
    } else {
      d.setTime(d.getTime() - (279 - n) * seconds[timeframe] * 1000);
      if (timeframe === '1D' || timeframe === '1W') d.setUTCHours(0, 0, 0, 0);
    }
    candles.push({
      time: Math.floor(d.getTime() / 1000),
      open,
      high: Math.max(open, close) * (1 + random() * 0.014),
      low: Math.min(open, close) * (1 - random() * 0.014),
      close,
      volume: Math.round(500000 + random() * 8000000),
    });
    price = close;
  }
  const scale = last / candles.at(-1)!.close;
  for (const c of candles) {
    c.open *= scale;
    c.high *= scale;
    c.low *= scale;
    c.close *= scale;
  }
  const provenance = {
    source: 'Cuantai synthetic dataset v1',
    url: '/data-policy',
    asOf: DEMO_AS_OF,
    retrievedAt: DEMO_AS_OF,
    status: 'demo' as const,
    delayMinutes: null,
    adjusted: 'unadjusted' as const,
  };
  const prev = candles.at(-2)!.close;
  return {
    instrument,
    candles,
    timeframe,
    provenance,
    quote: {
      ...provenance,
      instrumentId: instrument.id,
      currency: instrument.currency,
      price: last.toFixed(2),
      changePercent: ((last / prev - 1) * 100).toFixed(2),
      volume: String(candles.at(-1)!.volume),
    },
  };
}
