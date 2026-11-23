/**
 * PWA guard (S12 pulled forward): installable manifest + offline app shell that never caches
 * business data. The real offline behaviour was verified end-to-end in a browser
 * (see CHANGELOG); these tests stop regressions in the rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';

const ROOT = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
// code only (comments may legitimately mention IndexedDB to document the rule)
const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('web app manifest', () => {
  const m = manifest();

  it('is installable: name, standalone display, start URL, theme colours', () => {
    expect(m.short_name).toBe('জমারখাতা');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/');
    expect(m.theme_color).toBe('#4664E0');
    expect(m.background_color).toBe('#F5F7FE');
  });

  it('has 192 + 512 icons and a maskable icon, and every icon file exists', () => {
    const sizes = (m.icons ?? []).map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
    expect((m.icons ?? []).some((i) => i.purpose === 'maskable')).toBe(true);
    for (const icon of m.icons ?? []) {
      expect(fs.existsSync(path.join(ROOT, 'public', icon.src)), icon.src).toBe(true);
    }
  });
});

describe('service worker rules', () => {
  it('only handles same-origin GET requests (POST / other origins go to the network)', () => {
    expect(sw).toMatch(/request\.method === 'GET'/);
    expect(sw).toMatch(/origin === self\.location\.origin/);
    expect(sw).toMatch(/if \(!isSameOriginGet\(request\)\) return;/);
  });

  it('never touches business data (IndexedDB) and never caches API routes', () => {
    expect(swCode).not.toMatch(/indexedDB|Dexie|jomarkhata_db/);
    expect(swCode).not.toMatch(/\/api\//);
  });

  it('pages are network-first with an offline fallback; old caches are cleaned on activate', () => {
    expect(sw).toMatch(/request\.mode === 'navigate'/);
    expect(sw).toMatch(/cache\.match\('\/'\)/);
    expect(sw).toMatch(/caches\.delete/);
  });

  it('is registered only in production builds (dev keeps hot reload)', () => {
    const reg = fs.readFileSync(path.join(ROOT, 'components/pwa/ServiceWorkerRegister.tsx'), 'utf8');
    expect(reg).toMatch(/process\.env\.NODE_ENV !== 'production'/);
    expect(fs.readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8')).toMatch(/<ServiceWorkerRegister \/>/);
  });
});
