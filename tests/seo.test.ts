/**
 * On-page SEO + install requirements: manifest/icons, metadata, share image, robots, sitemap,
 * structured data with the developer credit, and the private app kept out of search.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import { DEVELOPER, siteUrl } from '@/lib/seo';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('install (Chrome "Install app")', () => {
  it('manifest + 192/512/maskable/apple icons are in public/', () => {
    for (const f of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png', 'favicon.ico']) {
      expect(fs.existsSync(path.join(ROOT, 'public', f)), f).toBe(true);
    }
    expect(fs.existsSync(path.join(ROOT, 'app/manifest.ts'))).toBe(true);
  });
});

describe('on-page SEO', () => {
  const layout = read('app/layout.tsx');
  it('metadata: base URL, title template, description, keywords, canonical, author = developer', () => {
    for (const s of ['metadataBase: siteUrl()', 'template:', 'keywords: SITE_KEYWORDS', "canonical: '/'", 'authors: [{ name: DEVELOPER.name', 'creator: DEVELOPER.name']) {
      expect(layout, s).toContain(s);
    }
    expect(DEVELOPER.name).toBe('Abdullah Ibne Ali');
  });

  it('share image 1200x630 for WhatsApp/Facebook previews', () => {
    expect(layout).toMatch(/url: '\/og-image\.jpg', width: 1200, height: 630/);
    const size = fs.statSync(path.join(ROOT, 'public/og-image.jpg')).size;
    expect(size).toBeLessThan(200 * 1024);
  });

  it('robots: landing indexed; the private app and dev preview are not', () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rule.disallow).toEqual(['/app', '/preview']);
    expect(read('app/app/layout.tsx')).toMatch(/robots: \{ index: false, follow: false \}/);
    expect(String(r.sitemap)).toMatch(/\/sitemap\.xml$/);
  });

  it('sitemap lists only the public landing page', () => {
    const s = sitemap();
    expect(s).toHaveLength(1);
    expect(s[0].url).toBe(new URL('/', siteUrl()).toString());
  });

  it('landing has schema.org structured data with the developer as author, and a footer credit', () => {
    const landing = read('components/landing/LandingPage.tsx');
    expect(landing).toMatch(/'@type': 'SoftwareApplication'/);
    expect(landing).toMatch(/'@type': 'Person',\s*name: DEVELOPER\.name/);
    expect(landing).toMatch(/alternateName: DEVELOPER\.alternateName/); // "abdnimit" finds it too
    expect(landing).toMatch(/Developed by/);
    expect(landing).toMatch(/replace\(\/<\/g, '\\\\u003c'\)/); // no "</script>" injection
  });
});
