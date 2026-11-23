/**
 * Before → after view of an edit, built from the audit log snapshots (S7, plan 6.2).
 * Pure function: only fields a shopkeeper cares about, with Bangla labels and formatted values.
 */
import { formatBanglaNumber, formatDateInputDisplay, formatTaka, getChannelShortLabel } from './format';
import type { AuditLog, PaymentChannel } from '@/types/domain';

export interface FieldChange {
  label: string;
  before: string;
  after: string;
}

type Snap = Record<string, unknown>;
type Fmt = (v: unknown) => string;

const taka: Fmt = (v) => (typeof v === 'number' ? formatTaka(v) : '—');
const text: Fmt = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));
const date: Fmt = (v) => (typeof v === 'string' ? formatDateInputDisplay(v) || '—' : '—');
const channel: Fmt = (v) => (typeof v === 'string' ? getChannelShortLabel(v as PaymentChannel) : 'শুধু বাকি');
const items: Fmt = (v) =>
  Array.isArray(v) && v.length
    ? v
        .map((i: { name?: string; qty?: number; unitPrice?: number }) =>
          `${i.name ?? 'পণ্য'} ${formatBanglaNumber(i.qty ?? 0)}×${formatTaka(i.unitPrice ?? 0)}`
        )
        .join(', ')
    : '—';

/** Field order = display order. Missing fields on both sides are skipped. */
const FIELDS: Array<[key: string, label: string, fmt: Fmt]> = [
  ['total', 'মোট', taka],
  ['amount', 'টাকা', taka],
  ['discount', 'ছাড়', taka],
  ['paidAmount', 'জমা', taka],
  ['dueAmount', 'বাকি', taka],
  ['items', 'পণ্য', items],
  ['paymentMethod', 'মাধ্যম', channel],
  ['date', 'তারিখ', date],
  ['partyName', 'পার্টি', text],
  ['category', 'খাত', text],
  ['title', 'বিবরণ', text],
  ['note', 'নোট', text],
];

function parse(json: string | null | undefined): Snap | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' ? (v as Snap) : null;
  } catch {
    return null;
  }
}

export function diffAudit(log: Pick<AuditLog, 'beforeSnapshot' | 'afterSnapshot'>): FieldChange[] {
  const before = parse(log.beforeSnapshot);
  const after = parse(log.afterSnapshot);
  if (!before || !after) return [];
  const out: FieldChange[] = [];
  for (const [key, label, fmt] of FIELDS) {
    if (!(key in before) && !(key in after)) continue;
    const b = fmt(before[key]);
    const a = fmt(after[key]);
    if (b !== a) out.push({ label, before: b, after: a });
  }
  return out;
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  create: 'তৈরি',
  edit: 'সংশোধন',
  void: 'বাতিল',
  reversal: 'উল্টো এন্ট্রি',
};
