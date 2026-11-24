"use client";

import React, { useEffect, useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import {
  canPromptInstall,
  isAndroid,
  isInAppBrowser,
  isIos,
  isStandalone,
  promptInstall,
  wasInstalled,
  INSTALL_EVENT,
} from "@/lib/pwa";

/** What the help sheet explains after a tap that could not (or did not need to) show the install dialog. */
type Sheet = null | "installing" | "installed" | "in_app" | "android" | "ios";

interface PwaInstallButtonProps {
  variant?: "header" | "hero";
  className?: string;
}

/**
 * PWA direct install button.
 * - On supported browsers (Android Chrome, Desktop Chrome, Edge), triggers the native install prompt dialog.
 * - If the install prompt is not yet ready or on iOS Safari, smoothly scrolls to the #install instructions.
 * - Features dual phone + animated download icon to draw user attention.
 */
export function PwaInstallButton({
  variant = "hero",
  className = "",
}: PwaInstallButtonProps) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);

  useEffect(() => {
    const updateState = () => {
      setStandalone(isStandalone());
      setCanPrompt(canPromptInstall());
    };

    updateState();
    window.addEventListener(INSTALL_EVENT, updateState);
    return () => window.removeEventListener(INSTALL_EVENT, updateState);
  }, []);

  // Hidden when already running in standalone (installed) mode
  if (standalone) return null;

  /**
   * Android never opens the app by itself after installing (desktop Chrome does): it adds a home-screen
   * icon a few seconds later. And once installed, Chrome stops offering the install dialog, so a second
   * tap used to fall through to the page's how-to section. Say plainly what happened instead.
   */
  const handleInstallClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (canPrompt) {
      const outcome = await promptInstall();
      setCanPrompt(false);
      if (outcome === "accepted") setSheet("installing");
      return;
    }
    if (wasInstalled()) return setSheet("installed");
    if (isInAppBrowser()) return setSheet("in_app");
    if (isIos()) return setSheet("ios");
    if (isAndroid()) return setSheet("android");
    document.getElementById("install")?.scrollIntoView({ behavior: "smooth" });
  };

  const help = sheet && (
    <InstallHelp sheet={sheet} onClose={() => setSheet(null)} />
  );

  if (variant === "header") {
    return (
      <>
        <button
          type="button"
          onClick={handleInstallClick}
          className={`relative inline-flex h-10 items-center gap-1.5 rounded-full border border-border-strong bg-secondary px-3 text-xs font-bold text-primary-ink shadow-xs transition-all duration-200 cursor-pointer hover:bg-secondary-hover hover:scale-[1.10] active:scale-95 sm:px-4 sm:text-sm ${className}`}
          aria-label="অ্যাপ ইনস্টল করুন"
          title="ফোনে ইনস্টল করুন"
        >
          <span className="relative flex items-center gap-0.5">
            <Smartphone className="h-7 w-7 shrink-0 text-primary-ink" />
            <Download className="absolute top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 shrink-0 animate-download-drop text-primary-ink" />
          </span>
          {/* <span className="hidden sm:inline">ইনস্টল করুন</span> */}
          {/* <span className="sm:hidden">ইনস্টল</span> */}
        </button>
        {help}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className={`group inline-flex min-h-13 items-center justify-center gap-2.5 rounded-full border border-border-strong bg-white px-6 text-base font-bold text-ink shadow-sm transition-all duration-200 hover:border-border hover:bg-canvas hover:scale-[1.02] active:scale-95 ${className}`}
      >
        <span className="flex items-center gap-1 rounded-xl bg-secondary p-1 text-primary-ink transition-colors group-hover:bg-primary group-hover:text-on-primary">
          <Smartphone className="h-4 w-4 shrink-0" />
          <Download className="h-4 w-4 shrink-0 animate-download-drop" />
        </span>
        <span>ফোনে ইনস্টল করুন</span>
      </button>
      {help}
    </>
  );
}

const HELP: Record<Exclude<Sheet, null>, { title: string; steps: string[] }> = {
  installing: {
    title: "ইনস্টল হচ্ছে ✅",
    steps: [
      "কয়েক সেকেন্ডের মধ্যে ফোনের হোম স্ক্রিনে জমারখাতা আইকন আসবে।",
      "ওই আইকনে চাপ দিয়ে অ্যাপ খুলুন। পরের বার থেকে সবসময় আইকন থেকেই খুলবেন।",
      "আইকন না দেখলে অ্যাপের তালিকায় (সব অ্যাপ) খুঁজুন।",
    ],
  },
  installed: {
    title: "অ্যাপটি এই ফোনে ইনস্টল করা আছে",
    steps: [
      "হোম স্ক্রিন বা অ্যাপের তালিকায় জমারখাতা আইকনে চাপ দিন।",
      "আইকন মুছে ফেলে থাকলে Chrome-এর ⋮ মেনু থেকে আবার “অ্যাপ ইনস্টল করুন” চাপুন।",
    ],
  },
  in_app: {
    title: "আগে Chrome-এ খুলুন",
    steps: [
      "Facebook / Messenger-এর ভেতরের ব্রাউজার থেকে অ্যাপ ইনস্টল হয় না।",
      "উপরের ⋮ বা ••• মেনু থেকে “Open in Chrome” / “ব্রাউজারে খুলুন” চাপুন।",
      "Chrome-এ খুলে আবার “ফোনে ইনস্টল করুন” চাপুন।",
    ],
  },
  android: {
    title: "Chrome মেনু থেকে ইনস্টল করুন",
    steps: [
      "উপরে ডান কোণে ⋮ (তিন ডট) চাপুন।",
      "“অ্যাপ ইনস্টল করুন” বা “Add to Home screen” চাপুন।",
      "তারপর হোম স্ক্রিনের জমারখাতা আইকন থেকে খুলুন।",
    ],
  },
  ios: {
    title: "iPhone-এ যেভাবে রাখবেন",
    steps: [
      "Safari-তে নিচের শেয়ার বাটন (□↑) চাপুন।",
      "“Add to Home Screen” বাছুন, তারপর “Add” চাপুন।",
      "হোম স্ক্রিনের জমারখাতা আইকন থেকে খুলুন।",
    ],
  },
};

function InstallHelp({
  sheet,
  onClose,
}: {
  sheet: Exclude<Sheet, null>;
  onClose: () => void;
}) {
  const { title, steps } = HELP[sheet];
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-white p-5 text-left shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="বন্ধ করুন"
          className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 className="pr-8 text-lg font-bold text-ink">{title}</h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink">
          {steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <div className="mt-4 flex gap-2">
          <a
            href="/app"
            className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-canvas text-sm font-bold text-primary-ink"
          >
            ব্রাউজারেই খুলুন
          </a>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 flex-1 items-center justify-center rounded-2xl bg-primary-gradient text-sm font-bold text-on-primary"
          >
            ঠিক আছে
          </button>
        </div>
      </div>
    </div>
  );
}
