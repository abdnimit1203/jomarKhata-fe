/**
 * PWA guard (S12 pulled forward): installable manifest + offline app shell that never caches
 * business data. The real offline behaviour was verified end-to-end in a browser
 * (see CHANGELOG); these tests stop regressions in the rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import manifest from '@/app/manifest';
import { APP_ICONS, appIconSrc } from '@/components/ui/AppIcon';

const ROOT = path.resolve(__dirname, '..');
const sw = fs.readFileSync(path.join(ROOT, 'public/sw.js'), 'utf8');
// code only (comments may legitimately mention IndexedDB to document the rule)
const swCode = sw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('web app manifest', () => {
  const m = manifest();

  it('is installable: name, standalone display, start URL, theme colours', () => {
    expect(m.short_name).toBe('জমারখাতা');
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('/app');
    expect(m.id).toBe('/'); // unchanged, so phones that installed earlier update in place
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
    expect(sw).toMatch(/startsWith\('\/app'\) \? '\/app' : '\/'/);
    expect(sw).toMatch(/caches\.delete/);
  });

  it('precaches every custom feature icon and the logo, so they show offline on any screen', () => {
    for (const name of APP_ICONS) expect(sw, name).toMatch(new RegExp(`'${name}'`));
    expect(sw).toMatch(/'\/brand\/logo-mark\.png'/);
    expect(sw).not.toMatch(/jk-shell-v[123]'/); // v1 placeholder icons; v3 /app; v4 update prompt
  });

  it('is registered only in production builds (dev keeps hot reload)', () => {
    const reg = fs.readFileSync(path.join(ROOT, 'components/pwa/ServiceWorkerRegister.tsx'), 'utf8');
    expect(reg).toMatch(/process\.env\.NODE_ENV !== 'production'/);
    expect(fs.readFileSync(path.join(ROOT, 'app/layout.tsx'), 'utf8')).toMatch(/<ServiceWorkerRegister \/>/);
  });
});

describe('S12: update prompt and install prompt', () => {
  const reg = fs.readFileSync(path.join(ROOT, 'components/pwa/ServiceWorkerRegister.tsx'), 'utf8');
  it('an update waits for the owner: no automatic skipWaiting on install; SKIP_WAITING on request', () => {
    const install = /addEventListener\('install'[\s\S]*?\}\);/.exec(swCode)![0];
    expect(install).not.toMatch(/skipWaiting/);
    expect(swCode).toMatch(/data\.type === 'SKIP_WAITING'[\s\S]{0,40}self\.skipWaiting\(\)/);
  });
  it('the page detects a waiting update, shows "নতুন আপডেট আছে" and reloads only after the owner taps update', () => {
    expect(reg).toMatch(/registration\.waiting && navigator\.serviceWorker\.controller/);
    expect(reg).toMatch(/updatefound/);
    expect(reg).toMatch(/if \(shouldReloadOnControllerChange\(\)\) window\.location\.reload\(\)/);
    const prompts = fs.readFileSync(path.join(ROOT, 'components/pwa/PwaPrompts.tsx'), 'utf8');
    expect(prompts).toMatch(/নতুন আপডেট আছে/);
    expect(prompts).toMatch(/onClick=\{applyUpdate\}/);
  });
  it('install: own button via beforeinstallprompt; iPhone gets Share → Add to Home Screen steps; hidden when installed', () => {
    expect(reg).toMatch(/addEventListener\('beforeinstallprompt', captureInstallPrompt\)/);
    const prompts = fs.readFileSync(path.join(ROOT, 'components/pwa/PwaPrompts.tsx'), 'utf8');
    expect(prompts).toMatch(/Add to Home Screen/);
    expect(prompts).toMatch(/isStandalone\(\)/);
  });
});

describe('brand assets (owner logo + 19 feature icons)', () => {
  const pub = (p: string) => path.join(ROOT, 'public', p);

  it('every feature icon file exists, is a real vector (no embedded raster) and stays small', () => {
    for (const name of APP_ICONS) {
      const file = pub(appIconSrc(name));
      expect(fs.existsSync(file), name).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(svg, name).not.toMatch(/<image\b|data:image\//);
      // The source files were whole icon sheets cropped by viewBox (~165 KB each); pruned ones are < 25 KB.
      expect(svg.length, name).toBeLessThan(40 * 1024);
    }
  });

  it('no stray icon files outside the typed list', () => {
    const onDisk = fs.readdirSync(pub('icons/features')).map((f) => f.replace(/\.svg$/, '')).sort();
    expect(onDisk).toEqual([...APP_ICONS].sort());
  });

  it('logo files exist and are web-sized (the 10 MB logo SVG must never be shipped)', () => {
    for (const [p, maxKb] of [
      ['brand/logo-mark.png', 60],
      ['brand/logo-horizontal.webp', 120],
      ['favicon.ico', 30],
      ['icons/apple-touch-icon.png', 60],
      ['icons/icon-192.png', 80],
      ['icons/icon-512.png', 300],
      ['icons/icon-maskable-512.png', 300],
    ] as const) {
      expect(fs.existsSync(pub(p)), p).toBe(true);
      expect(fs.statSync(pub(p)).size / 1024, p).toBeLessThan(maxKb);
    }
    const all = fs.readdirSync(pub('brand'));
    expect(all.filter((f) => f.endsWith('.svg'))).toEqual([]);
  });
});
