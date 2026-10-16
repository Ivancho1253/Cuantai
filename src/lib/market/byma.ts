import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  candleSchema,
  ProviderError,
  type Instrument,
  type QuoteProvider,
  type HistoricalDataProvider,
  type Timeframe,
} from './types';
// Contracted BYMA API versions are not public JSON contracts. This adapter accepts
// authorized normalized exports; it never guesses an undocumented endpoint or scrapes BYMA.
export const bymaExportSchema = z.object({
  source: z.string().min(3),
  sourceUrl: z.url().refine((value) => /^https?:\/\//.test(value)),
  retrievedAt: z.iso.datetime(),
  status: z.enum(['eod', 'delayed', 'realtime']),
  delayMinutes: z.number().nonnegative().nullable(),
  quotes: z.array(
    z.object({
      instrumentId: z.string(),
      currency: z.enum(['ARS', 'USD']),
      price: z.string().regex(/^\d+(\.\d+)?$/),
      changePercent: z.string().regex(/^-?\d+(\.\d+)?$/),
      volume: z.string().nullable(),
      asOf: z.iso.datetime(),
    }),
  ),
  histories: z
    .array(
      z.object({
        instrumentId: z.string(),
        timeframe: z.enum(['1D', '1W', '1M']),
        adjusted: z.enum(['split', 'unadjusted', 'unknown']),
        candles: z.array(candleSchema),
      }),
    )
    .default([]),
});
export class BymaProvider implements QuoteProvider, HistoricalDataProvider {
  async data() {
    if (!process.env.BYMA_AUTHORIZED_DATA_FILE)
      throw new ProviderError(
        'BYMA sin feed autorizado. Podés cargar precios manuales en tu cartera.',
        'CREDENTIALS',
      );
    return bymaExportSchema.parse(
      JSON.parse(await readFile(process.env.BYMA_AUTHORIZED_DATA_FILE, 'utf8')),
    );
  }
  async quote(i: Instrument) {
    const data = await this.data();
    const q = data.quotes.find((q) => q.instrumentId === i.id);
    if (!q) throw new ProviderError('El archivo autorizado no contiene esta especie BYMA.');
    if (q.currency !== i.currency || Number(q.price) <= 0)
      throw new ProviderError('Precio o moneda BYMA inválidos.');
    return {
      ...q,
      source: data.source,
      url: data.sourceUrl,
      retrievedAt: data.retrievedAt,
      status: data.status,
      delayMinutes: data.delayMinutes,
      adjusted: 'unknown' as const,
    };
  }
  async history(i: Instrument, tf: Timeframe) {
    const data = await this.data();
    const history = data.histories.find((h) => h.instrumentId === i.id && h.timeframe === tf);
    if (!history?.candles.length)
      throw new ProviderError('Histórico BYMA no disponible para esta temporalidad.');
    return {
      candles: history.candles,
      provenance: {
        source: data.source,
        url: data.sourceUrl,
        asOf: new Date(history.candles.at(-1)!.time * 1000).toISOString(),
        retrievedAt: data.retrievedAt,
        status: data.status,
        delayMinutes: data.delayMinutes,
        adjusted: history.adjusted,
      },
    };
  }
}
