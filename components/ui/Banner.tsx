import React from 'react';
import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'warning' | 'danger' | 'info';

const TONE: Record<Tone, { className: string; Icon: React.ComponentType<{ className?: string }> }> = {
  warning: { className: 'bg-warning-soft text-warning-ink', Icon: AlertTriangle },
  danger: { className: 'bg-danger-soft text-danger', Icon: XCircle },
  info: { className: 'bg-secondary text-primary-ink', Icon: Info },
};

/** Persistent inline banner: demo data, offline, read-only, errors (UI_GUIDELINES §6). */
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: Tone;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const { className: toneClass, Icon } = TONE[tone];
  return (
    <div role="status" className={cn('flex items-start gap-3 rounded-2xl p-3.5', toneClass, className)}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {children && <div className="mt-0.5 text-sm font-medium">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
