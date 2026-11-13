import { XMLParser } from 'fast-xml-parser';
import type { Instrument, NewsItem } from './types';
import { addNewsImages } from './news-images';

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });
const text = (value: unknown) => (typeof value === 'string' ? value : '');
const plainText = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code: string) => {
      const point = code.toLowerCase().startsWith('x') ? parseInt(code.slice(1), 16) : Number(code);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    })
    .replace(
      /&(quot|apos|nbsp|lt|gt|rsquo|lsquo|rdquo|ldquo|mdash|ndash);/g,
      (_match, key: string) =>
        ({
          quot: '"',
          apos: "'",
          nbsp: ' ',
          lt: '<',
          gt: '>',
          rsquo: '’',
          lsquo: '‘',
          rdquo: '”',
          ldquo: '“',
          mdash: '—',
          ndash: '–',
        })[key]!,
    )
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export function parseNewsFeed(xml: string, source: string): NewsItem[] {
  if (xml.length > 1_000_000 || /<!DOCTYPE/i.test(xml)) throw new Error('Feed no admitido.');
  const data = parser.parse(xml);
  const raw = data?.rss?.channel?.item ?? [];
  return (Array.isArray(raw) ? raw : [raw]).flatMap((item): NewsItem[] => {
    const title = plainText(text(item.title));
    const url = text(item.link).trim();
    const published = Date.parse(text(item.pubDate));
    if (!title || !/^https:\/\//i.test(url) || !Number.isFinite(published)) return [];
    const description = text(item.description) || text(item['content:encoded']);
    const summary = plainText(description).slice(0, 2400);
    const media = [
      item['media:thumbnail'],
      item['media:content'],
      item.enclosure,
      item['media:group']?.['media:content'],
      item['media:group']?.['media:thumbnail'],
    ]
      .flat()
      .find(
        (value) => value && typeof value === 'object' && /^https:\/\//i.test(value['@_url'] ?? ''),
      );
    const imageUrl =
      media?.['@_url'] || description.match(/<img[^>]+src=["'](https:\/\/[^"']+)/i)?.[1];
    return [
      {
        id: url,
        title,
        url,
        source,
        publishedAt: new Date(published).toISOString(),
        category: 'Mercados',
        ...(summary ? { summary } : {}),
        ...(imageUrl ? { imageUrl } : {}),
      },
    ];
  });
}

async function loadFeed(url: string, source: string) {
  const response = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    signal: AbortSignal.timeout(8000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`No se pudo consultar ${source}.`);
  return parseNewsFeed(await response.text(), source);
}

export async function publicMarketNews(instrument?: Instrument): Promise<NewsItem[]> {
  let feeds: [string, string][];
  if (instrument) {
    const symbol =
      instrument.type === 'crypto'
        ? `${instrument.symbol.replace(/(?:USDT|USDC|USD)$/, '')}-USD`
        : instrument.type === 'stock' &&
            instrument.country === 'AR' &&
            instrument.exchange === 'BYMA'
          ? `${instrument.symbol}.BA`
          : instrument.symbol;
    feeds = [
      [
        `https://finance.yahoo.com/rss/headline?s=${encodeURIComponent(symbol)}`,
        'Yahoo Finance · RSS',
      ],
    ];
  } else {
    feeds = [
      ['https://www.cnbc.com/id/100003114/device/rss/rss.html', 'CNBC'],
      ['https://feeds.content.dowjones.io/public/rss/mw_topstories', 'MarketWatch'],
    ];
  }
  const results = await Promise.allSettled(feeds.map(([url, source]) => loadFeed(url, source)));
  if (results.every((result) => result.status === 'rejected'))
    throw new Error('Las fuentes de noticias no respondieron. Volvé a intentar en unos minutos.');
  const unique = new Map<string, NewsItem>();
  for (const result of results)
    if (result.status === 'fulfilled')
      for (const item of result.value) if (!unique.has(item.url)) unique.set(item.url, item);
  const items = [...unique.values()]
    .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
    .slice(0, 30);
  return addNewsImages(items);
}
