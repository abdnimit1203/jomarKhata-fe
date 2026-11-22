import React from 'react';
import { formatTaka } from '@/lib/format';
import { cn } from '@/lib/utils';

export type FinancialState = 'receivable' | 'payable' | 'settled' | 'money_in' | 'money_out' | 'expense';

const STATE: Record<FinancialState, { word: string; className: string; sign?: string }> = {
  receivable: { word: 'পাবো', className: 'text-danger' },
  payable: { word: 'দিবো', className: 'text-primary-ink' },
  settled: { word: 'বাকি নেই', className: 'text-ink-muted' },
  money_in: { word: 'জমা', className: 'text-primary-ink', sign: '+' },
  money_out: { word: 'পরিশোধ', className: 'text-ink', sign: '−' },
  expense: { word: 'খরচ', className: 'text-danger', sign: '−' },
};

/** Derives পাবো / দিবো / বাকি নেই from a party balance (positive = shop will receive). */
export function stateFromBalance(balance: number): FinancialState {
  if (balance > 0) return 'receivable';
  if (balance < 0) return 'payable';
  return 'settled';
}

interface AmountWithStateProps {
  amount: number;
  state: FinancialState;
  /** inline: "পাবো ১,২০০ ৳" · stacked: amount on top, word below (list rows) */
  layout?: 'inline' | 'stacked';
  className?: string;
}

/**
 * A financial amount ALWAYS shown with its state word, never colour alone (DESIGN_SYSTEM §2).
 */
export function AmountWithState({ amount, state, layout = 'inline', className }: AmountWithStateProps) {
  const s = STATE[state];
  const value = state === 'settled' ? formatTaka(0) : `${s.sign ? `${s.sign} ` : ''}${formatTaka(Math.abs(amount))}`;

  if (layout === 'stacked') {
    return (
      <span className={cn('inline-flex flex-col items-end leading-tight', className)}>
        <span className={cn('text-lg font-bold tabular-nums', s.className)}>{value}</span>
        <span className={cn('text-xs font-semibold', s.className)}>{s.word}</span>
      </span>
    );
  }
  return (
    <span className={cn('font-bold tabular-nums', s.className, className)}>
      {s.word} {value}
    </span>
  );
}
