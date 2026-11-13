import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseNewsFeed, publicMarketNews } from '@/lib/market/rss-news';
import { instruments } from '@/lib/market/catalog';
const feed = `<rss><channel><item><title>Revenue &amp; earnings</title><link>https://publisher.test/story</link><pubDate>Thu, 12 Nov 2026 12:00:00 GMT</pubDate></item><item><title>Unsafe link</title><link>javascript:alert(1)</link><pubDate>invalid</pubDate></item></channel></rss>`;
afterEach(() => vi.unstubAllGlobals());
describe('public financial news', () => {
  it('reads nested media and decodes HTML entities left inside publisher excerpts', () => {
    const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>Report</title><link>https://publisher.test/nested</link><pubDate>Thu, 12 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[Nvidia&#x2019;s <b>published</b> summary]]></description><media:group><media:content url="https://publisher.test/nested.jpg"/></media:group></item></channel></rss>`;
    expect(parseNewsFeed(xml, 'Publisher')[0]).toMatchObject({
      summary: 'Nvidia’s published summary',
      imageUrl: 'https://publisher.test/nested.jpg',
    });
  });
  it('extracts publisher images and plain text for internal reading', () => {
    const xml = `<rss xmlns:media="http://search.yahoo.com/mrss/"><channel><item><title>Report</title><link>https://publisher.test/read</link><pubDate>Thu, 12 Nov 2026 12:00:00 GMT</pubDate><description><![CDATA[<p>Published <strong>summary</strong> with context.</p>]]></description><media:thumbnail url="https://publisher.test/photo.jpg"/></item></channel></rss>`;
    expect(parseNewsFeed(xml, 'Publisher')[0]).toMatchObject({
      summary: 'Published summary with context.',
      imageUrl: 'https://publisher.test/photo.jpg',
    });
  });
  it('preserves attribution and article dates while rejecting invalid entries', () => {
    expect(parseNewsFeed(feed, 'Publisher')).toEqual([
      {
        id: 'https://publisher.test/story',
        title: 'Revenue & earnings',
        url: 'https://publisher.test/story',
        source: 'Publisher',
        publishedAt: '2026-11-12T12:00:00.000Z',
        category: 'Mercados',
      },
    ]);
    expect(() => parseNewsFeed('<!DOCTYPE rss><rss/>', 'Publisher')).toThrow('Feed');
    expect(parseNewsFeed('<rss><channel/></rss>', 'Publisher')).toEqual([]);
  });
  it('retains a working feed when another publisher is unavailable and deduplicates links', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(new Response(feed)).mockRejectedValueOnce(new Error('offline')),
    );
    expect(await publicMarketNews()).toHaveLength(1);
  });
  it('queries the selected asset and never fills missing news with another company', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<rss><channel/></rss>'));
    vi.stubGlobal('fetch', fetcher);
    const apple = instruments.find((i) => i.id === 'NASDAQ:AAPL:USD')!;
    expect(await publicMarketNews(apple)).toEqual([]);
    expect(fetcher.mock.calls[0][0]).toContain('s=AAPL');
  });
  it('reports provider failure instead of manufacturing headlines', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(publicMarketNews()).rejects.toThrow('no respondieron');
  });
  it('requests the local Buenos Aires listing rather than the same ticker in another market', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('<rss><channel/></rss>'));
    vi.stubGlobal('fetch', fetcher);
    await publicMarketNews(instruments.find((i) => i.id === 'BYMA:GGAL:ARS')!);
    expect(fetcher.mock.calls[0][0]).toContain('s=GGAL.BA');
  });
});
