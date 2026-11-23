/**
 * S2 guard: bottom bar (D2), every screen reachable, back integration and unsaved-form guard.
 * Real back-button behaviour is verified end-to-end in a browser (see CHANGELOG).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MORE_ITEMS, MORE_ROUTES, ROUTE_TITLES } from '@/components/layout/navigation';

const ROOT = path.resolve(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const shell = read('components/layout/AppShell.tsx');
const ctx = read('context/JomarkhataContext.tsx');

describe('bottom bar: হোম · বাকি · [+] · লেনদেন · আরও (D2)', () => {
  it('has exactly these tabs in this order', () => {
    const nav = shell.slice(shell.indexOf('aria-label="মোবাইল নেভিগেশন"'));
    const labels = [...nav.matchAll(/label: '([^']+)'/g)].map((m) => m[1]).slice(0, 5);
    expect(labels).toEqual(['হোম', 'বাকি', 'নতুন', 'লেনদেন', 'আরও']);
  });

  it('every screen is reachable in ≤ 2 taps: tabs + the আরও menu cover all routes', () => {
    const tabs = ['dashboard', 'dues', 'ledger'];
    const covered = new Set([...tabs, ...MORE_ROUTES]);
    expect([...covered].sort()).toEqual(Object.keys(ROUTE_TITLES).sort());
    expect(MORE_ITEMS.every((i) => ROUTE_TITLES[i.route])).toBe(true);
  });

  it('"+" opens the quick-add sheet with the 5 everyday entries', () => {
    expect(shell).toMatch(/openSheet\(\{ type: 'quick_add' \}\)/);
    const sheets = read('components/layout/NavSheets.tsx');
    for (const l of ['বেচা', 'কেনা', 'বাকি আদায়', 'পরিশোধ', 'খরচ']) expect(sheets).toContain(`label: '${l}'`);
  });
});

describe('top bar', () => {
  it('non-home screens show a back button and the screen title', () => {
    expect(shell).toMatch(/aria-label="পিছনে যান"/);
    expect(shell).toMatch(/ROUTE_TITLES\[activeRoute\]/);
  });

  it('online/offline pill reflects connectivity and never claims cloud backup', () => {
    expect(read('hooks/use-online.ts')).toMatch(/navigator\.onLine/);
    expect(shell).toMatch(/ক্লাউড এখনও চালু হয়নি/);
    expect(shell).not.toMatch(/ক্লাউডে সংরক্ষিত/);
  });
});

describe('Android back integration (history API)', () => {
  it('screens, party detail and sheets push history entries; popstate restores them', () => {
    expect(ctx).toMatch(/pushEntry\(entry\)/);
    expect(ctx).toMatch(/route: screenRef\.current\.route, partyId, sheet: false/);
    expect(ctx).toMatch(/\.\.\.screenRef\.current, sheet: true/);
    expect(ctx).toMatch(/addEventListener\('popstate'/);
  });

  it("keeps Next.js's __NA history marker on every entry (otherwise Next reloads the page on back)", () => {
    expect(ctx).toMatch(/\['__NA', '__PRIVATE_NEXTJS_INTERNALS_TREE'\]/);
    const writes = ctx.match(/window\.history\.(push|replace)State\(/g) ?? [];
    expect(writes.length).toBe(2); // only inside pushEntry / replaceEntry
  });

  it('unsaved input asks before discarding (back, X, backdrop); saving clears the guard', () => {
    expect(read('components/ui/ModalSheet.tsx')).toMatch(/addEventListener\('input', markDirty, true\)/);
    expect(ctx).toMatch(/if \(sheetDirtyRef\.current\) setDiscardPrompt\(true\)/);
    expect(ctx).toMatch(/loadAllData\(\);[\s\S]{0,200}sheetDirtyRef\.current = false/);
    expect(shell).toMatch(/<ConfirmDialog[\s\S]*open=\{discardPrompt\}/);
  });
});
