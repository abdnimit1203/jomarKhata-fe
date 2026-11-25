'use client';

/**
 * Landing → দাম. Plans, prices, struck-through "before" prices and badges all come from the admin
 * settings (GET /config) — nothing is hard-coded here, so the page never shows a stale price.
 * Hidden until the server answers (no made-up numbers while loading).
 */
import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatBanglaNumber, formatTaka } from '@/lib/format';

interface Plan {
  key: string;
  label: string;
  days: number;
  price: number;
  listPrice?: number;
  badge?: string;
}

const INCLUDED = ['বিক্রি, কেনা, বাকি, খরচ, স্টক', 'ইন্টারনেট ছাড়াই চলে', 'ক্লাউড ব্যাকআপ', 'রিপোর্ট ও লাভ-ক্ষতি'];

export function LandingPricing() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [trialDays, setTrialDays] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    apiFetch<{ plans: Plan[]; trialDays: number }>('/config')
      .then((c) => {
        if (!alive) return;
        setPlans(c.plans);
        setTrialDays(c.trialDays);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!plans?.length) return null;
  const best = plans.find((p) => p.badge) ?? plans[Math.min(1, plans.length - 1)];

  return (
    <section id="pricing" className="scroll-mt-20 bg-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-extrabold md:text-3xl">সহজ দাম</h2>
        <p className="mt-2 text-base text-ink-muted">
          {trialDays ? `প্রথম ${formatBanglaNumber(trialDays)} দিন একদম ফ্রি। ` : ''}তারপর আপনার সুবিধামতো প্ল্যান।
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {plans.map((p) => {
            const months = Math.max(1, Math.round(p.days / 30));
            const save = p.listPrice && p.listPrice > p.price ? p.listPrice - p.price : 0;
            const hot = p.key === best?.key;
            return (
              <div
                key={p.key}
                className={`relative flex flex-col rounded-3xl p-6 transition-all duration-200 hover:-translate-y-1 ${
                  hot ? 'bg-primary-gradient text-on-primary shadow-hero md:scale-[1.04]' : 'bg-canvas text-ink shadow-card'
                }`}
              >
                {p.badge && (
                  <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-sm font-bold whitespace-nowrap shadow-sm ${hot ? 'bg-white text-primary-ink' : 'bg-primary text-on-primary'}`}>
                    {p.badge}
                  </span>
                )}
                <h3 className="text-xl font-extrabold">{p.label}</h3>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-extrabold">{formatTaka(p.price)}</span>
                  {save > 0 && <span className={`pb-1 text-lg line-through ${hot ? 'opacity-70' : 'text-ink-subtle'}`}>{formatTaka(p.listPrice!)}</span>}
                </div>
                <p className={`mt-1 text-sm ${hot ? 'opacity-90' : 'text-ink-muted'}`}>
                  {months > 1 ? `মাসে মাত্র ${formatTaka(Math.round(p.price / months))}` : 'প্রতি মাস'}
                </p>
                {save > 0 && (
                  <span className={`mt-3 inline-block w-fit rounded-full px-3 py-1 text-sm font-bold ${hot ? 'bg-white/20' : 'bg-success-soft text-success'}`}>
                    সাশ্রয় {formatTaka(save)}
                  </span>
                )}
                <ul className="mt-5 flex-1 space-y-2 text-sm">
                  {INCLUDED.map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <Check className={`h-4 w-4 shrink-0 ${hot ? '' : 'text-success'}`} /> {t}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/app"
                  className={`mt-6 inline-flex min-h-12 items-center justify-center rounded-full text-base font-bold transition-all duration-200 hover:scale-[1.02] active:scale-95 ${
                    hot ? 'bg-white text-primary-ink' : 'bg-primary-gradient text-on-primary'
                  }`}
                >
                  ফ্রি ট্রায়াল শুরু করুন
                </Link>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">পেমেন্ট বিকাশ, নগদ বা ব্যাংকে। অ্যাপের সেটিংস → নবায়ন থেকে।</p>
      </div>
    </section>
  );
}
