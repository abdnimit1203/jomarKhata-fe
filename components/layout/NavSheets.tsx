'use client';

import React from 'react';
import { ChevronRight, MessageCircle, RefreshCw } from 'lucide-react';
import { supportLink } from '@/lib/support';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { FeatureIcon, type FeatureTone } from '@/components/ui/FeatureIcon';
import { useJomarkhata, type ActiveSheet } from '@/context/JomarkhataContext';
import { formatBanglaNumber } from '@/lib/format';
import { MORE_ITEMS } from './navigation';

const QUICK_ACTIONS: Array<{ label: string; hint: string; icon: AppIconName; tone: FeatureTone; sheet: ActiveSheet }> = [
  { label: 'বিক্রি', hint: 'নতুন বিক্রি লিখুন', icon: 'sale', tone: 'green', sheet: { type: 'sale' } },
  { label: 'কেনা', hint: 'মাল কেনা', icon: 'purchase', tone: 'blue', sheet: { type: 'purchase' } },
  {
    label: 'টাকা আদায়',
    hint: 'পাওনা টাকা পেলাম',
    icon: 'due-collect',
    tone: 'orange',
    sheet: { type: 'due', defaultEntryType: 'customer_collection' },
  },
  {
    label: 'দেনা শোধ',
    hint: 'দেনার টাকা দিলাম',
    icon: 'supplier-pay',
    tone: 'teal',
    sheet: { type: 'due', defaultEntryType: 'supplier_payment' },
  },
  { label: 'খরচ', hint: 'দোকানের খরচ', icon: 'expense', tone: 'red', sheet: { type: 'expense' } },
];

/** "+" in the bottom bar: the five everyday entries, two taps from anywhere. */
export function QuickAddSheet({ onClose }: { onClose: () => void }) {
  const { openSheet } = useJomarkhata();
  return (
    <ModalSheet open onClose={onClose} title="নতুন লেনদেন" subtitle="কী লিখবেন বেছে নিন">
      <div className="grid grid-cols-2 gap-3 pb-2">
        {QUICK_ACTIONS.map((a, i) => (
          <button
            key={a.label}
            type="button"
            onClick={() => openSheet(a.sheet)}
            className={`flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left shadow-card transition-transform active:scale-[0.98] ${
              i === QUICK_ACTIONS.length - 1 ? 'col-span-2' : ''
            }`}
          >
            <FeatureIcon tone={a.tone}>
              <AppIcon name={a.icon} />
            </FeatureIcon>
            <span className="min-w-0">
              <span className="block text-base font-bold text-ink">{a.label}</span>
              <span className="block text-xs leading-snug text-ink-muted">{a.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </ModalSheet>
  );
}

/** "আরও" tab: every screen that isn't on the bottom bar. */
export function MoreSheet({ onClose }: { onClose: () => void }) {
  const { navigate, data, openSheet } = useJomarkhata();
  const pending = data?.pendingSyncCount ?? 0;
  const help = supportLink(data?.businessProfile.shopName);
  return (
    <ModalSheet open onClose={onClose} title="আরও" subtitle={data?.businessProfile.shopName || 'জমারখাতা'}>
      <div className="divide-y divide-border">
        {MORE_ITEMS.map((item) => (
          <button
            key={item.route}
            type="button"
            onClick={() => navigate(item.route)}
            className="flex min-h-[64px] w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-canvas"
          >
            <FeatureIcon tone={item.tone} size="sm">
              <AppIcon name={item.icon} />
            </FeatureIcon>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-ink">{item.label}</span>
              <span className="block truncate text-xs text-ink-muted">{item.hint}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-ink-subtle" />
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2">
        <button
          type="button"
          onClick={() => openSheet({ type: 'sync_status' })}
          className="flex min-h-12 items-center gap-3 rounded-2xl bg-surface-muted px-3.5 text-left text-sm font-semibold text-ink"
        >
          <RefreshCw className="h-4 w-4 text-primary-ink" /> সিঙ্ক অবস্থা
        </button>
        {help && (
          <a
            href={help}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 rounded-2xl bg-tile-green-bg px-3.5 text-sm font-bold text-tile-green-fg"
          >
            <MessageCircle className="h-4 w-4" /> সাহায্য দরকার? WhatsApp-এ লিখুন
          </a>
        )}
      </div>
      <p className="mt-3 rounded-2xl bg-surface-muted p-3 text-xs font-medium text-ink-muted">
        সব হিসাব এই ফোনে সংরক্ষিত।{' '}
        {pending > 0 && <>ক্লাউডে পাঠানোর অপেক্ষায় {formatBanglaNumber(pending)}টি পরিবর্তন — ক্লাউড এখনও চালু হয়নি।</>}
      </p>
    </ModalSheet>
  );
}
