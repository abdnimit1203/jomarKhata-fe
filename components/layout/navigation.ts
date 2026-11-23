import type { AppRoute } from '@/types/domain';
import type { AppIconName } from '@/components/ui/AppIcon';
import type { FeatureTone } from '@/components/ui/FeatureIcon';

/** Screen titles shown in the top bar (S2). */
export const ROUTE_TITLES: Record<AppRoute, string> = {
  dashboard: 'হোম',
  sales: 'বেচার খাতা',
  purchases: 'কেনার খাতা',
  dues: 'বাকির খাতা',
  ledger: 'সব লেনদেন',
  cash: 'ক্যাশ ও খরচ',
  stock: 'স্টক',
  reports: 'রিপোর্ট',
  settings: 'সেটিংস',
};

/** "আরও" menu: every screen that isn't a bottom tab. */
export const MORE_ITEMS: Array<{ route: AppRoute; label: string; hint: string; icon: AppIconName; tone: FeatureTone }> = [
  { route: 'sales', label: 'বেচার খাতা', hint: 'সব বিক্রির তালিকা', icon: 'book-sales', tone: 'green' },
  { route: 'purchases', label: 'কেনার খাতা', hint: 'সব কেনার তালিকা', icon: 'book-purchase', tone: 'blue' },
  { route: 'cash', label: 'ক্যাশ ও খরচ', hint: 'ক্যাশ বক্স, খরচের খাতা', icon: 'cashbox', tone: 'gold' },
  { route: 'stock', label: 'স্টক', hint: 'পণ্য ও মজুদ', icon: 'stock', tone: 'indigo' },
  { route: 'reports', label: 'রিপোর্ট', hint: 'লাভ-ক্ষতি, বিক্রি ও খরচ', icon: 'reports', tone: 'sky' },
  { route: 'settings', label: 'সেটিংস', hint: 'দোকানের তথ্য, ব্যাকআপ', icon: 'settings', tone: 'slate' },
];

/** Routes that the "আরও" tab represents (so the tab shows as active). */
export const MORE_ROUTES: AppRoute[] = MORE_ITEMS.map((i) => i.route);
