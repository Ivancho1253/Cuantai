import { expect, it } from 'vitest';
import { contextualNews, isCompanyNews } from '@/lib/market/news-relevance';
import { instruments } from '@/lib/market/catalog';
import type { NewsItem } from '@/lib/market/types';
const amazon = instruments.find((i) => i.symbol === 'AMZN')!;
const article = (title: string, summary = ''): NewsItem => ({
  id: title,
  title,
  summary,
  url: 'https://publisher.test/story',
  source: 'Test publisher',
  publishedAt: '2026-11-16T10:00:00Z',
  category: 'Markets',
});
it('identifies companies and verified brand names without matching ticker substrings', () => {
  expect(isCompanyNews(article('Amazon presents earnings'), amazon)).toBe(true);
  expect(isCompanyNews(article('AWS launches a new cloud service'), amazon)).toBe(true);
  expect(isCompanyNews(article('Cloud growth', 'Amazon revenue increases'), amazon)).toBe(true);
  expect(isCompanyNews(article('Amazonian rainforest research'), amazon)).toBe(false);
  expect(isCompanyNews(article('Apple earnings beat estimates'), amazon)).toBe(false);
});
it('keeps company news separate and labels sector and macro context without claiming causality', () => {
  const result = contextualNews(
    [
      article('Amazon earnings'),
      article('Retail spending improves'),
      article('Federal Reserve debates interest rates'),
      article('JPMorgan fixes consumer banking app'),
      article('Football final this weekend'),
    ],
    amazon,
  );
  expect(result.map((i) => i.title)).toEqual([
    'Retail spending improves',
    'Federal Reserve debates interest rates',
  ]);
  expect(result.map((i) => i.relevance?.kind)).toEqual(['sector', 'macro']);
});
it('does not confuse the quote stablecoin with the selected cryptoasset', () => {
  const ethereum = instruments.find((i) => i.symbol === 'ETHUSDT')!;
  expect(isCompanyNews(article('Tether releases reserves report'), ethereum)).toBe(false);
  expect(isCompanyNews(article('Ethereum network upgrade'), ethereum)).toBe(true);
});
