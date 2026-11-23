/**
 * S5: Due Book helpers and the role-aware form mapping, checked against the real service.
 */
import { describe, expect, it } from 'vitest';
import { balanceText, fromEntryType, normalizeSearch, partyMatches, reminderMessage, toEntryType, toWhatsAppNumber } from '@/lib/dues';
import { bootEmptyShop } from './helpers/app';
import { assertLedgerInvariants } from './helpers/invariants';

describe('দিচ্ছি/নিচ্ছি × টাকা দিয়ে/শুধু বাকিতে → the 4 existing entry types', () => {
  it('maps both ways for all 4 combinations', () => {
    const combos = [
      ['give', true, 'supplier_payment'],
      ['give', false, 'manual_due_given'],
      ['take', true, 'customer_collection'],
      ['take', false, 'manual_due_received'],
    ] as const;
    for (const [flow, money, type] of combos) {
      expect(toEntryType(flow, money)).toBe(type);
      expect(fromEntryType(type)).toEqual({ flow, withMoney: money });
    }
  });

  it('real service: দিচ্ছি raises the balance, নিচ্ছি lowers it; money moves only "টাকা দিয়ে"', async () => {
    const app = await bootEmptyShop();
    const cust = await app.service.createParty({ name: 'রহিম', phone: '', role: 'customer' });
    const cases = [
      ['give', false, +500, 0], // বাকিতে মাল দিলাম → পাবো বাড়ে, ক্যাশ নড়ে না
      ['take', true, -200, +200], // টাকা নিলাম → পাবো কমে, ক্যাশ বাড়ে
      ['give', true, +100, -100], // টাকা দিলাম → balance up, ক্যাশ কমে
      ['take', false, -50, 0], // বাকিতে নিলাম → balance down, ক্যাশ নড়ে না
    ] as const;
    let balance = 0;
    for (const [flow, money, dBal, dCash] of cases) {
      const before = await app.service.loadAllData();
      const cashBefore = app.calc.computeCurrentBalances(before.businessProfile, before.parties, before.moneyMovements, before.products).cashInHand;
      await app.service.recordDueEntry({ partyId: cust.id, entryType: toEntryType(flow, money), amount: Math.abs(dBal), paymentMethod: money ? 'cash' : undefined });
      const after = await app.service.loadAllData();
      balance += dBal;
      expect(after.parties.find((p) => p.id === cust.id)!.balance).toBe(balance);
      const cashAfter = app.calc.computeCurrentBalances(after.businessProfile, after.parties, after.moneyMovements, after.products).cashInHand;
      expect(cashAfter - cashBefore).toBe(dCash);
    }
    await assertLedgerInvariants(app);
  });

  it('a backdated entry keeps its chosen date', async () => {
    const app = await bootEmptyShop();
    const cust = await app.service.createParty({ name: 'করিম', phone: '', role: 'customer' });
    const date = new Date(2026, 9, 5, 10, 30).toISOString();
    const d = await app.service.recordDueEntry({ partyId: cust.id, entryType: 'manual_due_given', amount: 300, date });
    expect(d.date).toBe(date);
  });
});

describe('party search (Bengali digits, phone or name)', () => {
  const p = { name: 'রহিম স্টোর', phone: '01712-345678' };
  it('matches name, phone, Bengali digits and ignores spaces/dashes', () => {
    expect(partyMatches(p, 'রহিম')).toBe(true);
    expect(partyMatches(p, '01712345678')).toBe(true);
    expect(partyMatches(p, '০১৭১২ ৩৪৫')).toBe(true);
    expect(partyMatches(p, 'করিম')).toBe(false);
    expect(partyMatches(p, '')).toBe(true);
    expect(normalizeSearch('০১৭ AB-c')).toBe('017abc');
  });

  it('searching 5,000 parties stays fast (≤ 100 ms budget)', () => {
    const many = Array.from({ length: 5000 }, (_, i) => ({ name: `কাস্টমার ${i}`, phone: `0171${String(i).padStart(7, '0')}` }));
    const t0 = performance.now();
    for (const q of ['কাস্টমার ৪৯', '01710004', 'নেই']) many.filter((x) => partyMatches(x, q));
    expect(performance.now() - t0).toBeLessThan(100);
  });
});

describe('labels and তাগাদা', () => {
  it('balance always carries our own word: পাওনা / দেনা', () => {
    expect(balanceText(500)).toMatch(/^পাওনা /);
    expect(balanceText(-500)).toMatch(/^দেনা /);
    expect(balanceText(0)).toBe('হিসাব মিটে গেছে');
  });

  it('WhatsApp numbers are Bangladeshi international format; invalid numbers give null', () => {
    expect(toWhatsAppNumber('01712345678')).toBe('8801712345678');
    expect(toWhatsAppNumber('০১৮১২-৩৪৫৬৭৮')).toBe('8801812345678');
    expect(toWhatsAppNumber('+8801912345678')).toBe('8801912345678');
    expect(toWhatsAppNumber('12345')).toBeNull();
  });

  it('reminder message names the party, the shop and the amount', () => {
    const m = reminderMessage({ name: 'রহিম', balance: 1500 }, 'মায়ের দোয়া স্টোর');
    expect(m).toContain('রহিম');
    expect(m).toContain('মায়ের দোয়া স্টোর');
    expect(m).toContain('১,৫০০');
  });
});
