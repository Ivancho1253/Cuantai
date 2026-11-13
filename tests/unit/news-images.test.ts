import { it, expect, vi, afterEach } from 'vitest';
import { openGraphImage, publisherImage, addNewsImages } from '@/lib/market/news-images';
afterEach(() => vi.unstubAllGlobals());
it('finds actual publisher photos with either meta attribute order and decodes URL entities', () => {
  expect(
    openGraphImage(
      '<meta content="https://image.cnbcfm.com/photo.jpg?w=960&amp;h=540" property="og:image"/>',
    ),
  ).toBe('https://image.cnbcfm.com/photo.jpg?w=960&h=540');
  expect(
    openGraphImage("<meta name='twitter:image' content='https://images.mktw.net/photo.jpg'>"),
  ).toBe('https://images.mktw.net/photo.jpg');
  expect(
    openGraphImage('<meta property="og:image" content="javascript:alert(1)">'),
  ).toBeUndefined();
});
it('does not fetch arbitrary hosts or follow publisher redirects into private networks', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: 'http://127.0.0.1/private' } }),
    );
  vi.stubGlobal('fetch', fetcher);
  expect(await publisherImage('https://private.test/item')).toBeUndefined();
  expect(fetcher).not.toHaveBeenCalled();
  expect(
    await publisherImage('https://www.cnbc.com/news-image-redirect-test.html'),
  ).toBeUndefined();
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('enriches photo-less news from the publisher and keeps existing RSS images', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<head><meta property="og:image" content="https://image.cnbcfm.com/receipt.jpg"></head>',
          { headers: { 'Content-Type': 'text/html' } },
        ),
      ),
  );
  const items = await addNewsImages([
    { url: 'https://www.cnbc.com/image-enrichment-test.html' },
    {
      url: 'https://www.marketwatch.com/rss-image.html',
      imageUrl: 'https://images.mktw.net/existing.jpg',
    },
  ]);
  expect(items[0].imageUrl).toBe('https://image.cnbcfm.com/receipt.jpg');
  expect(items[1].imageUrl).toBe('https://images.mktw.net/existing.jpg');
});
