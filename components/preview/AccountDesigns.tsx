'use client';

import React from 'react';
import { CloudUpload, Download, FlaskConical, LogOut, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * S10 design previews for flows that only work once the backend exists (plan 7.8, §7.3).
 * Shown only on the development-only /preview page, always under a visible "প্রিভিউ" banner.
 * Nothing here creates a session, sends a code or moves data.
 */
function PreviewBanner() {
  return (
    <p className="flex items-center gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm font-bold text-warning-ink">
      <FlaskConical className="h-4 w-4" /> প্রিভিউ — আসল যাচাই নয়
    </p>
  );
}

export function OtpPreview() {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
      <PreviewBanner />
      <h2 className="text-lg font-bold text-ink">কোড লিখুন</h2>
      <p className="text-sm text-ink-muted">০১৭১২-৩৪৫৬৭৮ নম্বরে ৬ অঙ্কের কোড পাঠানো হয়েছে।</p>
      <div className="grid grid-cols-6 gap-2" aria-label="ওটিপি কোড">
        {Array.from({ length: 6 }, (_, i) => (
          <input key={i} inputMode="numeric" maxLength={1} aria-label={`কোডের ${i + 1} নম্বর অঙ্ক`} className="h-12 rounded-xl border border-border-strong text-center text-xl font-bold" />
        ))}
      </div>
      <Button fullWidth disabled>
        যাচাই করুন
      </Button>
      <p className="text-center text-sm text-ink-muted">কোড পাননি? ৩০ সেকেন্ড পরে আবার পাঠান</p>
    </section>
  );
}

/** 7.8: logout is blocked while changes have not reached the cloud. */
export function LogoutGuardPreview({ pending = 12 }: { pending?: number }) {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
      <PreviewBanner />
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-danger" />
        <div>
          <h2 className="text-lg font-bold text-ink">এখনই লগআউট করবেন না</h2>
          <p className="text-sm text-ink-muted">
            {pending}টি লেনদেন এখনও ক্লাউডে যায়নি। লগআউট করলে এই ফোনের হিসাব মুছবে না, কিন্তু আগে নিরাপদে রাখুন।
          </p>
        </div>
      </div>
      <Button fullWidth disabled>
        <CloudUpload className="h-5 w-5" /> এখনই ক্লাউডে পাঠান
      </Button>
      <Button variant="secondary" fullWidth disabled>
        <Download className="h-5 w-5" /> ব্যাকআপ ফাইল ডাউনলোড
      </Button>
      <Button variant="ghost" fullWidth disabled>
        বাতিল
      </Button>
      <p className="flex items-center gap-1.5 text-xs text-ink-muted">
        <LogOut className="h-3.5 w-3.5" /> “এই ফোন থেকে হিসাব মুছুন” আলাদা কাজ — সব সিঙ্ক হলে, লিখে নিশ্চিত করার পরেই।
      </p>
    </section>
  );
}

/** §7.3: first login on a phone that already has a local khata. Never auto-merges. */
export function ClaimFlowPreview() {
  return (
    <section className="space-y-3 rounded-3xl bg-white p-5 shadow-card">
      <PreviewBanner />
      <h2 className="text-lg font-bold text-ink">এই ফোনের হিসাব কী করবেন?</h2>
      <p className="text-sm text-ink-muted">আপনার অ্যাকাউন্টে আগে থেকেই হিসাব আছে, এই ফোনেও আছে। আমরা নিজে থেকে মেশাব না।</p>
      <Button fullWidth disabled>
        এই ফোনের হিসাব অ্যাকাউন্টে তুলুন
      </Button>
      <Button variant="secondary" fullWidth disabled>
        আলাদা রাখুন
      </Button>
      <Button variant="ghost" fullWidth disabled>
        আগে ব্যাকআপ নিন
      </Button>
    </section>
  );
}
