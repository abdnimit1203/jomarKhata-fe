'use client';

import React from 'react';
import { Banknote, Building2, Smartphone, Wallet } from 'lucide-react';
import type { PaymentChannel } from '@/types/domain';
import { PAYMENT_CHANNELS } from '@/lib/format';

interface PaymentChannelPickerProps {
  value: PaymentChannel;
  onChange: (channel: PaymentChannel) => void;
  label?: string;
}

function ChannelIcon({ channel, className }: { channel: PaymentChannel; className?: string }) {
  switch (channel) {
    case 'cash':
      return <Banknote className={className} />;
    case 'bkash':
      return <Smartphone className={className} />;
    case 'nagad':
      return <Wallet className={className} />;
    case 'bank':
      return <Building2 className={className} />;
  }
}

export function PaymentChannelPicker({ value, onChange, label }: PaymentChannelPickerProps) {
  return (
    <div>
      {label && <p className="mb-2 text-xs font-medium text-ink-muted">{label}</p>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PAYMENT_CHANNELS.map((ch) => {
          const active = value === ch.id;
          return (
            <button
              key={ch.id}
              type="button"
              onClick={() => onChange(ch.id)}
              className={`flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold whitespace-nowrap transition-all active:scale-[0.98] ${
                active
                  ? 'border-primary bg-primary text-white shadow-sm'
                  : 'border-border-strong bg-canvas text-ink hover:bg-surface-muted'
              }`}
            >
              <ChannelIcon channel={ch.id} className="h-4 w-4 shrink-0" />
              <span>{ch.shortLabel}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
