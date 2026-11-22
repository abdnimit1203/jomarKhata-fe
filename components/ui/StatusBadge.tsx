import React from 'react';
import { cn } from '@/lib/utils';

export type StatusKind = 'local' | 'synced' | 'sync_failed' | 'needs_review' | 'voided' | 'demo' | 'offline' | 'online';

const KIND: Record<StatusKind, { label: string; className: string }> = {
  local: { label: 'ফোনে সংরক্ষিত', className: 'bg-warning-soft text-warning-ink' },
  synced: { label: 'ক্লাউডে সংরক্ষিত', className: 'bg-secondary text-primary' },
  sync_failed: { label: 'সিঙ্ক হয়নি', className: 'bg-danger-soft text-danger' },
  needs_review: { label: 'যাচাই দরকার', className: 'bg-danger-soft text-danger' },
  voided: { label: 'বাতিল', className: 'bg-surface-muted text-ink-subtle line-through' },
  demo: { label: 'ডেমো ডেটা', className: 'bg-accent text-on-accent' },
  offline: { label: 'অফলাইন', className: 'bg-surface-muted text-ink-muted' },
  online: { label: 'অনলাইন', className: 'bg-secondary text-primary' },
};

/** Small pill for record / sync / connection states (DESIGN_SYSTEM §2). Always a word, never colour only. */
export function StatusBadge({ kind, label, className }: { kind: StatusKind; label?: string; className?: string }) {
  const k = KIND[kind];
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap', k.className, className)}>
      {label ?? k.label}
    </span>
  );
}
