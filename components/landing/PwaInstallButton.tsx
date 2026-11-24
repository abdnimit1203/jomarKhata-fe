'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { canPromptInstall, isStandalone, promptInstall, INSTALL_EVENT } from '@/lib/pwa';

interface PwaInstallButtonProps {
  variant?: 'header' | 'hero';
  className?: string;
}

/**
 * PWA direct install button.
 * - On supported browsers (Android Chrome, Desktop Chrome, Edge), triggers the native install prompt dialog.
 * - If the install prompt is not yet ready or on iOS Safari, smoothly scrolls to the #install instructions.
 * - Features dual phone + animated download icon to draw user attention.
 */
export function PwaInstallButton({ variant = 'hero', className = '' }: PwaInstallButtonProps) {
  const [canPrompt, setCanPrompt] = useState(false);
  const [standalone, setStandalone] = useState(false);

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

  const handleInstallClick = async (e: React.MouseEvent) => {
    if (canPrompt) {
      e.preventDefault();
      const outcome = await promptInstall();
      if (outcome === 'accepted') {
        setCanPrompt(false);
      }
      return;
    }

    // Fallback: smooth scroll to manual install section
    const installSection = document.getElementById('install');
    if (installSection) {
      e.preventDefault();
      installSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (variant === 'header') {
    return (
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
    );
  }

  return (
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
  );
}
