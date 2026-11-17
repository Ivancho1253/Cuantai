import type { Instrument, NewsItem } from './types';

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const contains = (text: string, term: string) =>
  new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(
    text,
  );
export function isCompanyNews(item: NewsItem, instrument: Instrument) {
  const text = normalize(`${item.title} ${item.summary ?? ''}`).replace(/&/g, ' ');
  const name = normalize(instrument.name)
    .replace(
      instrument.exchange === 'BINANCE' ? /\s*\/\s*(tether|usd coin|usdt|usdc|usd).*$/ : /$^/,
      '',
    )
    .replace(/\.(com|inc)\b/g, '')
    .replace(
      /\b(inc|incorporated|corporation|corp|company|co|limited|ltd|holdings|group|the|s a|adr|cedear|class|common|stock|shares|ordinary|plc)\b/g,
      ' ',
    )
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const aliases: Record<string, string[]> = {
    AMZN: ['amazon', 'aws'],
    MSFT: ['microsoft', 'azure'],
    GOOGL: ['google', 'alphabet'],
    GOOG: ['google', 'alphabet'],
    META: ['meta', 'facebook', 'instagram'],
    BTCUSDT: ['bitcoin'],
    ETHUSDT: ['ethereum'],
    JPM: ['jpmorgan', 'jp morgan'],
  };
  const terms = [
    normalize(instrument.symbol),
    name,
    ...name.split(' ').filter((word) => word.length >= 5),
    ...(aliases[instrument.symbol] ?? []),
  ];
  return terms.some((term) => term.length >= 2 && contains(text, term));
}

export function contextualNews(items: NewsItem[], instrument: Instrument): NewsItem[] {
  const sector = normalize(instrument.sector);
  const sectorWords =
    instrument.type === 'crypto'
      ? ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'stablecoin']
      : /tech|semiconductor/.test(sector)
        ? [
            'technology',
            'semiconductor',
            'chip',
            'artificial intelligence',
            'cloud',
            'tecnologia',
            'inteligencia artificial',
          ]
        : /financial|bank/.test(sector)
          ? ['bank', 'banks', 'banking', 'bancos', 'credit', 'credito']
          : /energy/.test(sector)
            ? ['oil', 'crude', 'gas', 'energy', 'petroleo', 'energia', 'opec']
            : /consumer|retail/.test(sector)
              ? [
                  'retail',
                  'consumer spending',
                  'consumer confidence',
                  'ecommerce',
                  'e-commerce',
                  'consumo',
                  'consumidor',
                  'minorista',
                ]
              : /health/.test(sector)
                ? ['healthcare', 'pharma', 'biotech', 'salud', 'farmaceutica']
                : [];
  const macroWords = [
    'federal reserve',
    'interest rate',
    'interest rates',
    'inflation',
    'inflacion',
    'treasury',
    'tariff',
    'tariffs',
    'aranceles',
    'recession',
    'recesion',
    'central bank',
    'banco central',
    'monetary policy',
    ...(instrument.country === 'AR' ? ['argentina', 'peso', 'cepo', 'bcra'] : []),
  ];
  return items
    .flatMap((item) => {
      if (isCompanyNews(item, instrument)) return [];
      const text = normalize(`${item.title} ${item.summary ?? ''}`);
      const relatedSector = sectorWords.some((term) => contains(text, term));
      const macro = macroWords.some((term) => contains(text, term));
      if (!relatedSector && !macro) return [];
      return [
        {
          ...item,
          relevance: {
            kind: relatedSector ? ('sector' as const) : ('macro' as const),
            label: relatedSector ? 'Sector' : 'Contexto macro',
            reason: relatedSector
              ? 'Coincide con temas del sector del activo.'
              : 'Trata tasas, inflación, política monetaria o comercio.',
          },
        },
      ];
    })
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
}
