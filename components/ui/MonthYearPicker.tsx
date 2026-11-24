'use client';

/**
 * Month + year picker (owner, 2026-11-24): one slim control ‹ [📅 নভেম্বর ২০২৬ ▾] ›.
 * Tapping the label opens a small bottom sheet: year ‹ ২০২৬ › on top, 12 Bangla months below,
 * one tap picks. Our own component (no date library, a few KB, works offline). Future months are
 * not offered; years run from the oldest record to this year (`years`).
 */
import React, { useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { ModalSheet } from './ModalSheet';
import { BANGLA_MONTHS, currentMonth, monthLabel, shiftMonth, type MonthValue } from '@/lib/months';
import { toBanglaDigits } from '@/lib/format';

export function MonthYearPicker({
  value,
  onChange,
  years,
  className = '',
}: {
  value: MonthValue;
  onChange: (v: MonthValue) => void;
  years: number[];
  className?: string;
}) {
  const now = currentMonth();
  const oldestYear = Math.min(now.year, ...years);
  const [open, setOpen] = useState(false);
  const [sheetYear, setSheetYear] = useState(value.year);

  const isFuture = (v: MonthValue) => v.year > now.year || (v.year === now.year && v.month > now.month);
  const atLatest = isFuture(shiftMonth(value, 1));
  const atOldest = value.year <= oldestYear && value.month === 0;
  const set = (v: MonthValue) => onChange(isFuture(v) ? now : v);

  const navBtn =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-ink disabled:opacity-35';

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <button type="button" aria-label="আগের মাস" disabled={atOldest} onClick={() => set(shiftMonth(value, -1))} className={navBtn}>
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        type="button"
        aria-label="মাস ও বছর বাছুন"
        aria-haspopup="dialog"
        onClick={() => {
          setSheetYear(value.year);
          setOpen(true);
        }}
        className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-white px-3 text-sm font-bold text-ink"
      >
        <CalendarDays className="h-4 w-4 shrink-0 text-primary-ink" />
        <span className="truncate">{monthLabel(value)}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
      </button>
      <button type="button" aria-label="পরের মাস" disabled={atLatest} onClick={() => set(shiftMonth(value, 1))} className={navBtn}>
        <ChevronRight className="h-4 w-4" />
      </button>

      <ModalSheet open={open} onClose={() => setOpen(false)} title="মাস বাছুন" maxWidthClass="lg:max-w-sm">
        <div className="space-y-4 pb-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="আগের বছর"
              disabled={sheetYear <= oldestYear}
              onClick={() => setSheetYear(sheetYear - 1)}
              className={navBtn}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-lg font-extrabold text-ink tabular-nums">{toBanglaDigits(sheetYear)}</span>
            <button
              type="button"
              aria-label="পরের বছর"
              disabled={sheetYear >= now.year}
              onClick={() => setSheetYear(sheetYear + 1)}
              className={navBtn}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {BANGLA_MONTHS.map((name, month) => {
              const v = { year: sheetYear, month };
              const selected = value.year === sheetYear && value.month === month;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={isFuture(v)}
                  onClick={() => {
                    set(v);
                    setOpen(false);
                  }}
                  className={`h-11 rounded-xl text-sm font-bold disabled:opacity-30 ${
                    selected ? 'bg-primary text-on-primary' : 'bg-surface-muted text-ink hover:bg-secondary'
                  }`}
                >
                  {name}
                </button>
              );
            })}
          </div>
        </div>
      </ModalSheet>
    </div>
  );
}
