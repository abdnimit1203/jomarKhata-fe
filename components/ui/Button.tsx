'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'accent' | 'ghost';
type Size = 'md' | 'lg' | 'xl';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary-hover shadow-sm',
  secondary: 'bg-surface text-primary-ink border-[1.5px] border-primary-ink hover:bg-secondary',
  tonal: 'bg-secondary text-primary-ink hover:bg-secondary-hover',
  danger: 'bg-danger text-white hover:bg-danger-hover shadow-sm',
  accent: 'bg-accent text-on-accent hover:brightness-95 shadow-sm',
  ghost: 'bg-transparent text-primary-ink hover:bg-surface-muted',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-4 text-sm rounded-xl gap-1.5',      // 44px — secondary actions
  lg: 'min-h-12 px-5 text-base rounded-2xl gap-2',     // 48px — primary actions
  xl: 'min-h-13 px-6 text-base rounded-2xl gap-2',     // 52px — main screen CTA
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

/** Shared button (DESIGN_SYSTEM §5). Tonal is for filters/toggles only, never a main action. */
export function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-bold whitespace-nowrap transition-colors active:scale-[0.99] disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        fullWidth && 'w-full',
        className
      )}
      {...props}
    />
  );
}
