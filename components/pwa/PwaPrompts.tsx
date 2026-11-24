'use client';

import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Share, X } from 'lucide-react';
import {
  INSTALL_EVENT,
  SW_UPDATE_EVENT,
  applyUpdate,
  canPromptInstall,
  hasWaitingUpdate,
  isIos,
  isStandalone,
  promptInstall,
} from '@/lib/pwa';

/** "নতুন আপডেট আছে" (S12): shown when a new version is installed and waiting. */
export function UpdateBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(true);
    if (hasWaitingUpdate()) on();
    window.addEventListener(SW_UPDATE_EVENT, on);
    return () => window.removeEventListener(SW_UPDATE_EVENT, on);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="mx-auto mb-4 flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm font-semibold text-primary-ink">
      <span>নতুন আপডেট আছে। আপনার হিসাব নিরাপদ থাকবে।</span>
      <button
        type="button"
        onClick={applyUpdate}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary-gradient px-3.5 py-1.5 text-sm font-bold text-on-primary"
      >
        <RefreshCw className="h-4 w-4" /> আপডেট করুন
      </button>
    </div>
  );
}

const DISMISS_KEY = 'jk_install_dismissed';
const INSTALLED_KEY = 'jk_installed';
const readInstalled = () => {
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === '1';
  } catch {
    return false;
  }
};
// Remember an install, so the card also stays hidden when the site is later opened in the browser.
if (typeof window !== 'undefined') {
  window.addEventListener('appinstalled', () => {
    try {
      window.localStorage.setItem(INSTALLED_KEY, '1');
    } catch {
      /* ignore */
    }
  });
}
const readDismissed = () => {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Install card (S12): Android/desktop Chrome → our own button using the captured
 * `beforeinstallprompt`; iPhone Safari → the Share → "Add to Home Screen" steps.
 * Hidden when already installed or dismissed (per-device convenience, localStorage).
 */
export function InstallCard({ dismissible = true }: { dismissible?: boolean }) {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden');
  useEffect(() => {
    const decide = () => {
      // installed (opened as the app, or installed earlier on this phone) → never show
      if (isStandalone() || readInstalled() || (dismissible && readDismissed())) return setMode('hidden');
      if (canPromptInstall()) return setMode('prompt');
      setMode(isIos() ? 'ios' : 'hidden');
    };
    decide();
    window.addEventListener(INSTALL_EVENT, decide);
    return () => window.removeEventListener(INSTALL_EVENT, decide);
  }, [dismissible]);

  if (mode === 'hidden') return null;
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* private mode: just hide for now */
    }
    setMode('hidden');
  };

  return (
    <section className="relative rounded-3xl bg-white p-4 shadow-card">
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="বন্ধ করুন" className="absolute top-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle">
          <X className="h-4 w-4" />
        </button>
      )}
      <div className="flex items-start gap-3 pr-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0" />
        <div>
          <h2 className="text-base font-bold text-ink">ফোনে অ্যাপ হিসেবে রাখুন</h2>
          <p className="text-sm text-ink-muted">হোম স্ক্রিন থেকে এক ট্যাপে খুলবে, ইন্টারনেট ছাড়াও চলবে।</p>
        </div>
      </div>
      {mode === 'prompt' ? (
        <button
          type="button"
          onClick={async () => {
            const r = await promptInstall();
            if (r !== 'dismissed') setMode('hidden');
          }}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-base font-bold text-on-primary"
        >
          <Download className="h-5 w-5" /> ইনস্টল করুন
        </button>
      ) : (
        <ol className="mt-3 list-decimal space-y-1 rounded-2xl bg-canvas p-3 pl-8 text-sm text-ink">
          <li>
            নিচের <Share className="inline h-4 w-4" /> শেয়ার বাটন চাপুন
          </li>
          <li>“Add to Home Screen” বাছুন</li>
          <li>উপরে “Add” চাপুন</li>
        </ol>
      )}
    </section>
  );
}
