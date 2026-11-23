import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/app', '/preview'] }],
    sitemap: new URL('/sitemap.xml', base).toString(),
    host: base.origin,
  };
}
