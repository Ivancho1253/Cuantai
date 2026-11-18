import { z } from 'zod';
import { cached, fetchJson } from './transport';
import type { Instrument } from './types';
export type EarningsComparison = {
  period: string;
  reportedAt: string;
  actual: number;
  estimate: number;
  surprisePercent: number | null;
  source: string;
  url: string;
  currency: 'USD';
};
const numeric = z
  .union([
    z.number().finite(),
    z
      .string()
      .regex(/^-?\d+(?:\.\d+)?$/)
      .transform(Number),
  ])
  .refine(Number.isFinite);
const schema = z.object({
  data: z.object({
    symbol: z.string(),
    earningsSurpriseTable: z.object({
      rows: z.array(
        z.object({
          fiscalQtrEnd: z.string().min(1).max(40),
          dateReported: z.string().regex(/^\d{1,2}\/\d{1,2}\/\d{4}$/),
          eps: numeric,
          consensusForecast: numeric,
        }),
      ),
    }),
  }),
});
export function parseEarningsComparison(
  input: unknown,
  symbol: string,
  now = Date.now(),
): EarningsComparison | null {
  const d = schema.parse(input).data;
  if (d.symbol.toUpperCase() !== symbol.toUpperCase())
    throw Error('El emisor de resultados no coincide.');
  const rows = d.earningsSurpriseTable.rows.flatMap((row) => {
    const [month, day, year] = row.dateReported.split('/').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day ||
      date.getTime() > now
    )
      return [];
    return [
      {
        period: row.fiscalQtrEnd,
        reportedAt: date.toISOString().slice(0, 10),
        actual: row.eps,
        estimate: row.consensusForecast,
        surprisePercent:
          row.consensusForecast === 0
            ? null
            : ((row.eps - row.consensusForecast) / Math.abs(row.consensusForecast)) * 100,
        source: 'Nasdaq · resultado y consenso EPS',
        url: 'https://www.nasdaq.com/market-activity/stocks/' + symbol.toLowerCase() + '/earnings',
        currency: 'USD' as const,
      },
    ];
  });
  return rows.sort((a, b) => b.reportedAt.localeCompare(a.reportedAt))[0] ?? null;
}
export async function earningsComparison(i: Instrument): Promise<EarningsComparison | undefined> {
  if (i.type !== 'stock' || i.country !== 'US' || i.currency !== 'USD') return undefined;
  return cached('earnings-comparison:v1:' + i.id, 21600000, async () => {
    try {
      return (
        parseEarningsComparison(
          await fetchJson(
            'https://api.nasdaq.com/api/company/' +
              encodeURIComponent(i.symbol) +
              '/earnings-surprise',
            { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
          ),
          i.symbol,
        ) ?? undefined
      );
    } catch {
      return undefined;
    }
  });
}
