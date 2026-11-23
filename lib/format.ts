import type { PaymentChannel } from '@/types/domain';

const BANGLA_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'] as const;

const BANGLA_MONTHS = [
  'জানুয়ারী',
  'ফেব্রুয়ারী',
  'মার্চ',
  'এপ্রিল',
  'মে',
  'জুন',
  'জুলাই',
  'আগস্ট',
  'সেপ্টেম্বর',
  'অক্টোবর',
  'নভেম্বর',
  'ডিসেম্বর',
] as const;

const BANGLA_SHORT_MONTHS = [
  'জানু',
  'ফেব',
  'মার্চ',
  'এপ্রি',
  'মে',
  'জুন',
  'জুলাই',
  'আগ',
  'সেপ্টে',
  'অক্টো',
  'নভে',
  'ডিসে',
] as const;

export const PAYMENT_CHANNELS: Array<{
  id: PaymentChannel;
  label: string;
  shortLabel: string;
}> = [
  { id: 'cash', label: 'ক্যাশ', shortLabel: 'ক্যাশ' },
  { id: 'bkash', label: 'বিকাশ', shortLabel: 'বিকাশ' },
  { id: 'nagad', label: 'নগদ', shortLabel: 'নগদ' },
  { id: 'bank', label: 'ব্যাংক', shortLabel: 'ব্যাংক' },
];

export const EXPENSE_CATEGORIES = [
  'দোকান ভাড়া',
  'বিদ্যুৎ বিল',
  'কর্মচারী বেতন',
  'পরিবহন',
  'চা-নাস্তা',
  'দোকান মেরামত',
  'অন্যান্য',
] as const;

export const PRODUCT_UNITS = [
  'পিস',
  'কেজি',
  'লিটার',
  'প্যাকেট',
  'বক্স',
  'ডজন',
  'বোতল',
  'বস্তা',
] as const;

export const PRODUCT_CATEGORIES = [
  'মুদি ও খাদ্যসামগ্রী',
  'তেল ও মসলা',
  'পানীয় ও নাস্তা',
  'প্রসাধনী ও পরিষ্কারক',
  'স্টেশনারি',
  'হার্ডওয়্যার',
  'অন্যান্য',
] as const;

export function toBanglaDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input.replace(/[০-৯]/g, (ch) => {
    const idx = BANGLA_DIGITS.indexOf(ch as (typeof BANGLA_DIGITS)[number]);
    return idx >= 0 ? String(idx) : ch;
  });
}

/**
 * Parses numeric input accepting both Bengali (০-৯) and English (0-9) digits.
 */
export function parseNumericInput(raw: string): number {
  const cleaned = toEnglishDigits(raw).replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
  if (!cleaned || cleaned === '-' || cleaned === '.') return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Formats integer/decimal numbers with South Asian grouping (1,25,400) in Bengali digits.
 */
export function formatBanglaNumber(value: number, showDecimals = false): string {
  if (!Number.isFinite(value)) return '০';
  const isNeg = value < 0;
  const abs = Math.abs(value);
  const fixed = showDecimals ? abs.toFixed(2) : Math.round(abs).toString();
  const [intPart, decPart] = fixed.split('.');

  let formattedInt = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    formattedInt = `${groupedRest},${last3}`;
  }

  const combined = decPart && decPart !== '00' ? `${formattedInt}.${decPart}` : formattedInt;
  return `${isNeg ? '-' : ''}${toBanglaDigits(combined)}`;
}

/**
 * Formats Taka amounts consistently: ২,৪০০ ৳ or -১,২০০ ৳
 */
export function formatTaka(amount: number, options?: { showSign?: boolean }): string {
  const rounded = Math.round(amount);
  const absFormatted = formatBanglaNumber(Math.abs(rounded));
  if (rounded < 0) return `-${absFormatted} ৳`;
  if (options?.showSign && rounded > 0) return `+${absFormatted} ৳`;
  return `${absFormatted} ৳`;
}

export function getChannelLabel(channel?: PaymentChannel | null): string {
  if (!channel) return 'বাকি';
  const found = PAYMENT_CHANNELS.find((c) => c.id === channel);
  return found ? found.label : 'ক্যাশ';
}

export function getChannelShortLabel(channel?: PaymentChannel | null): string {
  if (!channel) return 'বাকি';
  const found = PAYMENT_CHANNELS.find((c) => c.id === channel);
  return found ? found.shortLabel : 'ক্যাশ';
}

export function formatBanglaDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = toBanglaDigits(String(d.getDate()).padStart(2, '0'));
  const month = BANGLA_MONTHS[d.getMonth()];
  const year = toBanglaDigits(d.getFullYear());
  return `${day} ${month} ${year}`;
}

export function formatBanglaShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const day = toBanglaDigits(d.getDate());
  const month = BANGLA_SHORT_MONTHS[d.getMonth()];
  return `${day} ${month}`;
}

export function formatBanglaTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const period = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${toBanglaDigits(hours)}:${toBanglaDigits(minutes)} ${period}`;
}

export function formatBanglaDateTime(iso: string): string {
  return `${formatBanglaDate(iso)} · ${formatBanglaTime(iso)}`;
}

export function getRelativeDateGroupLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86_400_000;
  const targetStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  if (targetStart === todayStart) return 'আজ';
  if (targetStart === yesterdayStart) return 'গতকাল';
  return formatBanglaDate(iso);
}

export function getLocalDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `jk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Converts an ISO timestamp (or Date) to a local `yyyy-MM-dd` value for date inputs.
 * The stored value stays ISO; this is for the picker only.
 */
/**
 * Date-input value (yyyy-MM-dd) → ISO string for saving (S6).
 * - New entry dated today → undefined (the service stamps "now").
 * - Editing with the day unchanged → the original ISO (keeps its time).
 * - Any other day → that day at the current time of day (keeps same-day ordering natural).
 */
export function dateInputToIso(value: string, original?: string): string | undefined {
  if (!value) return original;
  if (original && toDateInputValue(original) === value) return original;
  if (!original && value === toDateInputValue(new Date())) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  const now = new Date();
  return new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()).toISOString();
}

export function toDateInputValue(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Display format for date inputs: dd/MM/yyyy in Bengali digits (e.g. "২২/১১/২০২৬").
 * Accepts `yyyy-MM-dd` (date-input value) or an ISO timestamp. Returns '' for empty/invalid input.
 */
export function formatDateInputDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const ymd = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDateInputValue(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!match) return '';
  const [, y, m, d] = match;
  return toBanglaDigits(`${d}/${m}/${y}`);
}
