'use client';

/**
 * "ভিডিও দেখে শিখুন" (owner, 2026-11-25): a small card on the home screen — never a big player.
 * Shown only when online and when the owner has set video links (admin settings); ✕ hides it for
 * good on this phone. The list opens in YouTube. Settings → অ্যাপ keeps a "ভিডিও টিউটোরিয়াল" button.
 */
import React, { useState } from 'react';
import { PlayCircle, X } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { useServerConfig } from '@/lib/serverConfig';
import { useOnline } from '@/hooks/use-online';

const HIDE_KEY = 'jk_tutorial_card_hidden';

export function TutorialList() {
  const { tutorialVideos } = useServerConfig();
  return (
    <div className="space-y-2 pb-2">
      {tutorialVideos.map((v, i) => (
        <a
          key={v.url}
          href={v.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-card"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
            <PlayCircle className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1 text-base font-bold text-ink">
            {i + 1}. {v.title}
          </span>
          <span className="text-xs font-semibold text-ink-muted">ইউটিউবে দেখুন</span>
        </a>
      ))}
      <p className="pt-1 text-center text-xs text-ink-muted">ভিডিও দেখতে ইন্টারনেট লাগবে।</p>
    </div>
  );
}

export function TutorialSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ModalSheet open={open} onClose={onClose} title="ভিডিও দেখে শিখুন" subtitle="ছোট ছোট ভিডিও, এক মিনিটেরও কম">
      <TutorialList />
    </ModalSheet>
  );
}

export function TutorialCard() {
  const { tutorialVideos } = useServerConfig();
  const online = useOnline();
  const [hidden, setHidden] = useState(() => {
    try {
      return typeof window !== 'undefined' && window.localStorage.getItem(HIDE_KEY) === '1';
    } catch {
      return false;
    }
  });
  const [open, setOpen] = useState(false);
  if (hidden || !online || tutorialVideos.length === 0) return null;
  const hide = () => {
    try {
      window.localStorage.setItem(HIDE_KEY, '1');
    } catch {
      /* private mode: hide for now */
    }
    setHidden(true);
  };
  return (
    <>
      <section className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-danger-soft text-danger">
          <PlayCircle className="h-6 w-6" />
        </span>
        <button type="button" onClick={() => setOpen(true)} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-bold text-ink">ভিডিও দেখে শিখুন</span>
          <span className="block truncate text-xs text-ink-muted">বিক্রি, বাকি, ইনস্টল — ১ মিনিটের ভিডিও</span>
        </button>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-on-primary">
          দেখুন
        </button>
        <button type="button" onClick={hide} aria-label="আর দেখাবেন না" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle">
          <X className="h-4 w-4" />
        </button>
      </section>
      <TutorialSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
