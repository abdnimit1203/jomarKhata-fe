/**
 * Helpline / developer contact via WhatsApp with a ready-made message.
 * The number comes from NEXT_PUBLIC_SUPPORT_WHATSAPP (set in Vercel → Project → Environment
 * Variables, e.g. 01XXXXXXXXX). While it's empty, the help button stays hidden.
 */
import { toWhatsAppNumber } from './dues';

export const APP_VERSION_LABEL = '0.1.0';

export function supportNumber(): string | null {
  const raw = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';
  return raw ? toWhatsAppNumber(raw) : null;
}

/** Shop name and app version help support; no financial data is ever included. */
export function supportMessage(shopName?: string): string {
  return [
    'আসসালামু আলাইকুম, জমারখাতা অ্যাপ থেকে লিখছি।',
    shopName ? `দোকান: ${shopName}` : null,
    `অ্যাপ ভার্সন: ${APP_VERSION_LABEL}`,
    'আমার প্রশ্ন / সমস্যা: ',
  ]
    .filter(Boolean)
    .join('\n');
}

export function supportLink(shopName?: string): string | null {
  const n = supportNumber();
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(supportMessage(shopName))}` : null;
}
