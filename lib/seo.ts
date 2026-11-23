/**
 * On-page SEO settings in one place.
 * - Site URL: NEXT_PUBLIC_SITE_URL, else Vercel's production domain (set automatically on Vercel).
 * - Developer credit: name always; the portfolio link only when NEXT_PUBLIC_DEVELOPER_URL is set.
 */
export const SITE_NAME = 'জমারখাতা (Jomarkhata)';
export const SITE_TAGLINE = 'দোকানের সব হিসাব, এক খাতায়।';
export const SITE_DESCRIPTION =
  'জমারখাতা — বাংলাদেশের দোকানদারদের জন্য ইন্টারনেট ছাড়াই চলা ডিজিটাল হিসাবখাতা। বিক্রি, কেনা, পাওনা-দেনা, খরচ, স্টক ও রিপোর্ট এক অ্যাপে। Free offline bookkeeping app for shops in Bangladesh.';
export const SITE_KEYWORDS = [
  'জমারখাতা', 'হিসাবের অ্যাপ', 'দোকানের হিসাব', 'বাকির হিসাব', 'পাওনা দেনা', 'ডিজিটাল খাতা', 'ক্যাশ বই',
  'Jomarkhata', 'bookkeeping app Bangladesh', 'offline accounting app', 'shop khata app', 'due book app',
];

export const DEVELOPER = {
  name: 'Abdullah Ibne Ali',
  url: process.env.NEXT_PUBLIC_DEVELOPER_URL || undefined,
};

export function siteUrl(): URL {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(fromEnv || (vercel ? `https://${vercel}` : 'http://localhost:3000'));
}
