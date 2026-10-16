import type { Instrument } from './types';
// A curated discovery seed, NOT an index constituent list. Live search extends it.
export const instruments: Instrument[] = [
  ['NASDAQ', 'NVDA', 'NVIDIA Corporation', 'USD', 'stock', 'US', 'Technology', '#86c853'],
  ['NASDAQ', 'AAPL', 'Apple Inc.', 'USD', 'stock', 'US', 'Technology', '#b5b9c3'],
  ['NASDAQ', 'MSFT', 'Microsoft Corporation', 'USD', 'stock', 'US', 'Technology', '#6da9ff'],
  ['NASDAQ', 'GOOGL', 'Alphabet Inc.', 'USD', 'stock', 'US', 'Communication', '#e8ab59'],
  ['NASDAQ', 'AMZN', 'Amazon.com, Inc.', 'USD', 'stock', 'US', 'Consumer cyclical', '#e8a762'],
  ['NASDAQ', 'META', 'Meta Platforms, Inc.', 'USD', 'stock', 'US', 'Communication', '#739cf4'],
  ['NASDAQ', 'TSLA', 'Tesla, Inc.', 'USD', 'stock', 'US', 'Consumer cyclical', '#e7777f'],
  ['NYSE', 'JPM', 'JPMorgan Chase & Co.', 'USD', 'stock', 'US', 'Financials', '#8d9ddc'],
  ['NYSE', 'BRK.B', 'Berkshire Hathaway Inc.', 'USD', 'stock', 'US', 'Financials', '#a5a0cb'],
  ['NYSE', 'KO', 'The Coca-Cola Company', 'USD', 'stock', 'US', 'Consumer defensive', '#ed7885'],
  ['NYSE', 'SPY', 'SPDR S&P 500 ETF · proxy', 'USD', 'etf', 'US', 'Diversified', '#5b9ad4'],
  ['NASDAQ', 'QQQ', 'Invesco Nasdaq-100 ETF · proxy', 'USD', 'etf', 'US', 'Diversified', '#ad8bdc'],
  ['NYSE', 'DIA', 'SPDR Dow Jones ETF · proxy', 'USD', 'etf', 'US', 'Diversified', '#dbb667'],
  ['BINANCE', 'BTCUSDT', 'Bitcoin / Tether', 'USDT', 'crypto', 'Global', 'Crypto', '#f4b565'],
  ['BINANCE', 'ETHUSDT', 'Ethereum / Tether', 'USDT', 'crypto', 'Global', 'Crypto', '#a4a5ef'],
  ['BINANCE', 'SOLUSDT', 'Solana / Tether', 'USDT', 'crypto', 'Global', 'Crypto', '#a68ade'],
  ['BYMA', 'JPM', 'JPMorgan Chase · CEDEAR', 'ARS', 'cedear', 'AR', 'Financials', '#8d9ddc'],
  ['BYMA', 'JPMD', 'JPMorgan Chase · CEDEAR USD', 'USD', 'cedear', 'AR', 'Financials', '#8d9ddc'],
  ['BYMA', 'AAPL', 'Apple · CEDEAR', 'ARS', 'cedear', 'AR', 'Technology', '#b5b9c3'],
  ['BYMA', 'AAPLD', 'Apple · CEDEAR USD', 'USD', 'cedear', 'AR', 'Technology', '#b5b9c3'],
  ['BYMA', 'GGAL', 'Grupo Financiero Galicia', 'ARS', 'stock', 'AR', 'Financials', '#8fc0e8'],
  ['CASH', 'USD', 'US dollar · cash', 'USD', 'cash', 'US', 'Cash', '#91bca7'],
  ['CASH', 'ARS', 'Peso argentino · efectivo', 'ARS', 'cash', 'AR', 'Cash', '#8fc0e8'],
  [
    'CASH',
    'USDT',
    'Tether USDT · saldo de stablecoin',
    'USDT',
    'cash',
    'Global',
    'Stablecoin',
    '#67bca6',
  ],
  ['CASH', 'EUR', 'Euro · cash', 'EUR', 'cash', 'EU', 'Cash', '#8cabc9'],
].map(([exchange, symbol, name, currency, type, country, sector, color]) => ({
  id: `${exchange}:${symbol}:${currency}`,
  exchange,
  symbol,
  name,
  currency,
  type,
  country,
  sector,
  color,
  source: 'Cuantai discovery catalog',
  ...(type === 'cedear'
    ? { underlyingId: symbol.startsWith('JPM') ? 'NYSE:JPM:USD' : 'NASDAQ:AAPL:USD' }
    : {}),
})) as Instrument[];
export const findInstrument = (id: string) => instruments.find((i) => i.id === id);
export const searchCatalog = (query: string) =>
  instruments.filter((i) =>
    `${i.symbol} ${i.name} ${i.exchange} ${i.currency} ${i.sector}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
