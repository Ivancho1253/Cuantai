import type { Instrument } from './types';
import catalogLogos from './data/asset-logos.json';

export type AssetLogo = { src: string; name: string; background: string; source: string };
export const CRYPTO_LOGO_REVISION = '1a63530be6e374711a8554f31b17e4cb92c25fa5';
const stockSource = 'https://site.financialmodelingprep.com/developer/docs/company-image-api';
const cryptoSource = `https://github.com/spothq/cryptocurrency-icons/tree/${CRYPTO_LOGO_REVISION}`;
const local = (
  file: string,
  name: string,
  source = stockSource,
  background = '#ffffff',
): AssetLogo => ({ src: `/asset-logos/${file}`, name, source, background });

// Exact listing identities prevent local tickers / USD CEDEAR suffixes from naming another issuer.
const logos: Record<string, AssetLogo> = {
  'NASDAQ:NVDA:USD': local('nvda.png', 'NVIDIA'),
  'NASDAQ:AAPL:USD': local('aapl.png', 'Apple'),
  'NASDAQ:MSFT:USD': local('msft.png', 'Microsoft'),
  'NASDAQ:GOOGL:USD': local('googl.png', 'Alphabet / Google'),
  'NASDAQ:AMZN:USD': local('amzn.png', 'Amazon'),
  'NASDAQ:META:USD': local('meta.png', 'Meta'),
  'NASDAQ:TSLA:USD': local('tsla.png', 'Tesla'),
  'NYSE:JPM:USD': local('jpm.png', 'JPMorgan Chase'),
  'NYSE:BRK.B:USD': local('brk-b.png', 'Berkshire Hathaway'),
  'NYSE:KO:USD': local('ko.png', 'Coca-Cola'),
  'NYSE:SPY:USD': local('spy.png', 'SPDR · SPY'),
  'AMEX:SPY:USD': local('spy.png', 'SPDR · SPY'),
  'ARCA:SPY:USD': local('spy.png', 'SPDR · SPY'),
  'NASDAQ:QQQ:USD': local('qqq.png', 'Invesco · QQQ', stockSource, '#07234a'),
  'NYSE:DIA:USD': local('dia.png', 'SPDR · DIA'),
  'AMEX:DIA:USD': local('dia.png', 'SPDR · DIA'),
  'ARCA:DIA:USD': local('dia.png', 'SPDR · DIA'),
  'BYMA:GGAL:ARS': local('ggal-ba.png', 'Grupo Financiero Galicia'),
  'BINANCE:BTCUSDT:USDT': local('btc.svg', 'Bitcoin', cryptoSource),
  'BINANCE:ETHUSDT:USDT': local('eth.svg', 'Ethereum', cryptoSource),
  'BINANCE:SOLUSDT:USDT': local('sol.svg', 'Solana', cryptoSource),
  'CASH:USDT:USDT': local('usdt.svg', 'Tether USDT', cryptoSource),
  'CASH:USD:USD': local('usd.svg', 'Dólar estadounidense', cryptoSource),
  'CASH:EUR:EUR': local('eur.svg', 'Euro', cryptoSource),
  'CASH:ARS:ARS': local('ars.svg', 'Peso argentino', 'Cuantai · símbolo monetario'),
};

export function assetLogo(instrument: Instrument): AssetLogo | null {
  const identity = instrument.type === 'cedear' ? instrument.underlyingId : instrument.id;
  if (!identity) return null;
  const [exchange, symbol, currency, extra] = identity.split(':');
  if (extra !== undefined || !exchange || !symbol || !currency) return null;
  const known = logos[identity];
  if (known) return known;
  const stored = (
    catalogLogos as Record<string, { src: string; source: string; background?: string }>
  )[identity];
  if (stored)
    return {
      ...stored,
      name: instrument.name.replace(/ · CEDEAR.*$/, ''),
      background: stored.background ?? '#ffffff',
    };
  if (!/^[A-Z0-9][A-Z0-9.-]{0,24}$/.test(symbol)) return null;
  const corporate = ['stock', 'etf', 'cedear'].includes(instrument.type);
  if (
    corporate &&
    currency === 'USD' &&
    ['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'CBOE'].includes(exchange)
  )
    return {
      src: `https://images.financialmodelingprep.com/symbol/${symbol === 'BRK-B' ? 'BRK.B' : symbol}.png`,
      name: instrument.name.replace(/ · CEDEAR.*$/, ''),
      background: '#ffffff',
      source: stockSource,
    };
  // Only native BYMA stocks get .BA. A certificate always resolves its explicit underlying above.
  if (instrument.type === 'stock' && exchange === 'BYMA' && currency === 'ARS')
    return {
      src: `https://images.financialmodelingprep.com/symbol/${symbol}.BA.png`,
      name: instrument.name,
      background: '#ffffff',
      source: stockSource,
    };
  if (
    instrument.type === 'crypto' &&
    exchange === 'BINANCE' &&
    currency === 'USDT' &&
    symbol.endsWith('USDT') &&
    symbol.length > 4
  )
    return {
      src: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@${CRYPTO_LOGO_REVISION}/svg/color/${symbol.slice(0, -4).toLowerCase()}.svg`,
      name: instrument.name,
      background: '#ffffff',
      source: cryptoSource,
    };
  return null;
}
