import { z } from 'zod';
import Decimal from 'decimal.js';
import { cached, fetchJson } from './transport';
import { ProviderError, type Instrument, type Quote, type Timeframe } from './types';

// Public indicative quotes. Never present them as an authorized BYMA feed or
// substitute a US underlying for the local certificate.
export function yahooSymbol(i: Instrument) {
  if (i.exchange === 'BYMA' && i.currency === 'ARS' && ['stock', 'cedear'].includes(i.type))
    return `${i.symbol}.BA`;
  if (['NASDAQ', 'NYSE', 'AMEX', 'ARCA', 'CBOE'].includes(i.exchange) && i.currency === 'USD')
    return i.symbol.replace('.', '-');
  throw new ProviderError('No hay cobertura pública verificada para esta especie y moneda.');
}
const metaSchema = z.object({
  symbol: z.string(),
  currency: z.string(),
  exchangeName: z.string(),
  regularMarketPrice: z.number().positive(),
  regularMarketTime: z.number().positive(),
  chartPreviousClose: z.number().positive(),
  regularMarketVolume: z.number().nonnegative().optional(),
});
let active = 0;
const waiting: Array<() => void> = [];
async function limited<T>(load: () => Promise<T>) {
  if (active >= 4) await new Promise<void>((resolve) => waiting.push(resolve));
  else active++;
  try {
    return await load();
  } finally {
    const next = waiting.shift();
    if (next) next();
    else active--;
  }
}
export class YahooProvider {
  async quote(i: Instrument): Promise<Quote> {
    const symbol = yahooSymbol(i);
    return cached(`yahoo:quote:${i.id}`, 120000, () =>
      limited(async () => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
        const data = z
          .object({
            chart: z.object({ result: z.array(z.object({ meta: metaSchema })).nullable() }),
          })
          .safeParse(await fetchJson(url));
        if (!data.success)
          throw new ProviderError(
            'La fuente pública no devolvió una cotización verificable para este activo.',
          );
        const m = data.data.chart.result?.[0]?.meta;
        if (!m || m.currency !== i.currency || m.symbol.toUpperCase() !== symbol.toUpperCase())
          throw new ProviderError('La fuente no confirmó la especie y moneda solicitadas.');
        const allowed: Record<string, string[]> = {
          NASDAQ: ['NMS', 'NGM', 'NCM'],
          NYSE: ['NYQ'],
          BYMA: ['BUE'],
          AMEX: ['ASE', 'PCX'],
          ARCA: ['PCX'],
          CBOE: ['BTS', 'BATS'],
        };
        if (!allowed[i.exchange]?.includes(m.exchangeName))
          throw new ProviderError('El mercado devuelto no coincide con la especie solicitada.');
        return {
          instrumentId: i.id,
          currency: i.currency,
          price: new Decimal(m.regularMarketPrice).toFixed(),
          changePercent: new Decimal(m.regularMarketPrice)
            .div(m.chartPreviousClose)
            .minus(1)
            .mul(100)
            .toFixed(),
          volume: m.regularMarketVolume === undefined ? null : String(m.regularMarketVolume),
          source: 'Yahoo Finance · cotización pública indicativa',
          url: `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/`,
          asOf: new Date(m.regularMarketTime * 1000).toISOString(),
          retrievedAt: new Date().toISOString(),
          status: 'delayed',
          delayMinutes: null,
          adjusted: 'unknown',
          stale: Date.now() - m.regularMarketTime * 1000 > 4 * 86400000,
        };
      }),
    );
  }
  async history(_i: Instrument, timeframe: Timeframe): Promise<never> {
    throw new ProviderError(
      `Historial ${timeframe} sin proveedor configurado. La cotización pública se consulta por separado.`,
    );
  }
}
