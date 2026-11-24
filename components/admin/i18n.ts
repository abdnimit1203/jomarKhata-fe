'use client';

/**
 * Admin panel language: বাংলা ⇄ English (owner, 2026-11-25; the admin panel only — the shop app
 * stays Bangla). Strings are written in Bangla in the components and wrapped in tr('…'); in English
 * mode they are looked up here (anything missing simply stays Bangla, so nothing breaks).
 * Choice is per browser (localStorage).
 */
import { useCallback, useSyncExternalStore } from 'react';

export type AdminLang = 'bn' | 'en';
const KEY = 'jk_admin_lang';
const EVENT = 'jk:admin-lang';

const EN: Record<string, string> = {
  // shell / menu
  'ড্যাশবোর্ড': 'Dashboard',
  'সাবস্ক্রিপশন রিকোয়েস্ট': 'Subscription requests',
  'সাবস্ক্রিপশন অর্ডার': 'Subscription orders',
  'ইউজার': 'Users',
  'সেটিংস': 'Settings',
  'লগআউট': 'Log out',
  'সুপার অ্যাডমিন': 'Super admin',
  'অ্যাডমিন': 'Admin',
  'জমারখাতা': 'Jomarkhata',
  'মেনু': 'Menu',
  'মেনু বন্ধ': 'Close menu',
  'লোড হচ্ছে…': 'Loading…',
  'লোড করা যায়নি।': 'Could not load.',
  'করা যায়নি।': 'Could not do that.',
  'এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।': 'This account has no admin access.',
  'সার্ভারে যোগাযোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।': 'Could not reach the server. Check the internet and try again.',
  // dashboard
  'মোট ইউজার': 'Total users',
  'ট্রায়ালে': 'On trial',
  'পেইড': 'Paid',
  'মেয়াদ শেষ': 'Expired',
  'নতুন পেমেন্ট রিকোয়েস্ট': 'New payment requests',
  '৭ দিনের মধ্যে মেয়াদ শেষ হবে': 'Ending within 7 days',
  'সামনের ৭ দিনে কারো মেয়াদ শেষ হচ্ছে না।': 'No subscription ends in the next 7 days.',
  'নতুন ইউজার (গত ৩০ দিন)': 'New users (last 30 days)',
  'আয় (গত ৬ মাস)': 'Revenue (last 6 months)',
  'সাবস্ক্রিপশনের অবস্থা': 'Subscription status',
  'ট্রায়াল': 'Trial',
  'নতুন ইউজার': 'New users',
  'আয় (টাকা)': 'Revenue (BDT)',
  // users table
  'কাউকে পাওয়া যায়নি।': 'Nobody found.',
  'আইডি': 'ID',
  'দোকান / নাম': 'Shop / name',
  'ইমেইল · ফোন': 'Email · phone',
  'অবস্থা': 'Status',
  'মেয়াদ': 'Valid until',
  'যোগ দিয়েছেন': 'Joined',
  '(বন্ধ)': '(blocked)',
  '(অ্যাডমিন)': '(admin)',
  'দিন বাকি': 'days left',
  'আইডি, ইমেইল, ফোন, দোকান বা রেফারেল কোড': 'ID, email, phone, shop or referral code',
  'ইউজার খুঁজুন': 'Search users',
  'খুঁজুন': 'Search',
  'কাদের দেখাবে': 'Show',
  'সবাই': 'All',
  'বন্ধ': 'Blocked',
  'মোট': 'Total',
  'আগের': 'Previous',
  'পরের': 'Next',
  // payments
  'TrxID, আইডি, ইমেইল, দোকান বা নম্বর': 'TrxID, ID, email, shop or number',
  'পেমেন্ট খুঁজুন': 'Search payments',
  'কোন রিকোয়েস্ট': 'Which requests',
  'অপেক্ষায়': 'Pending',
  'অনুমোদিত': 'Approved',
  'বাতিল': 'Rejected',
  'সব': 'All',
  'নতুন কোনো রিকোয়েস্ট নেই।': 'No new requests.',
  'কিছু নেই।': 'Nothing here.',
  'তারিখ': 'Date',
  'দোকান / আইডি': 'Shop / ID',
  'প্ল্যান': 'Plan',
  'টাকা': 'Amount',
  'মাধ্যম · নম্বর': 'Method · number',
  'কারণ': 'Reason',
  'অনুমোদন': 'Approve',
  'বাতিল করুন': 'Reject',
  'না': 'No',
  'পর্যন্ত': 'until',
  'দিন': 'days',
  'বিকাশ': 'bKash',
  'নগদ': 'Nagad',
  'ব্যাংক': 'Bank',
  'ক্যাশ': 'Cash',
  'ফ্রি': 'Free',
  // user detail
  '← সব ইউজার': '← All users',
  'ইমেইল': 'Email',
  'ফোন': 'Phone',
  'চালু': 'Active',
  'রেফারেল কোড': 'Referral code',
  'যাকে দিয়ে এসেছে': 'Referred by',
  'শেষ দেখা': 'Last seen',
  'চালু করুন': 'Unblock',
  'বন্ধ করুন': 'Block',
  'সাবস্ক্রিপশন': 'Subscription',
  'টাকা (ঐচ্ছিক)': 'Amount (optional)',
  'TrxID (ঐচ্ছিক)': 'TrxID (optional)',
  'নোট (ঐচ্ছিক)': 'Note (optional)',
  'মাধ্যম': 'Method',
  'দিন বাড়ান': 'Add days',
  'শেষ তারিখ': 'End date',
  'এই তারিখ পর্যন্ত': 'Until this date',
  'এখনই মেয়াদ শেষ': 'Expire now',
  'দিন বাড়ালে বাকি থাকা দিনের পরে যোগ হয়। প্রতিটা বদল নিচের ইতিহাসে থাকে।': 'Added days go after the remaining days. Every change is kept in the history below.',
  'টাকা, TrxID আর নোট ঐচ্ছিক — শুধু রেকর্ড রাখার জন্য (যেমন কেউ সরাসরি টাকা দিল, বা প্রচারের জন্য ফ্রি দিন)।':
    'Amount, TrxID and note are optional — only for the record (e.g. paid you directly, or free days for promotion).',
  'সাবস্ক্রিপশনের ইতিহাস': 'Subscription history',
  'এখনও কোনো বদল নেই।': 'No changes yet.',
  'কাজ': 'Action',
  'আগে → পরে': 'Before → after',
  'টাকা · মাধ্যম': 'Amount · method',
  'TrxID · নোট': 'TrxID · note',
  'কে করেছে': 'By',
  'এই ইউজারের রেফারেলে এসেছে': 'Joined with this user’s code',
  'এখনও কেউ না।': 'Nobody yet.',
  'মেয়াদ বাড়ানো': 'Extended',
  'তারিখ ঠিক করা': 'Date set',
  'মেয়াদ শেষ করা': 'Expired',
  // settings
  'সংরক্ষণ হয়েছে। অ্যাপে কয়েক মিনিটের মধ্যে বদলাবে।': 'Saved. The app updates within a few minutes.',
  'সংরক্ষণ করা যায়নি।': 'Could not save.',
  'প্ল্যান ও দাম': 'Plans & prices',
  'প্ল্যানের নাম': 'Plan name',
  'যেমন: ৬ মাস': 'e.g. 6 months',
  'দাম (টাকা)': 'Price (BDT)',
  'মুছুন': 'Delete',
  'নাম · দিন · দাম (টাকা)। অ্যাপের ‘নবায়ন’ পাতায় এগুলোই দেখাবে।': 'Name · days · price (BDT). Shown on the app’s renew screen.',
  'প্ল্যান যোগ করুন': 'Add plan',
  'পেমেন্টের নম্বর ও সাহায্য': 'Payment numbers & help',
  'বিকাশ নম্বর': 'bKash number',
  'নগদ নম্বর': 'Nagad number',
  'ব্যাংক অ্যাকাউন্ট': 'Bank account',
  'WhatsApp হেল্পলাইন': 'WhatsApp helpline',
  'অ্যাপের ‘সাহায্য দরকার?’ বাটনে যাবে।': 'Used by the app’s “Need help?” button.',
  'ট্রায়াল ও রেফারেল': 'Trial & referral',
  'ফ্রি ট্রায়াল (দিন)': 'Free trial (days)',
  'শুধু নতুন অ্যাকাউন্টে খাটবে।': 'Applies to new accounts only.',
  'রেফারেল কমিশন (%)': 'Referral commission (%)',
  'বদলালে শুধু পরের পেমেন্টে খাটবে।': 'A change applies to later payments only.',
  'টেলিগ্রাম অ্যালার্ট': 'Telegram alerts',
  'বট চালু আছে (token সার্ভারের .env-এ)।': 'Bot is on (token in the server .env).',
  'বট token সেট করা নেই (সার্ভারের .env-এ TELEGRAM_BOT_TOKEN দিন)।': 'Bot token not set (add TELEGRAM_BOT_TOKEN to the server .env).',
  'কাকে মেসেজ যাবে (chat ID, কমা দিয়ে একাধিক)': 'Who receives alerts (chat IDs, comma-separated)',
  '@userinfobot থেকে নিজের ID নিন। বটকে একবার /start পাঠাতে হবে।': 'Get your ID from @userinfobot. Send /start to the bot once.',
  'সংরক্ষণ হচ্ছে…': 'Saving…',
  'সংরক্ষণ করুন': 'Save',
  // login
  'অ্যাডমিন প্যানেল': 'Admin panel',
  'জমারখাতা · শুধু অনুমোদিত অ্যাকাউন্ট': 'Jomarkhata · authorised accounts only',
  'লগইন সেট করা নেই (Firebase / API env)।': 'Login is not configured (Firebase / API env).',
  'পাসওয়ার্ড': 'Password',
  'যাচাই হচ্ছে…': 'Checking…',
  'লগইন': 'Log in',
  'অথবা': 'or',
  'Google দিয়ে লগইন': 'Continue with Google',
  'লগইন করা যায়নি।': 'Could not log in.',
};

