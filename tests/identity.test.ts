/**
 * Own identity (owner request 2026-11-23): the app must not reuse another khata app's labels or
 * layout. Plus the month/year selector, WhatsApp help and the compact connection dot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { DUE_CHOICES, balanceSentence, dueRowLabel, entryOf } from '@/lib/dues';
import { BANGLA_MONTHS, monthLabel, monthRange, shiftMonth, yearOptions } from '@/lib/months';
import { supportMessage } from '@/lib/support';
import { bootEmptyShop } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

const ROOT = path.resolve(__dirname, '..');
function uiFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? uiFiles(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []
  );
}
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf8');
/** UI text only: strip comments so explanations may still mention the old words. */
const uiText = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('own wording, not another app’s labels', () => {
  const files = [...uiFiles('components'), ...uiFiles('app')];
  it('no পাবো/দিবো, no "X-এর খাতা" book names, no দিচ্ছি/নিচ্ছি buttons, no "তাগাদা" in the UI', () => {
    const banned = /পাবো|দিবো|বেচার খাতা|কেনার খাতা|বাকির খাতা|খরচের খাতা|খাতা সমূহ|দিচ্ছি|নিচ্ছি|তাগাদা|বাকির বিবরণ|নতুন বাকি/;
    const offenders = files.filter((f) => banned.test(uiText(f)));
    expect(offenders).toEqual([]);
  });
  it('text the service and calculator show or store uses our words too', () => {
    const literals = (f: string) => (read(f).match(/'[^'\n]*'|`[^`]*`/g) ?? []).join('\n');
    for (const f of ['services/financeCalculator.ts', 'services/jomarkhataService.ts']) {
      expect(literals(f), f).not.toMatch(/দিচ্ছি|নিচ্ছি|পাবো|দিবো/);
    }
  });

  it('wording lives in one place (lib/terms.ts) and the Due Book uses it', () => {
    expect(read('lib/terms.ts')).toMatch(/receivable: 'বাকি পাবেন'/);
    expect(read('components/views/DuesView.tsx')).toMatch(/T\.newDueEntry/);
  });
  it('party screen: one "লেনদেন লিখুন" action, not a red/green split pair; month timeline', () => {
    const dues = read('components/views/DuesView.tsx');
    expect(dues).toMatch(/openSheet\(\{ type: 'due', partyId: selectedParty\.id \}\)/);
    expect(dues).not.toMatch(/defaultEntryType: selectedParty\.role/);
    expect(dues).toMatch(/<MonthYearPicker/);
  });
});

describe('four plain due choices → existing entry types (real service)', () => {
  it('each choice moves the balance and cash the way its words say', async () => {
    const app = await bootEmptyShop();
    const p = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    const expectations: Record<string, { bal: number; cash: number }> = {
      gave_credit: { bal: +400, cash: 0 },
      got: { bal: -150, cash: +150 },
      took_credit: { bal: -100, cash: 0 },
      paid: { bal: +50, cash: -50 },
    };
    let bal = 0;
    for (const c of ['gave_credit', 'got', 'took_credit', 'paid'] as const) {
      const e = expectations[c];
      const before = await app.service.loadAllData();
      const cash0 = app.calc.computeCurrentBalances(before.businessProfile, before.parties, before.moneyMovements, before.products).cashInHand;
      const choice = DUE_CHOICES.find((x) => x.key === c)!;
      const row = await app.service.recordDueEntry({ partyId: p.id, entryType: entryOf(c), amount: Math.abs(e.bal), paymentMethod: choice.withMoney ? 'cash' : undefined });
      bal += e.bal;
      const after = await app.service.loadAllData();
      expect(after.parties.find((x) => x.id === p.id)!.balance, c).toBe(bal);
      const cash1 = app.calc.computeCurrentBalances(after.businessProfile, after.parties, after.moneyMovements, after.products).cashInHand;
      expect(cash1 - cash0, c).toBe(e.cash);
      expect(dueRowLabel(row), c).toBe(c); // the timeline reads it back with the same words
    }
    await assertLedgerInvariants(app);
  });
  it('plain sentences', () => {
    expect(balanceSentence('রহিম', 500)).toMatch(/রহিম আপনাকে .* দেবেন/);
    expect(balanceSentence('রহিম', -500)).toMatch(/আপনি রহিম-কে .* দেবেন/);
  });
});

describe('month + year selector', () => {
  it('covers exactly one calendar month (including leap February)', () => {
    const r = monthRange({ year: 2028, month: 1 });
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getDate()).toBe(29);
    expect(monthRange({ year: 2026, month: 10 }).end.getDate()).toBe(30);
  });
  it('steps across years and labels in Bangla', () => {
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
    expect(monthLabel({ year: 2026, month: 10 })).toBe('নভেম্বর ২০২৬');
    expect(BANGLA_MONTHS).toHaveLength(12);
  });
  it('offers years from the oldest record to now', () => {
    expect(yearOptions(['2024-05-01T00:00:00Z', undefined], new Date('2026-11-23'))).toEqual([2026, 2025, 2024]);
  });
  it('is on the dashboard, reports and the party timeline', () => {
    for (const f of ['components/views/DashboardView.tsx', 'components/views/DuesView.tsx', 'components/ui/PeriodFilter.tsx']) {
      expect(read(f), f).toMatch(/<MonthYearPicker/);
    }
    expect(read('components/views/ReportsView.tsx')).toMatch(/<PeriodFilter /); // reports: via the shared filter
  });
});

describe('WhatsApp help + connection dot', () => {
  it('help link is hidden until the number is configured, and carries a ready message (no money data)', async () => {
    // the number comes from the admin dashboard (GET /config, cached on the phone); env is the fallback
    const before = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
    delete process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;
    vi.resetModules();
    expect((await import('@/lib/support')).supportLink('দোকান')).toBeNull();
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = '01712345678';
    vi.resetModules();
    const fresh = await import('@/lib/support');
    const link = fresh.supportLink('মায়ের দোয়া স্টোর')!;
    expect(link).toMatch(/^https:\/\/wa\.me\/8801712345678\?text=/);
    expect(decodeURIComponent(link)).toContain('মায়ের দোয়া স্টোর');
    expect(supportMessage('x')).not.toMatch(/৳/);
    expect(fresh.supportEmailLink('x')).toBeNull(); // no helpline email set
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP = before;
  });
  it('header shows only a pulsing dot (CSS) online and a Wi-Fi-off icon offline, label on hover/tap', () => {
    const shell = read('components/layout/AppShell.tsx');
    expect(shell).toMatch(/jk-pulse/);
    expect(shell).toMatch(/<WifiOff/);
    expect(shell).toMatch(/onMouseEnter=\{\(\) => setShow\(true\)\}/);
    expect(shell).not.toMatch(/ConnectionPill/);
    expect(read('app/globals.css')).toMatch(/@keyframes jk-pulse/);
  });
});
