import type { Instrument } from './types';

export function assetHref(instrument: Instrument, demo = false) {
  // Coin tickers are not unique. Its provider ID identifies the exact asset in URLs.
  const symbol =
    instrument.exchange === 'COINGECKO' ? instrument.providerSymbol! : instrument.symbol;
  return `/asset/${encodeURIComponent(instrument.exchange)}/${encodeURIComponent(symbol)}${demo ? '?demo=true' : ''}`;
}
