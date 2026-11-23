import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/seo';

/** Only the public landing page is listed; the app itself is private (noindex). */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: new URL('/', siteUrl()).toString(), lastModified: new Date(), changeFrequency: 'weekly', priority: 1 }];
}
