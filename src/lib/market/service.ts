import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { instrumentTable } from '../db/schema';
import { instruments, findInstrument, searchCatalog } from './catalog';
import { discoverInstruments, findDiscoveryInstrument } from './discovery';
import { CoinGeckoProvider } from './coingecko';
import { demoHistory } from './demo';
import { BinanceProvider } from './binance';
import { TwelveDataProvider } from './twelve-data';
import { BymaProvider } from './byma';
import { FinnhubProvider } from './finnhub';
import { SecProvider } from './sec';
import type { FinancialStatementsResult } from '../finance/statements';
import { cached } from './transport';
import {
  ProviderError,
  type Instrument,
  type MarketSnapshot,
  type Quote,
  type Timeframe,
} from './types';
export const dataMode = () => (process.env.MARKET_DATA_MODE === 'live' ? 'live' : 'demo');
export function providerStatus() {
  return {
    mode: dataMode(),
    binance: { configured: true, label: 'Binance public market data' },
    twelveData: { configured: Boolean(process.env.TWELVE_DATA_API_KEY), label: 'US stocks & ETFs' },
    finnhub: { configured: Boolean(process.env.FINNHUB_API_KEY), label: 'Fundamentals & news' },
    sec: {
      configured: Boolean(process.env.SEC_USER_AGENT || process.env.SEC_COMPANYFACTS_FILE),
      label: 'SEC EDGAR · estados anuales',
    },
    byma: {
      configured: Boolean(process.env.BYMA_AUTHORIZED_DATA_FILE),
      label: 'BYMA authorized export',
    },
    ai: {
      configured: Boolean(process.env.OPENAI_API_KEY && process.env.AI_MODEL),
      label: 'AI synthesis',
    },
  };
}
export async function resolveInstrument(id: string): Promise<Instrument> {
  const seed = findInstrument(id);
  if (seed) return seed;
  const db = await getDb();
  const discovery = findDiscoveryInstrument(id);
  if (discovery) {
    await db.insert(instrumentTable).values({ id, data: discovery }).onConflictDoNothing();
    return discovery;
  }
  const rows = await db.select().from(instrumentTable).where(eq(instrumentTable.id, id));
  if (!rows[0]) throw new ProviderError('Instrumento no encontrado.', 'NOT_FOUND');
  return rows[0].data;
}
export async function searchInstruments(query: string, live = false) {
  const found = [
    ...searchCatalog(query),
    ...discoverInstruments({ query, pageSize: 100 }).instruments,
  ];
  let error: string | undefined;
  if (live && query.length >= 2) {
    const results = await Promise.allSettled([
      new BinanceProvider().search(query),
      ...(process.env.TWELVE_DATA_API_KEY ? [new TwelveDataProvider().search(query)] : []),
    ]);
    for (const result of results) {
      if (result.status === 'fulfilled') found.push(...result.value);
      else
        error =
          'Una búsqueda externa no estuvo disponible; se muestran los resultados disponibles.';
    }
  }
  const unique = [...new Map(found.map((i) => [i.id, i])).values()].slice(0, 100);
  if (unique.length) {
    const db = await getDb();
    await db
      .insert(instrumentTable)
      .values(unique.map((data) => ({ id: data.id, data })))
      .onConflictDoNothing();
  }
  return {
    instruments: unique,
    error,
    catalog:
      'SPY equity holdings + SEC exchanges + active CoinGecko coins + configured provider search',
  };
}
export async function marketSnapshot(
  id: string,
  timeframe: Timeframe = '1D',
  forceDemo = false,
): Promise<MarketSnapshot> {
  const instrument = await resolveInstrument(id);
  if (instrument.type === 'cash')
    return {
      instrument,
      quote: null,
      candles: [],
      timeframe,
      provenance: {
        source: 'Cash denomination',
        url: '/data-policy',
        asOf: '',
        retrievedAt: new Date().toISOString(),
        status: 'unavailable',
        delayMinutes: null,
        adjusted: 'unknown',
      },
      error: 'El efectivo es un saldo, no una serie de precios de mercado.',
    };
  if (forceDemo || dataMode() === 'demo') return demoHistory(instrument, timeframe);
  return cached(`market:${id}:${timeframe}`, 30000, async () => {
    const provider =
      instrument.exchange === 'COINGECKO'
        ? new CoinGeckoProvider()
        : instrument.exchange === 'BINANCE'
          ? new BinanceProvider()
          : instrument.exchange === 'BYMA'
            ? new BymaProvider()
            : new TwelveDataProvider();
    const result = await Promise.allSettled([
      provider.quote(instrument),
      provider.history(instrument, timeframe),
    ]);
    const quote: Quote | null = result[0].status === 'fulfilled' ? result[0].value : null;
    const history = result[1].status === 'fulfilled' ? result[1].value : null;
    if (quote)
      quote.stale =
        Date.now() - new Date(quote.asOf).getTime() >
        (quote.status === 'realtime' ? 180000 : 4 * 86400000);
    const errors = result.flatMap((r) =>
      r.status === 'rejected'
        ? [r.reason instanceof Error ? r.reason.message : 'Datos no disponibles']
        : [],
    );
    return {
      instrument,
      quote,
      candles: history?.candles ?? [],
      provenance: history?.provenance ??
        quote ?? {
          source: 'Provider unavailable',
          url: '',
          asOf: '',
          retrievedAt: new Date().toISOString(),
          status: 'unavailable',
          delayMinutes: null,
          adjusted: 'unknown',
        },
      timeframe,
      error: [...new Set(errors)].join(' ') || undefined,
    };
  });
}
export async function marketOverview(demo = false) {
  return Promise.all(
    instruments
      .filter((i) => !['cash', 'cedear'].includes(i.type))
      .map(async (i) => {
        const snapshot = await marketSnapshot(i.id, '1D', demo);
        return { ...snapshot, candles: snapshot.candles.slice(-40) };
      }),
  );
}

