import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
  return [
    { url: base, changeFrequency: 'monthly', priority: 1 },
    { url: `${base}/data-policy`, changeFrequency: 'monthly', priority: 0.4 },
  ];
}
