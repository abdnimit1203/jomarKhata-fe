'use client';

import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useSheetGuard } from '@/lib/sheet-guard';

interface ModalSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export function ModalSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidthClass = 'lg:max-w-xl',
}: ModalSheetProps) {
  const { markDirty } = useSheetGuard();
  // Native listener (capture) so every typed character in any field marks the form as unsaved.
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bodyRef.current;
    if (!open || !el) return;
    el.addEventListener('input', markDirty, true);
    el.addEventListener('change', markDirty, true);
    return () => {
      el.removeEventListener('input', markDirty, true);
      el.removeEventListener('change', markDirty, true);
    };
  });
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/45 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl lg:max-h-[88dvh] lg:rounded-3xl ${maxWidthClass}`}
          >
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-2.5 pb-1 lg:hidden">
              <div className="h-1.5 w-10 rounded-full bg-border-strong" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
                {subtitle && <p className="truncate text-xs text-ink-muted">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="বন্ধ করুন"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted transition-colors hover:bg-surface-muted active:scale-95"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-5 py-4">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-border bg-white px-5 py-3.5 pb-safe">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