export async function marketListings(
  options: Parameters<typeof discoverInstruments>[0],
  demo = false,
) {
  const page = discoverInstruments(options);
  const isDemo = demo || dataMode() === 'demo';
  let cryptoQuotes = new Map<string, Quote>();
  if (!isDemo) {
    try {
      cryptoQuotes = await new CoinGeckoProvider().quotes(
        page.instruments.filter((i) => i.exchange === 'COINGECKO'),
      );
    } catch {
      /* Keep every catalog listing visible when its provider is unavailable. */
    }
  }
  const rows = await Promise.all(
    page.instruments.map(async (instrument) => {
      if (isDemo) return { ...demoHistory(instrument), candles: [] };
      let quote: Quote | null = null;
      let error: string | undefined;
      try {
        quote =
          instrument.exchange === 'COINGECKO'
            ? (cryptoQuotes.get(instrument.id) ?? null)
            : await cached<Quote>(`listing-quote:${instrument.id}`, 60000, () =>
                (instrument.exchange === 'BINANCE'
                  ? new BinanceProvider()
                  : instrument.exchange === 'BYMA'
                    ? new BymaProvider()
                    : new TwelveDataProvider()
                ).quote(instrument),
              );
      } catch (cause) {
        error = cause instanceof Error ? cause.message : 'Cotización no disponible';
      }
      const provenance = quote ?? {
        source: instrument.source,
        url: '',
        asOf: '',
        retrievedAt: new Date().toISOString(),
        status: 'unavailable' as const,
        delayMinutes: null,
        adjusted: 'unknown' as const,
      };
      return { instrument, quote, candles: [], provenance, timeframe: '1D' as const, error };
    }),
  );
  return { ...page, rows };
}
export async function assetFundamentals(instrument: Instrument, demo = false) {
  if (demo || dataMode() === 'demo')
    return {
      metrics: [],
      error:
        'No hay fundamentales en el dataset demo. Conectá Finnhub para consultar métricas verificables.',
    };
  try {
    return await cached(`fundamentals:${instrument.id}`, 3600000, () =>
      new FinnhubProvider().fundamentals(instrument),
    );
  } catch (e) {
    return { metrics: [], error: e instanceof Error ? e.message : 'Fundamentales no disponibles' };
  }
}
export async function assetFinancialStatements(
  instrument: Instrument,
  demo = false,
): Promise<FinancialStatementsResult> {
  const issuer =
    instrument.type === 'cedear' && instrument.underlyingId
      ? await resolveInstrument(instrument.underlyingId)
      : instrument;
  if (
    issuer.type !== 'stock' ||
    issuer.country !== 'US' ||
    !['NYSE', 'NASDAQ'].includes(issuer.exchange)
  )
    return {
      data: null,
      reason: 'NOT_APPLICABLE',
      error:
        'Los estados corporativos SEC US-GAAP no son aplicables a este instrumento. Los ETFs y las criptomonedas requieren otras fuentes.',
    };
  if (demo || dataMode() === 'demo')
    return {
      data: null,
      reason: 'DEMO',
      error:
        'El modo demo no incluye balances ficticios. Los estados anuales se consultan en modo de datos reales con SEC EDGAR configurado.',
    };
  try {
    const data = await new SecProvider().statements(issuer);
    return { data: { ...data, requestedInstrumentId: instrument.id } };
  } catch (error) {
    return {
      data: null,
      reason: 'UNAVAILABLE',
      error:
        error instanceof ProviderError
          ? error.message
          : 'No se pudo validar o recuperar el archivo de estados financieros SEC.',
    };
  }
}
export async function marketNews(instrument?: Instrument, demo = false) {
  if (demo || dataMode() === 'demo')
    return {
      items: [],
      error:
        'El modo demo no muestra titulares ficticios. Conectá Finnhub para consultar noticias.',
    };
  try {
    const issuer =
      instrument?.type === 'cedear' && instrument.underlyingId
        ? await resolveInstrument(instrument.underlyingId)
        : instrument;
    return {
      items: await cached(`news:${instrument?.id ?? 'all'}`, 300000, () =>
        new FinnhubProvider().news(issuer),
      ),
    };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : 'Noticias no disponibles' };
  }
}
