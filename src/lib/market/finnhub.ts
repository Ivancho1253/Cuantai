import { z } from 'zod';
import {
  ProviderError,
  type FundamentalsProvider,
  type Instrument,
  type NewsProvider,
} from './types';
import { fetchJson } from './transport';
import { rateLimit } from '../security';
export class FinnhubProvider implements FundamentalsProvider, NewsProvider {
  private async get(endpoint: string, params: Record<string, string>) {
    if (!process.env.FINNHUB_API_KEY)
      throw new ProviderError('Fundamentales y noticias requieren FINNHUB_API_KEY.', 'CREDENTIALS');
    await rateLimit('provider:finnhub', Number(process.env.FINNHUB_REQUESTS_PER_MINUTE ?? 30), 60);
    const url = new URL(`https://finnhub.io/api/v1/${endpoint}`);
    for (const [k, v] of Object.entries({ ...params, token: process.env.FINNHUB_API_KEY }))
      url.searchParams.set(k, v);
    return fetchJson(url);
  }
  async fundamentals(i: Instrument) {
    if (i.type !== 'stock' || i.exchange === 'BYMA')
      throw new ProviderError('Métricas corporativas no aplicables a este instrumento.');
    const data = z
      .object({ metric: z.record(z.string(), z.union([z.number(), z.string(), z.null()])) })
      .parse(await this.get('stock/metric', { symbol: i.symbol, metric: 'all' }));
    const specs = [
      ['marketCapitalization', 'Capitalización', 'M USD'],
      ['peTTM', 'P/E TTM', '×'],
      ['epsTTM', 'EPS TTM', 'USD'],
      ['dividendYieldIndicatedAnnual', 'Dividend yield', '%'],
      ['52WeekHigh', 'Máximo 52 semanas', 'USD'],
      ['52WeekLow', 'Mínimo 52 semanas', 'USD'],
      ['beta', 'Beta', ''],
      ['roeTTM', 'ROE TTM', '%'],
      ['revenueGrowthTTMYoy', 'Crecimiento de ingresos', '%'],
    ];
    return {
      metrics: specs.map(([key, label, unit]) => ({
        label,
        value:
          data.metric[key] != null &&
          Number.isFinite(Number(data.metric[key])) &&
          String(data.metric[key]).trim() !== ''
            ? String(data.metric[key])
            : null,
        unit,
        period: 'Proveedor · TTM / último disponible',
      })),
      provenance: {
        source: 'Finnhub basic financials · fecha del dato no informada',
        url: `https://finnhub.io/`,
        asOf: '',
        retrievedAt: new Date().toISOString(),
        status: 'delayed' as const,
        delayMinutes: null,
        adjusted: 'unknown' as const,
      },
    };
  }
  async news(i?: Instrument) {
    if (i && (i.type !== 'stock' || i.country !== 'US'))
      throw new ProviderError(
        'No hay un adaptador de noticias verificado para esta clase de instrumento.',
      );
    const now = new Date();
    const from = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
    const raw = await this.get(
      i ? 'company-news' : 'news',
      i ? { symbol: i.symbol, from, to: now.toISOString().slice(0, 10) } : { category: 'general' },
    );
    const data = z
      .array(
        z.object({
          id: z.number(),
          headline: z.string(),
          url: z.url(),
          source: z.string(),
          datetime: z.number(),
          category: z.string().optional(),
          image: z.string().optional(),
          summary: z.string().optional(),
        }),
      )
      .parse(raw);
    return data
      .filter((n) => /^https?:\/\//.test(n.url))
      .filter((n) => n.datetime > 0 && n.datetime * 1000 <= Date.now() + 60000)
      .sort((a, b) => b.datetime - a.datetime)
      .slice(0, 25)
      .map((n) => ({
        id: String(n.id),
        title: n.headline,
        url: n.url,
        source: n.source,
        publishedAt: new Date(n.datetime * 1000).toISOString(),
        category: n.category ?? 'Markets',
        ...(n.image && /^https:\/\//.test(n.image) ? { imageUrl: n.image } : {}),
        ...(n.summary ? { summary: n.summary } : {}),
      }));
  }
}
