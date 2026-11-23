import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Multicolour feature tiles (owner reference style). Same feature family = same colour,
 * so users recognise a button by colour before reading the label (DESIGN_SYSTEM §8).
 */
export type FeatureTone =
  | 'green' // বেচা, টাকা এসেছে
  | 'blue' // কেনা
  | 'orange' // বাকি
  | 'red' // খরচ, টাকা গেছে
  | 'teal' // পরিশোধ
  | 'indigo' // স্টক
  | 'purple' // পার্টি
  | 'sky' // রিপোর্ট, লেনদেন
  | 'gold' // ক্যাশ
  | 'slate'; // সেটিংস

const TONE: Record<FeatureTone, string> = {
  green: 'bg-tile-green-bg text-tile-green-fg',
  blue: 'bg-tile-blue-bg text-tile-blue-fg',
  orange: 'bg-tile-orange-bg text-tile-orange-fg',
  red: 'bg-tile-red-bg text-tile-red-fg',
  teal: 'bg-tile-teal-bg text-tile-teal-fg',
  indigo: 'bg-tile-indigo-bg text-tile-indigo-fg',
  purple: 'bg-tile-purple-bg text-tile-purple-fg',
  sky: 'bg-tile-sky-bg text-tile-sky-fg',
  gold: 'bg-tile-gold-bg text-tile-gold-fg',
  slate: 'bg-tile-slate-bg text-tile-slate-fg',
};

// Line icons (lucide <svg>) and the colourful custom icons (<img>, see AppIcon) size differently:
// custom icons fill more of the tile because they carry their own colour and detail.
const SIZE = {
  sm: 'h-10 w-10 rounded-xl [&>svg]:h-5 [&>svg]:w-5 [&>img]:h-7 [&>img]:w-7',
  md: 'h-12 w-12 rounded-2xl [&>svg]:h-6 [&>svg]:w-6 [&>img]:h-9 [&>img]:w-9',
  lg: 'h-14 w-14 rounded-2xl [&>svg]:h-7 [&>svg]:w-7 [&>img]:h-10 [&>img]:w-10',
} as const;

export function FeatureIcon({
  tone,
  size = 'md',
  children,
  className,
}: {
  tone: FeatureTone;
  size?: keyof typeof SIZE;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span aria-hidden="true" className={cn('flex shrink-0 items-center justify-center', TONE[tone], SIZE[size], className)}>
      {children}
    </span>
  );
}
