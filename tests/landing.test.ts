/**
 * L1 landing page guard: public page at "/", app at "/app", and only honest claims.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const landing = read('components/landing/LandingPage.tsx');

describe('routing: landing at /, app at /app', () => {
  it('"/" renders the landing page and "/app" renders the app shell', () => {
    expect(read('app/page.tsx')).toMatch(/<LandingPage \/>/);
    expect(read('app/app/page.tsx')).toMatch(/<AppShell \/>/);
  });

  it('only the /app subtree opens the local database (landing stays light)', () => {
    expect(read('app/layout.tsx')).not.toMatch(/JomarkhataProvider/);
    expect(read('app/app/layout.tsx')).toMatch(/<JomarkhataProvider>/);
    expect(landing).not.toMatch(/useJomarkhata|jomarkhataService|dexie/i);
  });

  it('installed apps that still start at "/" are sent to /app', () => {
    expect(landing).toMatch(/<StandaloneRedirect \/>/);
    expect(read('components/landing/StandaloneRedirect.tsx')).toMatch(/display-mode: standalone[\s\S]*replace\('\/app'\)/);
  });

  it('the main calls to action open the app', () => {
    expect((landing.match(/href="\/app"/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it('renders PWA install button in header and hero', () => {
    expect(landing).toMatch(/<PwaInstallButton variant="header" \/>/);
    expect(landing).toMatch(/<PwaInstallButton variant="hero" \/>/);
  });
});

describe('honest claims only (plan §7.2, AGENTS rule 14)', () => {
  it('no claims of features that do not exist yet', () => {
    // "ক্লাউড ব্যাকআপ" may only appear in a "not yet" sentence.
    expect(landing).not.toMatch(/এনক্রিপ্ট|অটো সিঙ্ক|অটো-সিঙ্ক|ব্যাংক-গ্রেড|encrypted|auto-sync/i);
    expect(landing).toMatch(/ক্লাউড ব্যাকআপ এখনও চালু হয়নি/);
  });

  it('no hardcoded prices, ratings, user counts or testimonials', () => {
    expect(landing).not.toMatch(/৳\s*[০-৯0-9]|টাকা\/মাস|★|হাজার\+|জন ব্যবহারকারী/);
  });

  it('does not promise login-free use (D26: login will be mandatory)', () => {
    expect(landing).not.toMatch(/লগইন ছাড়া/);
  });
});
