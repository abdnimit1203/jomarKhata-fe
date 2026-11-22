'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMessage } from '@/context/JomarkhataContext';

export function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 lg:p-6">
      <div className="h-44 w-full animate-pulse rounded-3xl bg-[#DCE8E2]" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-16 animate-pulse rounded-2xl bg-[#E7EFEA]" />
        <div className="h-16 animate-pulse rounded-2xl bg-[#E7EFEA]" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#E7EFEA]" />
        ))}
      </div>
      <div className="space-y-2.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl bg-white" />
        ))}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-white px-6 py-12 text-center shadow-card">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E6F4EE] text-[#0D7A56]">
        {icon}
      </div>
      <h3 className="mt-4 text-base font-semibold text-[#0F1F18]">{title}</h3>
      <p className="mt-1.5 max-w-xs text-sm text-[#586B62]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 flex h-12 items-center justify-center rounded-full bg-[#0D7A56] px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#096244] active:scale-[0.98]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed top-4 right-4 left-4 z-[70] flex flex-col items-center gap-2 lg:left-auto lg:w-96">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.16 }}
            className={`pointer-events-auto flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.type === 'error'
                ? 'bg-[#DC2626] text-white'
                : t.type === 'info'
                  ? 'bg-[#0F1F18] text-white'
                  : 'bg-[#0D7A56] text-white'
            }`}
          >
            {t.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0" />
            ) : t.type === 'info' ? (
              <Info className="h-5 w-5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            )}
            <span className="flex-1">{t.text}</span>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="বন্ধ করুন"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
