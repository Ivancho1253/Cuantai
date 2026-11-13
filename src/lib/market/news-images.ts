import { cached } from './transport';
const articleHosts = new Set([
  'www.cnbc.com',
  'www.marketwatch.com',
  'finance.yahoo.com',
  'news.yahoo.com',
  'www.yahoo.com',
]);
const allowedArticle = (url: URL) =>
  url.protocol === 'https:' &&
  !url.username &&
  !url.password &&
  (!url.port || url.port === '443') &&
  articleHosts.has(url.hostname);
const decode = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'");
export function openGraphImage(html: string): string | undefined {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attrs: Record<string, string> = {};
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g))
      attrs[match[1].toLowerCase()] = decode(match[3]);
    if (
      !['og:image', 'og:image:secure_url', 'twitter:image', 'twitter:image:src'].includes(
        attrs.property ?? attrs.name,
      )
    )
      continue;
    try {
      const url = new URL(attrs.content);
      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        (!url.port || url.port === '443') &&
        !/^(localhost|127\.|10\.|192\.168\.|\[)/.test(url.hostname)
      )
        return url.href;
    } catch {}
  }
}
export async function publisherImage(article: string): Promise<string | undefined> {
  let target: URL;
  try {
    target = new URL(article);
  } catch {
    return;
  }
  if (!allowedArticle(target)) return;
  return cached(`news-image:${article}`, 86400000, async () => {
    try {
      const signal = AbortSignal.timeout(2500);
      for (let redirect = 0; redirect < 3; redirect++) {
        if (!allowedArticle(target)) return;
        const response = await fetch(target, {
          redirect: 'manual',
          signal,
          headers: { Accept: 'text/html' },
          cache: 'no-store',
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) return;
          target = new URL(location, target);
          continue;
        }
        if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
          await response.body?.cancel();
          return;
        }
        const reader = response.body?.getReader();
        if (!reader) return;
        const decoder = new TextDecoder();
        let html = '',
          size = 0;
        try {
          while (size < 512000) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.length;
            html += decoder.decode(chunk.value, { stream: true });
            if (/<\/head\s*>/i.test(html) || openGraphImage(html)) break;
          }
        } finally {
          await reader.cancel();
        }
        return openGraphImage(html);
      }
    } catch {
      return;
    }
  });
}
export async function addNewsImages<T extends { url: string; imageUrl?: string }>(
  items: T[],
): Promise<T[]> {
  const result = items.map((item) => ({ ...item }));
  let index = 0;
  const deadline = Date.now() + 5000;
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < result.length && Date.now() < deadline) {
        const item = result[index++];
        if (!item.imageUrl) {
          const image = await publisherImage(item.url);
          if (image) item.imageUrl = image;
        }
      }
    }),
  );
  return result;
}
