'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SimpleSelect } from './select';
import { BANGLA_MONTHS, currentMonth, shiftMonth, type MonthValue } from '@/lib/months';
import { toBanglaDigits } from '@/lib/format';

/** Pick any month and year: ‹ [মাস ▾] [বছর ▾] ›. Future months are not offered. */
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
  const atLatest = value.year > now.year || (value.year === now.year && value.month >= now.month);
  const atOldest = value.year <= Math.min(...years) && value.month === 0;
  const set = (v: MonthValue) => {
    // never go past the current month
    if (v.year > now.year || (v.year === now.year && v.month > now.month)) v = now;
    onChange(v);
  };
  const navBtn = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-ink shadow-card disabled:opacity-40';
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" aria-label="আগের মাস" disabled={atOldest} onClick={() => set(shiftMonth(value, -1))} className={navBtn}>
        <ChevronLeft className="h-5 w-5" />
      </button>
      <SimpleSelect
        aria-label="মাস"
        className="min-w-0 flex-1"
        value={String(value.month)}
        onValueChange={(m) => set({ ...value, month: Number(m) })}
        options={BANGLA_MONTHS.map((name, i) => ({ value: String(i), label: name }))}
      />
      <SimpleSelect
        aria-label="বছর"
        className="w-28 shrink-0"
        value={String(value.year)}
        onValueChange={(y) => set({ ...value, year: Number(y) })}
        options={years.map((y) => ({ value: String(y), label: toBanglaDigits(y) }))}
      />
      <button type="button" aria-label="পরের মাস" disabled={atLatest} onClick={() => set(shiftMonth(value, 1))} className={navBtn}>
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
