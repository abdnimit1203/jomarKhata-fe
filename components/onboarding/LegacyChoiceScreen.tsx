'use client';

import React, { useState } from 'react';
import { BookOpen, FlaskConical } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatBanglaNumber } from '@/lib/format';

/**
 * D15: this phone has data from an earlier version (before first-run setup existed).
 * The owner chooses; nothing is deleted or uploaded without that choice.
 */
export function LegacyChoiceScreen() {
  const { data, actions, showToast } = useJomarkhata();
  const [confirmDemo, setConfirmDemo] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  const counts = `${formatBanglaNumber(data.sales.length)}টি বিক্রি, ${formatBanglaNumber(data.parties.length)} জন পার্টি, ${formatBanglaNumber(data.expenses.length)}টি খরচ`;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'কাজটি করা যায়নি।', 'error');
    } finally {
      setBusy(false);
      setConfirmDemo(false);
    }
  };

  return (
    <div className="min-h-dvh bg-canvas">
      <div className="mx-auto max-w-md px-5 pt-10 pb-10">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" width={48} height={48} className="h-12 w-12" />
        <h1 className="mt-5 text-2xl font-extrabold text-ink">এই ফোনে আগের হিসাব আছে</h1>
        <p className="mt-2 text-base text-ink-muted">
          “{data.businessProfile.shopName}” — {counts}। এই হিসাবটা কী?
        </p>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(actions.keepLegacyAsMine)}
            className="flex w-full items-start gap-3 rounded-3xl bg-white p-5 text-left shadow-card transition-transform active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tile-green-bg text-tile-green-fg">
              <BookOpen className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-bold text-ink">আমার ব্যবসার হিসাব হিসেবে রাখুন</span>
              <span className="mt-0.5 block text-sm text-ink-muted">সব হিসাব যেমন আছে তেমনই থাকবে।</span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDemo(true)}
            className="flex w-full items-start gap-3 rounded-3xl bg-white p-5 text-left shadow-card transition-transform active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-tile-purple-bg text-tile-purple-fg">
              <FlaskConical className="h-6 w-6" />
            </span>
            <span>
              <span className="block text-lg font-bold text-ink">ডেমো হিসাব হিসেবে রাখুন</span>
              <span className="mt-0.5 block text-sm text-ink-muted">
                এগুলো আলাদা ডেমো খাতায় চলে যাবে (মুছবে না)। এরপর খালি খাতা দিয়ে আপনার হিসাব শুরু করবেন।
              </span>
            </span>
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDemo}
        tone="primary"
        title="ডেমো খাতায় সরাবেন?"
        description="এই হিসাব আপনার আসল খাতা থেকে সরে ডেমো খাতায় থাকবে। পরে “ডেমো দেখুন” থেকে দেখা যাবে।"
        confirmLabel="হ্যাঁ, ডেমোতে সরান"
        isSubmitting={busy}
        onCancel={() => setConfirmDemo(false)}
        onConfirm={() => run(actions.moveLegacyToDemo)}
      />
    </div>
  );
}
