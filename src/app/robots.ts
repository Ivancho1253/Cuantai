import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/demo', '/data-policy'],
      disallow: [
        '/api/',
        '/dashboard',
        '/portfolio',
        '/settings',
        '/onboarding',
        '/login',
        '/register',
        '/analyst',
        '/watchlists',
        '/reset-password',
        '/forgot-password',
      ],
    },
    sitemap: `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'}/sitemap.xml`,
  };
}
