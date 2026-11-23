/**
 * Referral (UI-NOW / BE-LATER; contract in docs/BACKEND_CONTRACT.md §Referral).
 * - Every account gets a unique referral code from the SERVER. The app never makes one up.
 * - At sign-up a referral code is optional. It only records who brought the new user.
 * - The referrer earns 20% of every subscription payment the referred user makes. The server
 *   calculates and pays this; the app only shows what the server reports.
 */
/** Owner's rule (20%). The server's super-admin setting wins when it sends `commissionRate`. */
export const REFERRAL_COMMISSION_RATE = 0.2;

/** Display + input format: upper-case letters/digits, e.g. "JK7Q4M2X". Bengali digits accepted. */
export function normalizeReferralCode(input: string): string | null {
  const ascii = input
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/[\s-]/g, '')
    .toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(ascii) ? ascii : null;
}

/** `?ref=CODE` from a shared link (pre-fills the sign-up field). */
export function referralFromSearch(search: string): string | null {
  const raw = new URLSearchParams(search).get('ref');
  return raw ? normalizeReferralCode(raw) : null;
}

/** Share link and WhatsApp text for the owner's own code. */
export function referralLink(code: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/app?ref=${encodeURIComponent(code)}`;
}

export function referralShareText(code: string, origin: string): string {
  return `দোকানের হিসাব রাখতে জমারখাতা ব্যবহার করুন। অ্যাকাউন্ট খোলার সময় আমার রেফারেল কোড দিন: ${code}\n${referralLink(code, origin)}`;
}
