'use client';

/**
 * One period filter for every date-filtered list (sales, purchases, expenses, reports):
 * presets plus "অন্য মাস", which opens the month + year picker. Any month back to the oldest record.
 */
import React, { useMemo, useState } from 'react';
import { SegmentedControl } from './segmented';
import { MonthYearPicker } from './MonthYearPicker';
import { getPeriodBounds } from '@/services/financeCalculator';
import { currentMonth, monthRange, yearOptions, type MonthValue } from '@/lib/months';
import type { PeriodPreset } from '@/types/domain';

export type PeriodChoice = PeriodPreset | 'pick';

export const PERIOD_LABELS: Partial<Record<PeriodChoice, string>> = {
  today: 'আজ',
  week: 'সপ্তাহ',
  month: 'এই মাস',
  pick: 'অন্য মাস',
  all: 'সব',
};

/** State + date range for a period filter. `dates` = the list's dates (for the year choices). */
export function usePeriodFilter(dates: Array<string | undefined>, initial: PeriodChoice = 'month') {
  const [period, setPeriod] = useState<PeriodChoice>(initial);
  const [picked, setPicked] = useState<MonthValue>(() => currentMonth());
  const years = useMemo(() => yearOptions(dates), [dates]);
  const range = useMemo(() => (period === 'pick' ? monthRange(picked) : getPeriodBounds(period)), [period, picked]);
  return { period, setPeriod, picked, setPicked, years, range };
}

export type PeriodFilterState = ReturnType<typeof usePeriodFilter>;

export function PeriodFilter({
  state,
  presets = ['today', 'week', 'month', 'pick', 'all'],
  className = '',
}: {
  state: PeriodFilterState;
  presets?: PeriodChoice[];
  className?: string;
}) {
  return (
    <div className={`w-full space-y-2 ${className}`}>
      <SegmentedControl
        aria-label="সময়কাল"
        variant="track"
        size="sm"
        fullWidth
        value={state.period}
        onValueChange={(v) => state.setPeriod(v as PeriodChoice)}
        // five choices don't fit at 360px with "এই মাস", so the short "মাস" is used then
        options={presets.map((p) => ({ value: p, label: p === 'month' && presets.length > 4 ? 'মাস' : PERIOD_LABELS[p] ?? p }))}
      />
      {state.period === 'pick' && <MonthYearPicker value={state.picked} onChange={state.setPicked} years={state.years} />}
    </div>
  );
}
