'use client';

import React, { useState } from 'react';
import { formatBanglaNumber } from '@/lib/format';

export const PAGE_SIZE = 100;

/**
 * Long lists render in pages of 100 (S13, plan 8.4): measured on a 4x-throttled phone, drawing
 * 5,000 party rows made typing in search take ~340 ms. Paging keeps every screen light.
 * `resetKey` (e.g. the search text or filters) puts the list back on page one.
 */
export function usePaged<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [state, setState] = useState({ key: resetKey, count: pageSize });
  const count = state.key === resetKey ? state.count : pageSize;
  return {
    visible: items.length > count ? items.slice(0, count) : items,
    remaining: Math.max(0, items.length - count),
    more: () => setState({ key: resetKey, count: count + pageSize }),
  };
}

export function ShowMore({ remaining, onMore, pageSize = PAGE_SIZE }: { remaining: number; onMore: () => void; pageSize?: number }) {
  if (remaining <= 0) return null;
  return (
    <button
      type="button"
      onClick={onMore}
      className="flex h-12 w-full items-center justify-center rounded-2xl bg-secondary text-sm font-bold text-primary-ink"
    >
      আরও {formatBanglaNumber(Math.min(pageSize, remaining))}টি দেখুন (বাকি {formatBanglaNumber(remaining)})
    </button>
  );
}
