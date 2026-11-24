/**
 * Simple-for-shopkeepers pass (owner, 2026-11-24): one-button welcome with the illustration,
 * sign-in first (accounts are mandatory), no demo on the first screen, a first-run guide that
 * points at real buttons, folded optional form fields, plain words, and a visible app version.
 */
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import type { AuthProvider } from '@/lib/auth';
import { noBackendAuthProvider } from '@/lib/auth';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');

describe('welcome: one choice, sign-in first', () => {
  const welcome = read('components/onboarding/WelcomeScreen.tsx');
  it('full-screen illustration (small WebP, cached offline) with one "শুরু করুন" button that opens sign-in', () => {
    expect(welcome).toContain('/brand/welcome-banner.webp');
    expect(fs.statSync(path.join(ROOT, 'public/brand/welcome-banner.webp')).size).toBeLessThan(120 * 1024);
    expect(read('public/sw.js')).toContain("'/brand/welcome-banner.webp'");
    expect(welcome).toMatch(/onClick=\{\(\) => setShowAuth\(true\)\}[\s\S]{0,400}শুরু করুন/);
  });
  it('no demo and no separate "start without account" on the first screen; backup restore stays', () => {
    expect(welcome).not.toMatch(/ডেমো|onDemo/);
    expect(welcome).not.toMatch(/আমার খাতা শুরু করুন/);
    expect(welcome).toMatch(/<RestoreFlow \/>/);
  });
  it('sign-in: Google + email/password; guest / test mode always offered; warning only without login config', () => {
    const noop = () => {};
    const off = renderToStaticMarkup(React.createElement(AuthScreen, { onBack: noop, onGuest: noop, provider: noBackendAuthProvider }));
    expect(off).toContain('গেস্ট / টেস্ট মোডে চালান');
    expect(off).toContain('এখনও চালু হয়নি');
    const real: AuthProvider = { ...noBackendAuthProvider, available: true };
    const on = renderToStaticMarkup(React.createElement(AuthScreen, { onBack: noop, onGuest: noop, provider: real }));
    expect(on).toContain('গেস্ট / টেস্ট মোডে চালান');
    expect(on).not.toContain('এখনও চালু হয়নি');
    expect(on).toContain('id="auth-email"');
    expect(on).toContain('id="auth-password"');
  });
});

describe('first-run guide', () => {
  const guide = read('components/onboarding/FirstRunGuide.tsx');
  it('every step points at a real tagged element', () => {
    const targets = [...guide.matchAll(/target: '([a-z]+)'/g)].map((m) => m[1]);
    expect(targets).toEqual(['hero', 'add', 'dues', 'ledger', 'more']);
    const ui = read('components/layout/AppShell.tsx') + read('components/views/DashboardView.tsx');
    expect(ui).toContain('data-guide="hero"');
    expect(ui).toContain('data-guide="add"');
    expect(ui).toContain('data-guide={tab.id}'); // dues, ledger, more tabs
  });
  it('shown once on the real khata home screen; replay from Settings', () => {
    expect(read('components/layout/AppShell.tsx')).toMatch(/<FirstRunGuide enabled=\{[^}]*mode === 'real' && isHome\} \/>/);
    expect(read('components/views/SettingsView.tsx')).toMatch(/replayGuide\(\)/);
    expect(guide).toContain("localStorage.getItem(KEY) === 'done'");
  });
});

describe('shorter forms and plain words', () => {
  it('sale form: discount, description, cost and note are folded behind one "আরও তথ্য" button', () => {
    const sale = read('components/sheets/SaleFormSheet.tsx');
    expect(sale).toMatch(/showMore \? \(/);
    expect(sale).toContain('+ আরও তথ্য (ছাড়, বিবরণ, নোট — ঐচ্ছিক)');
  });
  it('shop setup asks only for cash first', () => {
    expect(read('components/onboarding/ShopSetupScreen.tsx')).toContain('+ বিকাশ, নগদ বা ব্যাংকে টাকা আছে?');
  });
  it('no technical words in the UI', () => {
    const files = ['components/layout/AppShell.tsx', 'components/layout/NavSheets.tsx', 'components/views/LedgerView.tsx', 'components/views/ReportsView.tsx', 'components/views/SettingsView.tsx'];
    for (const f of files) expect(read(f), f).not.toMatch(/লেজার|Opening Balances|CSV ডাউনলোড|সিঙ্ক অবস্থা|IndexedDB|সিঙ্ক কিউ/);
  });
  it('app version comes from package.json and is shown in Settings', () => {
    expect(read('next.config.ts')).toMatch(/NEXT_PUBLIC_APP_VERSION: version/);
    expect(read('components/views/SettingsView.tsx')).toMatch(/appVersionLabel\(\)/);
  });
});
