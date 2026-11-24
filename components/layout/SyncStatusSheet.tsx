'use client';

import React, { useEffect, useState } from 'react';
import { CloudOff, Smartphone } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { useOnline } from '@/hooks/use-online';
import { formatBanglaDateTime, formatBanglaNumber } from '@/lib/format';
import type { SyncQueueItem } from '@/types/domain';

const ENTITY_LABEL: Record<string, string> = {
  sale: 'বিক্রি',
  purchase: 'কেনা',
  due_transaction: 'বাকি লেনদেন',
  expense: 'খরচ',
  party: 'পার্টি',
  product: 'পণ্য',
  money_movement: 'টাকার হিসাব',
  stock_movement: 'স্টকের হিসাব',
  business_profile: 'দোকানের তথ্য',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'পাঠানো বাকি',
  syncing: 'পাঠানো হচ্ছে',
  failed: 'পাঠানো যায়নি',
  needs_review: 'যাচাই দরকার',
  synced: 'ক্লাউডে সংরক্ষিত',
};

/**
 * সিঙ্ক অবস্থা (S9, plan 7.7). Honest until the backend exists: everything is saved on this phone,
 * and nothing has been sent to a cloud. Shows the outbox (pending / failed / needs review).
 */
export function SyncStatusSheet({ onClose }: { onClose: () => void }) {
  const { actions, data } = useJomarkhata();
  const online = useOnline();
  const [state, setState] = useState<{ counts: Record<string, number>; items: SyncQueueItem[] } | null>(null);

  useEffect(() => {
    void actions.getSyncStatus().then(setState);
  }, [actions, data]);

  const waiting = state ? state.counts.pending + state.counts.failed + state.counts.syncing + state.counts.needs_review : 0;

  return (
    <ModalSheet open onClose={onClose} title="হিসাব কোথায় রাখা আছে" subtitle={online ? 'ইন্টারনেট আছে' : 'ইন্টারনেট নেই — সমস্যা নেই, অ্যাপ চলবে'}>
      <div className="space-y-3 pb-2">
        <div className="flex items-start gap-3 rounded-2xl bg-tile-green-bg p-4">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-tile-green-fg" />
          <div>
            <p className="text-base font-bold text-ink">সব হিসাব এই ফোনে সংরক্ষিত</p>
            <p className="text-sm text-ink-muted">ইন্টারনেট থাকুক বা না থাকুক, লেখা প্রতিটি হিসাব সাথে সাথে ফোনে জমা হয়।</p>
          </div>
        </div>
        <div className="flex items-start gap-3 rounded-2xl bg-surface-muted p-4">
          <CloudOff className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
          <div>
            <p className="text-base font-bold text-ink">ক্লাউড ব্যাকআপ এখনও চালু হয়নি</p>
            <p className="text-sm text-ink-muted">
              {formatBanglaNumber(waiting)}টি পরিবর্তন ক্লাউডে পাঠানোর জন্য অপেক্ষায় আছে। অ্যাকাউন্ট ও ক্লাউড চালু হলে নিজে থেকেই যাবে। ততদিন
              সেটিংস থেকে ব্যাকআপ ফাইল রাখুন।
            </p>
          </div>
        </div>

        {state && (
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['pending', 'failed', 'needs_review'] as const).map((k) => (
              <div key={k} className="rounded-xl bg-canvas p-2.5">
                <p className="text-lg font-bold tabular-nums text-ink">{formatBanglaNumber(state.counts[k] ?? 0)}</p>
                <p className="text-xs text-ink-muted">{STATUS_LABEL[k]}</p>
              </div>
            ))}
          </div>
        )}

        {state && state.items.length > 0 && (
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink-muted">সাম্প্রতিক পরিবর্তন</p>
            <ul className="divide-y divide-border rounded-2xl bg-white shadow-card">
              {state.items.slice(0, 20).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      {ENTITY_LABEL[i.entityType] ?? i.entityType} · {i.operation === 'void' ? 'বাতিল' : 'সংরক্ষণ'}
                    </span>
                    <span className="block text-xs text-ink-muted">{formatBanglaDateTime(i.queuedAt)}</span>
                    {i.lastError && <span className="block text-xs text-danger">{i.lastError}</span>}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-ink-muted">{STATUS_LABEL[i.status] ?? i.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ModalSheet>
  );
}
