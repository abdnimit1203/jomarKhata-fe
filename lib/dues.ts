/**
 * Pure helpers for the Due Book (S5). No React, no database: easy to test.
 * Balance sign everywhere: positive = পাবো (they owe us), negative = দিবো (we owe them).
 */
import { formatTaka } from './format';
import type { Party } from '@/types/domain';

export type DueEntryType = 'customer_collection' | 'supplier_payment' | 'manual_due_given' | 'manual_due_received';
export type DueFlow = 'give' | 'take'; // দিচ্ছি / নিচ্ছি

/**
 * Two plain questions map onto the 4 existing service entry types (no service change):
 *   দিচ্ছি + টাকা দিয়ে   → supplier_payment     (money out, balance up)
 *   দিচ্ছি + শুধু বাকিতে → manual_due_given     (no money,  balance up)
 *   নিচ্ছি + টাকা দিয়ে   → customer_collection  (money in,  balance down)
 *   নিচ্ছি + শুধু বাকিতে → manual_due_received  (no money,  balance down)
 */
export function toEntryType(flow: DueFlow, withMoney: boolean): DueEntryType {
  if (flow === 'give') return withMoney ? 'supplier_payment' : 'manual_due_given';
  return withMoney ? 'customer_collection' : 'manual_due_received';
}

export function fromEntryType(t: DueEntryType): { flow: DueFlow; withMoney: boolean } {
  switch (t) {
    case 'supplier_payment':
      return { flow: 'give', withMoney: true };
    case 'manual_due_given':
      return { flow: 'give', withMoney: false };
    case 'customer_collection':
      return { flow: 'take', withMoney: true };
    default:
      return { flow: 'take', withMoney: false };
  }
}

/** Bengali digits → ASCII, lower-case, no spaces/dashes: "০১৭১২" matches "01712". */
export function normalizeSearch(text: string): string {
  return text
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .toLowerCase()
    .replace(/[\s-]/g, '');
}

export function partyMatches(p: Pick<Party, 'name' | 'phone'>, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(p.name).includes(q) || normalizeSearch(p.phone || '').includes(q);
}

export function balanceText(balance: number): string {
  if (balance > 0) return `পাবো ${formatTaka(balance)}`;
  if (balance < 0) return `দিবো ${formatTaka(Math.abs(balance))}`;
  return 'বাকি নেই';
}

/** Bangladeshi mobile → international digits for wa.me (01XXXXXXXXX → 8801XXXXXXXXX). */
export function toWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/\D/g, '');
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`;
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits;
  return null;
}

export function reminderMessage(party: Pick<Party, 'name' | 'balance'>, shopName: string): string {
  return `আসসালামু আলাইকুম ${party.name}, ${shopName} থেকে বলছি। আপনার কাছে বর্তমান বাকি ${formatTaka(Math.abs(party.balance))}। সুবিধামতো পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।`;
}
