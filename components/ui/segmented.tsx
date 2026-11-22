'use client';

/**
 * Horizontal chip bar (reference "All / Transfer / Top up" style), built on Radix ToggleGroup
 * in the shadcn/ui pattern. Single selection, can't be deselected, scrolls sideways on small screens,
 * keyboard-accessible (arrow keys). Bundled with the app; works offline.
 */
import React from 'react';
import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  'aria-label': string;
  /** chips: separate pills (filters) · track: joined pill track (2–4 short options, e.g. দিন/মাস) */
  variant?: 'chips' | 'track';
  /** danger: active option is red (sale বাকি) · warning: dark amber (purchase বাকি) */
  activeTone?: (value: T) => 'primary' | 'danger' | 'warning';
  size?: 'md' | 'sm';
  fullWidth?: boolean;
  className?: string;
}

export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  'aria-label': ariaLabel,
  variant = 'chips',
  activeTone,
  size = 'md',
  fullWidth = false,
  className,
}: SegmentedControlProps<T>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => {
        if (v) onValueChange(v as T); // ignore deselect: one option is always active
      }}
      aria-label={ariaLabel}
      className={cn(
        'flex items-center',
        variant === 'chips' ? 'gap-2 overflow-x-auto pb-1 [scrollbar-width:none]' : 'gap-1 rounded-full bg-surface-muted p-1',
        fullWidth && 'w-full',
        className
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        const tone = activeTone?.(o.value) ?? 'primary';
        return (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            className={cn(
              'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-bold whitespace-nowrap transition-colors focus-visible:outline-2',
              size === 'md' ? 'min-h-10 px-4 text-sm' : 'min-h-9 px-3.5 text-xs',
              fullWidth && 'flex-1',
              active
                ? tone === 'danger'
                  ? 'bg-danger text-white shadow-sm'
                  : tone === 'warning'
                    ? 'bg-warning-ink text-white shadow-sm'
                    : 'bg-primary text-on-primary shadow-sm'
                : variant === 'chips'
                  ? 'bg-surface text-ink-muted shadow-card hover:text-ink'
                  : 'text-ink-muted hover:text-ink'
            )}
          >
            {o.icon}
            <span>{o.label}</span>
          </ToggleGroup.Item>
        );
      })}
    </ToggleGroup.Root>
  );
}
