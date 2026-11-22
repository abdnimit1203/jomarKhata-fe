'use client';

/**
 * shadcn/ui-style Select built on Radix UI (bundled with the app, works fully offline).
 * Replaces native <select> so the dropdown looks the same on every phone and matches the theme.
 */
import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export const SelectGroup = SelectPrimitive.Group;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { size?: 'md' | 'sm' }
>(({ className, children, size = 'md', ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex w-full items-center justify-between gap-2 rounded-xl border-[1.5px] border-border-strong bg-surface px-3.5 text-left font-semibold text-ink transition-colors focus:border-primary-ink focus:outline-none disabled:opacity-60 data-[placeholder]:font-medium data-[placeholder]:text-ink-subtle',
      size === 'md' ? 'min-h-12 text-base' : 'min-h-10 text-sm',
      className
    )}
    {...props}
  >
    <span className="min-w-0 flex-1 truncate">{children}</span>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-ink-muted" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      position={position}
      sideOffset={6}
      className={cn(
        'relative z-[60] max-h-[min(60dvh,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl bg-surface shadow-card',
        className
      )}
      {...props}
    >
      <SelectPrimitive.Viewport className="max-h-[inherit] overflow-y-auto p-1.5">{children}</SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex min-h-11 cursor-pointer items-center rounded-xl py-2 pr-9 pl-3 text-base font-medium text-ink outline-none select-none data-[disabled]:opacity-50 data-[highlighted]:bg-secondary data-[state=checked]:font-bold data-[state=checked]:text-primary-ink',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex">
      <Check className="h-4 w-4 text-primary-ink" />
    </SelectPrimitive.ItemIndicator>
  </SelectPrimitive.Item>
));
SelectItem.displayName = 'SelectItem';

/** Radix forbids empty-string item values; native selects used '' for "none / all". */
const EMPTY = '__empty__';

export interface SimpleSelectOption {
  value: string;
  label: string;
}

/** Drop-in replacement for a native <select>: same value/onChange contract, '' allowed. */
export function SimpleSelect({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  size = 'md',
  className,
  'aria-label': ariaLabel,
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: 'md' | 'sm';
  className?: string;
  'aria-label'?: string;
}) {
  const toRadix = (v: string) => (v === '' ? EMPTY : v);
  const hasEmptyOption = options.some((o) => o.value === '');
  return (
    <Select
      value={value === '' && !hasEmptyOption ? undefined : toRadix(value)}
      onValueChange={(v) => onValueChange(v === EMPTY ? '' : v)}
      disabled={disabled}
    >
      <SelectTrigger size={size} aria-label={ariaLabel} className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || EMPTY} value={toRadix(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
