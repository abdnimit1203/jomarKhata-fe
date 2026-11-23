import React from 'react';
import { cn } from '@/lib/utils';

/**
 * The owner's custom colourful feature icons (public/icons/features/*.svg).
 * Plain <img> on purpose: they're static, same-origin files the service worker precaches,
 * so they work offline and need no image optimiser.
 */
export const APP_ICONS = [
  'add-plus',
  'book-due',
  'book-expense',
  'book-purchase',
  'book-sales',
  'cashbox',
  'due-collect',
  'expense',
  'money-in',
  'money-out',
  'nav-home',
  'nav-transactions',
  'party-list',
  'purchase',
  'reports',
  'sale',
  'settings',
  'stock',
  'supplier-pay',
] as const;

export type AppIconName = (typeof APP_ICONS)[number];

export const appIconSrc = (name: AppIconName) => `/icons/features/${name}.svg`;

export function AppIcon({ name, className }: { name: AppIconName; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={appIconSrc(name)}
      alt=""
      aria-hidden="true"
      width={64}
      height={64}
      draggable={false}
      decoding="async"
      className={cn('h-8 w-8 select-none', className)}
    />
  );
}
