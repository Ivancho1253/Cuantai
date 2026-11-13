import type { Instrument, Timeframe } from './types';
export const TRADINGVIEW_SCRIPT =
  'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
export const tradingViewIntervals: Record<Timeframe, string> = {
  '1m': '1',
  '5m': '5',
  '15m': '15',
  '30m': '30',
  '1h': '60',
  '4h': '240',
  '1D': 'D',
  '1W': 'W',
  '1M': 'M',
};
export type TradingViewChartType = 'candles' | 'line' | 'area' | 'bars';
export type TradingViewWorkspaceConfig = {
  provider: 'tradingview';
  instrumentIds: string[];
  timeframe: Timeframe;
  chartType: TradingViewChartType;
};
const styles: Record<TradingViewChartType, string> = {
  candles: '1',
  line: '2',
  area: '3',
  bars: '0',
};
/** Keep the exact listing, including a certificate's ARS/USD species. Never substitute its US underlying. */
export function tradingViewSymbol(instrument: Instrument): string | null {
  if (instrument.type === 'cash' || !/^[A-Z0-9][A-Z0-9._-]{0,39}$/.test(instrument.symbol))
    return null;
  if (instrument.id === 'NYSE:SPY:USD') return 'AMEX:SPY';
  if (instrument.id === 'NYSE:DIA:USD') return 'AMEX:DIA';
  if (instrument.exchange === 'BYMA') return `BCBA:${instrument.symbol}`;
  if (instrument.exchange === 'ARCA') return `AMEX:${instrument.symbol}`;
  if (instrument.exchange === 'CBOE' && instrument.type === 'etf')
    return `BATS:${instrument.symbol}`;
  if (['NASDAQ', 'NYSE', 'AMEX', 'CBOE', 'BINANCE'].includes(instrument.exchange))
    return `${instrument.exchange}:${instrument.symbol}`;
  return null;
}
export const tradingViewChartUrl = (symbol: string) =>
  `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`;
export function tradingViewOptions(
  symbol: string,
  timeframe: Timeframe,
  chartType: TradingViewChartType,
  theme: 'dark' | 'light',
  locale: 'es' | 'en' | 'pt' = 'es',
) {
  return {
    autosize: true,
    symbol,
    interval: tradingViewIntervals[timeframe],
    theme,
    style: styles[chartType],
    locale,
    timezone: 'America/Argentina/Buenos_Aires',
    allow_symbol_change: false,
    hide_side_toolbar: false,
    hide_top_toolbar: false,
    hide_legend: false,
    hide_volume: false,
    withdateranges: true,
    save_image: true,
    calendar: false,
    details: false,
    hotlist: false,
    support_host: 'https://www.tradingview.com',
  };
}
