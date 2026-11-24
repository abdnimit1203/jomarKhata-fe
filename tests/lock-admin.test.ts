/**
 * Owner, 2026-11-25: after logout nothing of the khata is visible (login screen only, guest mode
 * must be chosen again); greeting is selectable; admin panel at /admin/login is online-only and
 * never part of /app; a branded 404 page.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reminderMessage } from '@/lib/dues';
import { GREETINGS } from '@/lib/greeting';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]));

describe('locked without a session', () => {
  const shell = read('components/layout/AppShell.tsx');
  const ctx = read('context/JomarkhataContext.tsx');
  it('no login and no guest choice → only the login screen (no home, no settings)', () => {
    expect(shell).toMatch(/authProvider\.available && auth\.status === 'local' && !guestMode\) \{[\s\S]{0,400}<WelcomeScreen onStart=\{\(\) => \{\}\} \/>/);
    expect(shell).toContain('if (!authReady && authProvider.available) return');
  });
  it('logout clears the session AND the guest choice', () => {
    expect(ctx).toMatch(/signOut = useCallback\(async \(\) => \{[\s\S]{0,200}saveSession\(null\);\s*await jomarkhataService\.setGuestMode\(false\);/);
  });
  it('choosing guest on the welcome screen is remembered (until logout)', () => {
    expect(read('components/onboarding/WelcomeScreen.tsx')).toMatch(/await chooseGuest\(\)/);
  });
});

describe('greeting', () => {
  it('options for every shopkeeper; used on home and in the বাকি reminder', () => {
    expect(GREETINGS.map((g) => g.text)).toEqual(['আসসালামু আলাইকুম', 'নমস্কার', 'শুভেচ্ছা', '']);
    expect(reminderMessage({ name: 'করিম', balance: 500 }, 'দোকান', 'নমস্কার')).toMatch(/^নমস্কার করিম,/);
    expect(reminderMessage({ name: 'করিম', balance: 500 }, 'দোকান', '')).toMatch(/^করিম,/);
    expect(read('components/layout/AppShell.tsx')).toContain('{greeting && <p');
    expect(read('components/views/SettingsView.tsx')).toContain('aria-label="সম্ভাষণ"');
  });
  it('settings put the shop first; account/referral is a compact card after backup', () => {
    const s = read('components/views/SettingsView.tsx');
    const at = (x: string) => s.indexOf(x);
    expect(at('<SettingsProfileForm')).toBeLessThan(at('aria-label="সম্ভাষণ"'));
    expect(at('<BackupSection />')).toBeLessThan(at('<AccountSection'));
  });
});

describe('admin panel', () => {
  it('lives at /admin/login + /admin/settings; /admin itself is a 404; noindex; not in robots.txt', () => {
    expect(fs.existsSync(path.join(ROOT, 'app/admin/login/page.tsx'))).toBe(true);
    expect(read('app/admin/page.tsx')).toContain('notFound()');
    expect(read('app/admin/layout.tsx')).toMatch(/robots: \{ index: false/);
    expect(read('app/robots.ts')).not.toContain('/admin');
  });
  it('never cached by the service worker', () => {
    expect(read('public/sw.js')).toContain("!url.pathname.startsWith('/admin')");
  });
  it('nothing under /app imports admin code', () => {
    const appFiles = [...walk('app/app'), ...walk('components').filter((f) => !f.startsWith('components/admin/'))];
    for (const f of appFiles) expect(read(f), f).not.toMatch(/components\/admin/);
  });
  it('a branded 404 page with a way home', () => {
    const nf = read('app/not-found.tsx');
    expect(nf).toContain('৪০৪');
    expect(nf).toContain('href="/"');
  });
});
