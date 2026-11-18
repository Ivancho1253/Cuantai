import { newsInstruments } from './news-instruments';
import { publicFundamentals } from './public-fundamentals';
import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { instrumentTable } from '../db/schema';
import { instruments, findInstrument, searchCatalog } from './catalog';
import { discoverInstruments, findDiscoveryInstrument, findPrimaryEtf } from './discovery';
import { CoinGeckoProvider } from './coingecko';
import { YahooProvider } from './yahoo';
import { demoHistory } from './demo';
import { BinanceProvider } from './binance';
import { TwelveDataProvider } from './twelve-data';
import { BymaProvider } from './byma';
import { FinnhubProvider } from './finnhub';
import { publicMarketNews } from './rss-news';
import { addNewsImages } from './news-images';
import { contextualNews, isCompanyNews } from './news-relevance';
import { SecProvider } from './sec';
import type { FinancialStatementsResult } from '../finance/statements';
import { cached } from './transport';
import { type TechnicalHorizon, buildChartIndicators } from '../finance/chart-indicators';
import {
  ProviderError,
  type Instrument,
  type MarketSnapshot,
  type Quote,
  type Timeframe,
} from './types';
export const dataMode = () => (process.env.MARKET_DATA_MODE === 'demo' ? 'demo' : 'live');
function listingProvider(instrument: Instrument) {
  if (instrument.exchange === 'COINGECKO') return new CoinGeckoProvider();
  if (instrument.exchange === 'BINANCE') return new BinanceProvider();
  if (instrument.exchange === 'BYMA')
    return process.env.BYMA_AUTHORIZED_DATA_FILE ? new BymaProvider() : new YahooProvider();
  return process.env.TWELVE_DATA_API_KEY ? new TwelveDataProvider() : new YahooProvider();
}
export function providerStatus() {
  return {
    mode: dataMode(),
    binance: { configured: true, label: 'Binance public market data' },
    twelveData: { configured: Boolean(process.env.TWELVE_DATA_API_KEY), label: 'US stocks & ETFs' },
    finnhub: { configured: Boolean(process.env.FINNHUB_API_KEY), label: 'Fundamentals & news' },
    news: { configured: true, label: 'Noticias · feeds públicos de medios financieros' },
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
  if (seed) {
    const primary = seed.type === 'etf' ? findPrimaryEtf(seed.symbol) : undefined;
    return primary ? { ...primary, id: seed.id } : seed;
  }
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
    ...searchCatalog(query).filter(
      (i) => i.type !== 'etf' || !findPrimaryEtf(i.symbol) || findPrimaryEtf(i.symbol)!.id === i.id,
    ),
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
export async function searchNewsInstruments(query: string, live = false) {
  const results = await searchInstruments(query, live);
  return { ...results, instruments: await newsInstruments(results.instruments, resolveInstrument) };
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
  if (instrument.exchange === 'WALLET')
    return {
      instrument,
      quote: null,
      candles: [],
      timeframe,
      provenance: {
        source: instrument.source,
        url: '/data-policy',
        asOf: '',
        retrievedAt: new Date().toISOString(),
        status: 'unavailable',
        delayMinutes: null,
        adjusted: 'unknown',
      },
      error:
        'El token importado no tiene una cotización verificada. Podés cargar un precio manual.',
    };
  if (forceDemo || dataMode() === 'demo') return demoHistory(instrument, timeframe);
  return cached(`market:${id}:${timeframe}`, 30000, async () => {
    const provider = listingProvider(instrument);
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
export async function publicResearchSnapshot(id: string): Promise<MarketSnapshot> {
  const instrument = await resolveInstrument(id);
  const provider = listingProvider(instrument);
  const [quote, history] = await Promise.allSettled([
    provider.quote(instrument),
    provider instanceof YahooProvider || instrument.exchange === 'COINGECKO'
      ? new YahooProvider().dailyHistory(instrument)
      : provider.history(instrument, '1D'),
  ]);
  return {
    instrument,
    timeframe: '1D',
    quote: quote.status === 'fulfilled' ? quote.value : null,
    candles: history.status === 'fulfilled' ? history.value.candles : [],
    provenance:
      history.status === 'fulfilled'
        ? history.value.provenance
        : {
            source: instrument.source,
            url: '',
            asOf: '',
            retrievedAt: new Date().toISOString(),
            status: 'unavailable',
            delayMinutes: null,
            adjusted: 'unknown',
          },
    error:
      history.status === 'rejected'
        ? history.reason instanceof Error
          ? history.reason.message
          : 'Historial no disponible.'
        : undefined,
  };
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

export async function chartIndicators(
  id: string,
  demo = false,
  horizon: TechnicalHorizon = 'short',
) {
  const instrument = await resolveInstrument(id);
  // The real TradingView chart needs real readings, including in the public demo.
  // Explicit fixtures remain available separately and are labelled as demo data.
  if (demo) {
    const snapshot = demoHistory(instrument, '1D');
    return buildChartIndicators(
      instrument,
      snapshot.candles,
      snapshot.provenance,
      Date.now(),
      horizon,
    );
  }
  return cached(`chart-indicators:v3:${id}:${horizon}`, 60000, async () => {
    try {
      const provider = listingProvider(instrument);
      const history =
        provider instanceof YahooProvider || instrument.exchange === 'COINGECKO'
          ? await new YahooProvider().dailyHistory(instrument)
          : await provider.history(instrument, '1D');
      return buildChartIndicators(
        instrument,
        history.candles,
        history.provenance,
        Date.now(),
        horizon,
      );
    } catch (error) {
      return {
        ...buildChartIndicators(
          instrument,
          [],
          {
            source: instrument.source,
            url: '',
            asOf: '',
            retrievedAt: new Date().toISOString(),
            status: 'unavailable',
            delayMinutes: null,
            adjusted: 'unknown',
          },
          Date.now(),
          horizon,
        ),
        error: error instanceof Error ? error.message : 'Historial no disponible.',
      };
    }
  });
}

// Quote-only refresh: never request histories or the full catalog on the dashboard timer.
export async function dashboardBenchmarks(demo = false): Promise<MarketSnapshot[]> {
  return Promise.all(
    ['NYSE:SPY:USD', 'NASDAQ:QQQ:USD', 'NYSE:DIA:USD', 'BINANCE:BTCUSDT:USDT'].map(async (id) => {
      const instrument = await resolveInstrument(id);
      if (demo || dataMode() === 'demo') {
        const snapshot = demoHistory(instrument, '1D');
        return { ...snapshot, candles: [] };
      }
      const provider = listingProvider(instrument);
      // Keyed providers retain a conservative cache to respect their request quotas.
      const ttl =
        provider instanceof YahooProvider || provider instanceof BinanceProvider ? 10000 : 60000;
      return cached(`benchmark:${id}:${ttl}`, ttl, async () => {
        try {
          const quote =
            provider instanceof YahooProvider
              ? await provider.quote(instrument, ttl)
              : await provider.quote(instrument);
          return { instrument, quote, candles: [], timeframe: '1D' as const, provenance: quote };
        } catch (error) {
          return {
            instrument,
            quote: null,
            candles: [],
            timeframe: '1D' as const,
            provenance: {
              source: 'Provider unavailable',
              url: '',
              asOf: '',
              retrievedAt: new Date().toISOString(),
              status: 'unavailable' as const,
              delayMinutes: null,
              adjusted: 'unknown' as const,
            },
            error: error instanceof Error ? error.message : 'Datos no disponibles',
          };
        }
      });
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
                listingProvider(instrument).quote(instrument),
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
  void demo;
  const issuer =
    instrument.type === 'cedear' && instrument.underlyingId
      ? await resolveInstrument(instrument.underlyingId)
      : instrument;
  const research = await publicFundamentals(instrument, issuer);
  if (research.metrics.length && research.asOf)
    return {
      metrics: research.metrics.map((m) => ({
        label: m.label,
        value: String(m.value),
        unit: m.unit,
        period: research.asOf!,
      })),
      provenance: {
        source: research.source,
        url: research.url,
        asOf: research.asOf,
        retrievedAt: research.retrievedAt,
        status: 'eod' as const,
        delayMinutes: null,
        adjusted: 'unknown' as const,
      },
    };
  if (process.env.FINNHUB_API_KEY) {
    try {
      return await cached('fundamentals:' + issuer.id, 3600000, () =>
        new FinnhubProvider().fundamentals(issuer),
      );
    } catch {
      /* Keep the public source coverage details. */
    }
  }
  return { metrics: [], error: research.error };
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
export async function marketNews(
  instrument?: Instrument,
  demo = false,
  scope: 'company' | 'context' = 'company',
) {
  // News is always sourced from publishers, independently of simulated market prices.
  void demo;
  try {
    const issuer =
      instrument?.type === 'cedear' && instrument.underlyingId
        ? await resolveInstrument(instrument.underlyingId)
        : instrument;
    if (issuer && scope === 'context') {
      const items = await cached('news:market-context:v1', 300000, () => publicMarketNews());
      return { items: contextualNews(items, issuer) };
    }
    return {
      items: await cached(`news:images-v5:${issuer?.id ?? 'all'}`, 300000, async () => {
        if (process.env.FINNHUB_API_KEY) {
          try {
            const items = await new FinnhubProvider().news(issuer);
            const relevant = issuer ? items.filter((item) => isCompanyNews(item, issuer)) : items;
            if (relevant.length) return addNewsImages(relevant);
          } catch {
            /* Public publisher feeds remain available if this provider fails. */
          }
        }
        const items = await publicMarketNews(issuer);
        return issuer ? items.filter((item) => isCompanyNews(item, issuer)) : items;
      }),
    };
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : 'Noticias no disponibles' };
  }
}
