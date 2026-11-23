/** Month + year selection (any month, not only "this month"). */
import { toBanglaDigits } from './format';

export const BANGLA_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
] as const;

export interface MonthValue {
  year: number;
  /** 0 = January */
  month: number;
}

export const currentMonth = (d = new Date()): MonthValue => ({ year: d.getFullYear(), month: d.getMonth() });

/** First moment to last moment of that month, in local time. */
export function monthRange({ year, month }: MonthValue): { start: Date; end: Date } {
  return { start: new Date(year, month, 1, 0, 0, 0, 0), end: new Date(year, month + 1, 0, 23, 59, 59, 999) };
}

export function shiftMonth({ year, month }: MonthValue, by: number): MonthValue {
  const d = new Date(year, month + by, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function monthLabel({ year, month }: MonthValue): string {
  return `${BANGLA_MONTHS[month]} ${toBanglaDigits(year)}`;
}

/** Years to offer: from the oldest record's year (or this year) up to this year. */
export function yearOptions(isoDates: Array<string | undefined>, now = new Date()): number[] {
  let min = now.getFullYear();
  for (const iso of isoDates) {
    if (!iso) continue;
    const y = new Date(iso).getFullYear();
    if (Number.isFinite(y) && y < min) min = y;
  }
  return Array.from({ length: now.getFullYear() - min + 1 }, (_, i) => now.getFullYear() - i);
}
