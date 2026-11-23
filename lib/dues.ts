/**
 * Pure helpers for the Due Book (S5). No React, no database: easy to test.
 * Balance sign everywhere: positive = পাবো (they owe us), negative = দিবো (we owe them).
 */
import { formatTaka } from './format';
import { T } from './terms';
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
  if (balance > 0) return `${T.receivable} ${formatTaka(balance)}`;
  if (balance < 0) return `${T.payable} ${formatTaka(Math.abs(balance))}`;
  return T.settled;
}

/** One plain sentence about where a party stands. */
export function balanceSentence(name: string, balance: number): string {
  if (balance > 0) return `${name} আপনাকে ${formatTaka(balance)} দেবেন`;
  if (balance < 0) return `আপনি ${name}-কে ${formatTaka(Math.abs(balance))} দেবেন`;
  return 'হিসাব মিটে গেছে — কেউ কারো কাছে পায় না';
}

/**
 * The four everyday cases, in plain words. Each maps to one existing service entry type.
 * tone = colour family (green money in, red money out, orange credit given, purple credit taken).
 */
export type DueChoice = 'got' | 'paid' | 'gave_credit' | 'took_credit';
export const DUE_CHOICES: Array<{
  key: DueChoice;
  label: string;
  hint: string;
  entryType: DueEntryType;
  withMoney: boolean;
  tone: 'green' | 'red' | 'orange' | 'purple';
}> = [
  { key: 'got', label: 'টাকা পেলাম', hint: 'উনি আপনাকে টাকা দিলেন', entryType: 'customer_collection', withMoney: true, tone: 'green' },
  { key: 'paid', label: 'টাকা দিলাম', hint: 'আপনি ওনাকে টাকা দিলেন', entryType: 'supplier_payment', withMoney: true, tone: 'red' },
  { key: 'gave_credit', label: 'বাকিতে দিলাম', hint: 'মাল দিলেন, দাম পরে পাবেন', entryType: 'manual_due_given', withMoney: false, tone: 'orange' },
  { key: 'took_credit', label: 'বাকিতে নিলাম', hint: 'মাল নিলেন, দাম পরে দেবেন', entryType: 'manual_due_received', withMoney: false, tone: 'purple' },
];

export const choiceOf = (t: DueEntryType): DueChoice => DUE_CHOICES.find((c) => c.entryType === t)!.key;
export const entryOf = (c: DueChoice): DueEntryType => DUE_CHOICES.find((x) => x.key === c)!.entryType;

/**
 * Notes the app writes by itself (older builds used other words). They repeat the row's label,
 * so the timeline hides them; a note the owner typed is always shown.
 */
const AUTO_NOTES = new Set([
  'বাকি আদায় (নিচ্ছি)', 'সাপ্লায়ার পরিশোধ (দিচ্ছি)', 'বাকি দিচ্ছি', 'বাকি নিচ্ছি',
  'টাকা পেলাম', 'টাকা দিলাম', 'বাকিতে দিলাম', 'বাকিতে নিলাম',
]);
export function ownNote(note?: string | null): string {
  return note && !AUTO_NOTES.has(note.trim()) ? note : '';
}

/** How a recorded due row reads in the party timeline. */
export function dueRowLabel(row: { direction: 'given' | 'received'; moneyMovementId?: string | null; source?: string }): DueChoice {
  if (row.source === 'sale') return 'gave_credit';
  if (row.source === 'purchase') return 'took_credit';
  if (row.direction === 'received') return row.moneyMovementId ? 'got' : 'took_credit';
  return row.moneyMovementId ? 'paid' : 'gave_credit';
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
