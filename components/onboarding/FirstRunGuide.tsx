'use client';

/**
 * First-run guide (owner, 2026-11-24): a few big, plain steps that point at the real buttons with
 * an arrow and a hand, so a shopkeeper learns the app without reading anything long.
 *
 * - Targets are elements with `data-guide="<id>"`. A missing or hidden target is skipped, so the
 *   guide never breaks when a screen changes. To add a step, tag the element and add a row to STEPS.
 * - Shown once per phone (localStorage `jk_guide_v1`). "আবার দেখুন" in Settings replays it via
 *   `replayGuide()`. No library, no network: it works offline.
 */
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Hand } from 'lucide-react';
import { toBanglaDigits } from '@/lib/format';

const KEY = 'jk_guide_v1';
const REPLAY_EVENT = 'jk:guide-replay';

const STEPS: Array<{ target: string; title: string; text: string }> = [
  { target: 'hero', title: 'আপনার হাতের টাকা', text: 'হাতে কত ক্যাশ আছে, আর কত বাকি পাবেন বা দেবেন, এখানে দেখবেন।' },
  { target: 'add', title: 'নতুন হিসাব লিখুন', text: 'বিক্রি, কেনা, খরচ বা বাকি লিখতে এই + বাটন চাপুন।' },
  { target: 'dues', title: 'বাকি', text: 'কে কত টাকা বাকি নিল, কাকে কত দেবেন, সব এখানে।' },
  { target: 'ledger', title: 'সব লেনদেন', text: 'সব হিসাব এক তালিকায়। ভুল হলে এখান থেকে ঠিক করুন।' },
  { target: 'more', title: 'আরও', text: 'রিপোর্ট, স্টক, ব্যাকআপ আর সেটিংস এখানে পাবেন।' },
];

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === 'done';
  } catch {
    return true; // storage blocked: don't nag every time
  }
}
function markDone() {
  try {
    localStorage.setItem(KEY, 'done');
  } catch {
    /* ignore */
  }
}

/** Replay the guide (Settings → "অ্যাপ চালানো শিখুন"). */
export function replayGuide() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(REPLAY_EVENT));
}

function visibleTarget(id: string): HTMLElement | null {
  const els = [...document.querySelectorAll<HTMLElement>(`[data-guide="${id}"]`)];
  return els.find((e) => e.offsetParent !== null && e.getBoundingClientRect().width > 0) ?? null;
}

/** First step at or after `from` whose target is on screen, or -1 when none is left. */
function nextVisible(from: number): number {
  for (let i = from; i < STEPS.length; i++) if (visibleTarget(STEPS[i].target)) return i;
  return -1;
}

export function FirstRunGuide({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const start = () => {
      const first = nextVisible(0);
      if (first < 0) return;
      setStep(first);
      setOpen(true);
    };
    // wait a moment so the home screen has painted
    const t = window.setTimeout(() => {
      if (!read()) start();
    }, 600);
    window.addEventListener(REPLAY_EVENT, start);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener(REPLAY_EVENT, start);
    };
  }, [enabled]);

  const finish = useCallback(() => {
    markDone();
    setOpen(false);
  }, []);

  const next = useCallback(() => {
    const i = nextVisible(step + 1);
    if (i < 0) finish();
    else setStep(i);
  }, [step, finish]);

  // keep the highlight on the current step's target
  useLayoutEffect(() => {
    if (!open) return;
    const el = visibleTarget(STEPS[step].target);
    if (!el) return;
    el.scrollIntoView({ block: 'nearest' });
    const update = () => setRect(el.getBoundingClientRect());
    const raf = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, step]);

  if (!open || !rect) return null;

  const s = STEPS[step];
  const last = nextVisible(step + 1) < 0;
  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };
  const below = rect.top + rect.height / 2 < window.innerHeight / 2; // card under the target if it is in the top half
  const handLeft = Math.min(Math.max(rect.left + rect.width / 2 - 14, 8), window.innerWidth - 36);

  return (
    <div className="fixed inset-0 z-[300]" role="dialog" aria-modal="true" aria-label="অ্যাপ চালানো শিখুন">
      {/* dim everything except the target (one big shadow around a clear box) */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed rounded-2xl ring-4 ring-white transition-all duration-300"
        style={{ ...hole, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)' }}
      />
      {/* bouncing hand pointing at the target */}
      <Hand
        aria-hidden="true"
        className="jk-guide-hand pointer-events-none fixed h-7 w-7 text-white drop-shadow"
        style={below ? { top: hole.top + hole.height + 4, left: handLeft } : { top: hole.top - 34, left: handLeft, transform: 'rotate(180deg)' }}
      />
      {/* explanation card */}
      <div
        className="fixed inset-x-4 mx-auto max-w-sm rounded-3xl bg-white p-5 shadow-hero"
        style={below ? { top: Math.min(hole.top + hole.height + 44, window.innerHeight - 230) } : { bottom: Math.max(window.innerHeight - hole.top + 44, 16) }}
      >
        <p className="text-xs font-semibold text-ink-muted">
          ধাপ {toBanglaDigits(step + 1)} / {toBanglaDigits(STEPS.length)}
        </p>
        <h2 className="mt-1 text-xl font-extrabold text-ink">{s.title}</h2>
        <p className="mt-1.5 text-base leading-relaxed text-ink">{s.text}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <button type="button" onClick={finish} className="min-h-11 px-2 text-sm font-bold text-ink-muted">
            বাদ দিন
          </button>
          <button
            type="button"
            onClick={next}
            className="min-h-12 rounded-full bg-primary-gradient px-6 text-base font-bold text-on-primary shadow-sm"
          >
            {last ? 'শুরু করি' : 'পরের ধাপ'}
          </button>
        </div>
      </div>
    </div>
  );
}
