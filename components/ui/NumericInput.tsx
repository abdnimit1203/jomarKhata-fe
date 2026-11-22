'use client';

import React from 'react';
import { parseNumericInput } from '@/lib/format';

interface NumericInputProps {
  value: string;
  onChange: (raw: string, numericValue: number) => void;
  placeholder?: string;
  suffix?: string;
  id?: string;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  inputSize?: 'md' | 'lg';
}

/**
 * Shopkeeper-friendly numeric input accepting both Bengali (০-৯) and English (0-9) digits.
 */
export function NumericInput({
  value,
  onChange,
  placeholder = '০',
  suffix = '৳',
  id,
  autoFocus = false,
  className = '',
  disabled = false,
  inputSize = 'md',
}: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Allow digits (Bangla & English), decimal point, and empty string
    const cleaned = raw.replace(/[^0-9০-৯.]/g, '');
    onChange(cleaned, parseNumericInput(cleaned));
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoFocus={autoFocus}
        disabled={disabled}
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full rounded-2xl border border-[#D8E4DD] bg-[#F8FBF9] font-semibold tabular-nums text-[#0F1F18] placeholder:font-normal placeholder:text-[#8DA197] transition-colors focus:border-[#0D7A56] focus:bg-white focus:outline-none disabled:opacity-60 ${
          inputSize === 'lg' ? 'h-14 pl-4 pr-11 text-2xl' : 'h-12 pl-4 pr-10 text-base'
        }`}
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3.5 text-sm font-semibold text-[#586B62]">
          {suffix}
        </span>
      )}
    </div>
  );
}
