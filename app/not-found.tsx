import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';

/** Any unknown address: a friendly Bangla page with the brand and a way back home. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-gradient-to-b from-secondary to-canvas px-6 text-center text-ink">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-mark.png" alt="জমারখাতা" width={64} height={64} className="h-16 w-16 rounded-2xl shadow-card" />
      <p className="mt-6 text-7xl font-extrabold text-primary-ink tabular-nums">৪০৪</p>
      <h1 className="mt-2 text-2xl font-extrabold">এই পাতাটি খুঁজে পাওয়া যায়নি</h1>
      <p className="mt-2 max-w-sm text-base text-ink-muted">ঠিকানা হয়তো ভুল লেখা হয়েছে, অথবা পাতাটি সরিয়ে নেওয়া হয়েছে। চিন্তা নেই, আপনার হিসাব নিরাপদ আছে।</p>
      <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
        <Link href="/" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary-gradient text-base font-bold text-on-primary shadow-hero">
          <Home className="h-5 w-5" /> হোম পেজে যান
        </Link>
        <Link href="/app" className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-border-strong bg-white text-base font-bold text-ink">
          <ArrowLeft className="h-5 w-5" /> অ্যাপ খুলুন
        </Link>
      </div>
    </main>
  );
}
