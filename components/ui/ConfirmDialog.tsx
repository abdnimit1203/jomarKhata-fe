'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  showReasonInput?: boolean;
  reasonPlaceholder?: string;
  isSubmitting?: boolean;
  onCancel: () => void;
  onConfirm: (reason?: string) => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'ফিরে যান',
  tone = 'danger',
  showReasonInput = false,
  reasonPlaceholder = 'বাতিলের কারণ লিখুন (ঐচ্ছিক)',
  isSubmitting = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('');

  const handleConfirm = async () => {
    await onConfirm(showReasonInput ? reason.trim() : undefined);
    setReason('');
  };

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="alertdialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={isSubmitting ? undefined : onCancel}
            className="fixed inset-0 bg-ink/50 backdrop-blur-[2px]"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3.5">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  tone === 'danger' ? 'bg-danger-soft text-danger' : 'bg-secondary text-primary-ink'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{description}</p>
              </div>
            </div>

            {showReasonInput && (
              <div className="mt-4">
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={reasonPlaceholder}
                  className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:bg-white focus:outline-none"
                />
              </div>
            )}

            <div className="mt-5 flex items-center gap-2.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onCancel}
                className="flex h-12 flex-1 items-center justify-center rounded-xl bg-surface-muted px-4 text-sm font-medium text-ink transition-colors hover:bg-surface-muted disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirm}
                className={`flex h-12 flex-1 items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  tone === 'danger'
                    ? 'bg-danger text-white hover:bg-danger-hover'
                    : 'bg-primary text-on-primary hover:bg-primary-hover'
                }`}
              >
                {isSubmitting ? 'অপেক্ষা করুন...' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
