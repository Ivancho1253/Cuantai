import { describe, expect, it } from 'vitest';
import { instruments } from '@/lib/market/catalog';
import { tradingViewSymbol, tradingViewOptions } from '@/lib/market/tradingview';
import { workspaceSchema } from '@/lib/validation';
const instrument = (id: string) => instruments.find((i) => i.id === id)!;
describe('TradingView listing and opening configuration', () => {
  it('keeps the US stock, ARS certificate and USD certificate distinct', () => {
    expect(tradingViewSymbol(instrument('NYSE:JPM:USD'))).toBe('NYSE:JPM');
    expect(tradingViewSymbol(instrument('BYMA:JPM:ARS'))).toBe('BCBA:JPM');
    expect(tradingViewSymbol(instrument('BYMA:JPMD:USD'))).toBe('BCBA:JPMD');
    expect(tradingViewSymbol(instrument('BYMA:AAPLD:USD'))).toBe('BCBA:AAPLD');
  });
  it('uses documented ETF identifiers and keeps share classes and USDT pairs', () => {
    expect(tradingViewSymbol(instrument('NYSE:SPY:USD'))).toBe('AMEX:SPY');
    expect(tradingViewSymbol(instrument('NYSE:DIA:USD'))).toBe('AMEX:DIA');
    expect(tradingViewSymbol(instrument('NYSE:BRK.B:USD'))).toBe('NYSE:BRK.B');
    expect(tradingViewSymbol(instrument('BINANCE:BTCUSDT:USDT'))).toBe('BINANCE:BTCUSDT');
  });
  it('does not fabricate a replacement for cash or an unknown exchange', () => {
    expect(tradingViewSymbol(instrument('CASH:USD:USD'))).toBeNull();
    expect(tradingViewSymbol({ ...instruments[0], exchange: 'UNVERIFIED' })).toBeNull();
    expect(tradingViewSymbol({ ...instruments[0], symbol: '<invalid>' })).toBeNull();
  });
  it('distinguishes minute, month and hour resolutions and supplies no local datafeed', () => {
    const options = tradingViewOptions('NASDAQ:AAPL', '1m', 'candles', 'dark');
    expect(options.interval).toBe('1');
    expect(tradingViewOptions('NASDAQ:AAPL', '1M', 'line', 'light').interval).toBe('M');
    expect(tradingViewOptions('BINANCE:BTCUSDT', '4h', 'area', 'dark').interval).toBe('240');
    expect(options.hide_side_toolbar).toBe(false);
    expect(options).not.toHaveProperty('datafeed');
    expect(options).not.toHaveProperty('candles');
  });
  it('persists only supported TradingView opening settings and rejects fake internal saves', () => {
    const config = {
      provider: 'tradingview',
      instrumentIds: ['BINANCE:BTCUSDT:USDT'],
      timeframe: '1D',
      chartType: 'candles',
    };
    expect(workspaceSchema.parse({ name: 'TradingView', config }).config).toEqual(config);
    expect(
      workspaceSchema.safeParse({ name: 'x', config: { ...config, drawings: [] } }).success,
    ).toBe(false);
    expect(
      workspaceSchema.safeParse({
        name: 'x',
        config: { ...config, instrumentIds: Array(5).fill('x') },
      }).success,
    ).toBe(false);
  });
});
