'use client';

import React, { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { formatDateInputDisplay } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DateInputProps {
  /** `yyyy-MM-dd` (empty string = no date) */
  value: string;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Date field that always DISPLAYS dd/MM/yyyy (Bengali digits) with a fixed, non-interactive
 * calendar icon on the left (owner standard). The phone's native picker is used for choosing,
 * so the display never falls back to a locale-specific MM/dd format. Value stays `yyyy-MM-dd`.
 */
export function DateInput({
  value,
  onChange,
  id,
  placeholder = 'দিন/মাস/বছর',
  min,
  max,
  disabled,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const nativeRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    const el = nativeRef.current;
    if (!el || disabled) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };

  const display = formatDateInputDisplay(value);

  return (
    <div className={cn('relative', className)}>
      <CalendarDays
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 z-10 h-5 w-5 -translate-y-1/2 text-primary"
      />
      <button
        type="button"
        id={id}
        onClick={openPicker}
        disabled={disabled}
        aria-label={ariaLabel}
        className={cn(
          'flex min-h-12 w-full items-center rounded-xl border-[1.5px] border-border-strong bg-surface pr-3.5 pl-11 text-left text-base font-semibold tabular-nums transition-colors focus:border-primary focus:outline-none disabled:opacity-60',
          display ? 'text-ink' : 'font-medium text-ink-subtle'
        )}
      >
        {display || placeholder}
      </button>
      {/* Visually hidden native input: provides the OS date picker; display stays dd/MM/yyyy. */}
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="pointer-events-none absolute bottom-0 left-0 h-0 w-0 opacity-0"
      />
    </div>
  );
}
