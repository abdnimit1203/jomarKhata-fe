import React from 'react';
import { cn } from '@/lib/utils';

/** White card with the mandatory visible outline + soft shadow (white on ivory alone is only 1.09:1). */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl bg-surface p-4 shadow-card', className)} {...props} />;
}
