/**
 * Helpline: WhatsApp (ready-made message) and email. Both are set by the owner in the admin
 * dashboard → Settings (served by GET /config, cached on the device); NEXT_PUBLIC_SUPPORT_WHATSAPP
 * is only the fallback. Empty → that button stays hidden.
 */
import { greetingText } from "./greeting";
import { toWhatsAppNumber } from "./dues";
import { APP_VERSION } from "./version";
import { getServerConfig } from "./serverConfig";

export const APP_VERSION_LABEL = APP_VERSION;

export function supportNumber(): string | null {
  const raw = getServerConfig().supportWhatsApp;
  return raw ? toWhatsAppNumber(raw) : null;
}

/** Shop name and app version help support; no financial data is ever included. */
export function supportMessage(shopName?: string): string {
  return [
    `${greetingText() ? `${greetingText()}, ` : ""}জমারখাতা অ্যাপ থেকে লিখছি।`,
    shopName ? `দোকান: ${shopName}` : null,
    `অ্যাপ ভার্সন: ${APP_VERSION_LABEL}`,
    "আমার প্রশ্ন / সমস্যা: ",
  ]
    .filter(Boolean)
    .join("\n");
}

export function supportLink(shopName?: string): string | null {
  const n = supportNumber();
  return n
    ? `https://wa.me/${n}?text=${encodeURIComponent(supportMessage(shopName))}`
    : null;
}

export function supportEmailLink(shopName?: string): string | null {
  const email = getServerConfig().supportEmail;
  if (!email) return null;
  const subject = `জমারখাতা — সাহায্য${shopName ? ` (${shopName})` : ""}`;
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(supportMessage(shopName))}`;
}