function read(): AdminLang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'bn';
  } catch {
    return 'bn';
  }
}

export function setAdminLang(lang: AdminLang) {
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useAdminLang(): AdminLang {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      return () => window.removeEventListener(EVENT, cb);
    },
    read,
    () => 'bn',
  );
}

/** tr('বাংলা লেখা') → English in English mode, else unchanged. */
export function useTr() {
  const lang = useAdminLang();
  return useCallback((bn: string) => (lang === 'en' ? (EN[bn] ?? bn) : bn), [lang]);
}

/** Dates for the admin: dd/MM/yyyy (Bangla digits in বাংলা mode). */
export function useFmtDate() {
  const lang = useAdminLang();
  return useCallback(
    (d: string | Date | null | undefined) => {
      if (!d) return '—';
      const x = new Date(d);
      if (Number.isNaN(x.getTime())) return '—';
      const p = (n: number) => String(n).padStart(2, '0');
      const s = `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
      return lang === 'en' ? s : s.replace(/\d/g, (c) => '০১২৩৪৫৬৭৮৯'[Number(c)]);
    },
    [lang],
  );
}

/** Numbers: Bangla digits in বাংলা mode. */
export function useNum() {
  const lang = useAdminLang();
  return useCallback((n: number) => (lang === 'en' ? n.toLocaleString('en-IN') : n.toLocaleString('en-IN').replace(/\d/g, (c) => '০১২৩৪৫৬৭৮৯'[Number(c)])), [lang]);
}
