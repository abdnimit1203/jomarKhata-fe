'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, ShoppingCart } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { getPeriodBounds, isWithinRange } from '@/services/financeCalculator';
import {
  formatBanglaDateTime,
  formatBanglaNumber,
  formatTaka,
  getChannelShortLabel,
} from '@/lib/format';
import type { PeriodPreset } from '@/types/domain';

export function PurchasesView() {
  const { data, openSheet } = useJomarkhata();
  const [period, setPeriod] = useState<PeriodPreset>('month');
  const [showVoided, setShowVoided] = useState(false);
  const [search, setSearch] = useState('');

  const filteredPurchases = useMemo(() => {
    if (!data) return [];
    const range = getPeriodBounds(period);
    const q = search.trim().toLowerCase();
    return data.purchases.filter((p) => {
      if (!isWithinRange(p.date, range)) return false;
      if (!showVoided && p.status !== 'active') return false;
      if (
        q &&
        !p.partyName.toLowerCase().includes(q) &&
        !p.billNo.toLowerCase().includes(q) &&
        !(p.description?.toLowerCase().includes(q) ?? false)
      ) {
        return false;
      }
      return true;
    });
  }, [data, period, showVoided, search]);

  const summary = useMemo(() => {
    let total = 0;
    let paid = 0;
    let due = 0;
    for (const p of filteredPurchases) {
      if (p.status !== 'active') continue;
      total += p.total;
      paid += p.paidAmount;
      due += p.dueAmount;
    }
    return { total, paid, due };
  }, [filteredPurchases]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#0F1F18]">কেনার খাতা (ক্রয়)</h1>
          <p className="text-xs text-[#586B62]">পাইকারি ক্রয় ও সাপ্লায়ার বিলের হিসাব</p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'purchase' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#0D7A56] px-4 text-sm font-semibold text-white shadow-sm hover:bg-[#096244]"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন ক্রয়</span>
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-[#586B62]">মোট কেনা</p>
          <p className="mt-1 text-base font-bold tabular-nums text-[#0F1F18] sm:text-lg">
            {formatTaka(summary.total)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-[#586B62]">পরিশোধিত</p>
          <p className="mt-1 text-base font-bold tabular-nums text-[#0D7A56] sm:text-lg">
            {formatTaka(summary.paid)}
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-[#586B62]">সাপ্লায়ার বাকি</p>
          <p className="mt-1 text-base font-bold tabular-nums text-[#D97706] sm:text-lg">
            {formatTaka(summary.due)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1 rounded-full bg-[#E9F0EC] p-1">
          {(
            [
              { id: 'today', label: 'আজ' },
              { id: 'week', label: 'সপ্তাহ' },
              { id: 'month', label: 'মাস' },
              { id: 'all', label: 'সব' },
            ] as Array<{ id: PeriodPreset; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setPeriod(t.id)}
              className={`min-h-[38px] rounded-full px-3.5 text-xs font-semibold whitespace-nowrap ${
                period === t.id ? 'bg-[#0D7A56] text-white' : 'text-[#486055]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowVoided((v) => !v)}
          className={`min-h-[38px] rounded-xl border px-3 text-xs font-semibold ${
            showVoided
              ? 'border-[#0D7A56] bg-[#E6F4EE] text-[#0D7A56]'
              : 'border-[#DCE6E0] bg-white text-[#486055]'
          }`}
        >
          বাতিলকৃত দেখান
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#6F847A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="সাপ্লায়ার বা বিল নম্বর খুঁজুন"
          className="h-12 w-full rounded-2xl border border-[#DCE6E0] bg-white pr-4 pl-11 text-sm text-[#0F1F18] shadow-card focus:border-[#0D7A56] focus:outline-none"
        />
      </div>

      {filteredPurchases.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-6 w-6" />}
          title="কোনো ক্রয়ের হিসাব নেই"
          description="সাপ্লায়ার থেকে মালামাল কেনার হিসাব এখানে সংরক্ষণ করুন।"
          actionLabel="+ নতুন ক্রয় যোগ করুন"
          onAction={() => openSheet({ type: 'purchase' })}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredPurchases.map((p) => {
            const isVoided = p.status === 'voided';
            return (
              <button
                key={p.id}
                type="button"
                onClick={() =>
                  openSheet({ type: 'transaction_detail', sourceType: 'purchase', sourceId: p.id })
                }
                className={`flex w-full items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition-colors hover:bg-[#F9FCFA] ${
                  isVoided ? 'opacity-60' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#0F1F18]">{p.partyName}</p>
                    <span className="text-xs text-[#586B62]">· {p.billNo}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[#586B62]">
                    {p.mode === 'quick' ? 'সহজ ক্রয়' : `${formatBanglaNumber(p.items.length)}টি পণ্য`}
                    {p.description ? ` · ${p.description}` : ''} · {formatBanglaDateTime(p.date)}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isVoided ? 'line-through text-[#6A7F75]' : 'text-[#0F1F18]'
                    }`}
                  >
                    {formatTaka(p.total)}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums">
                    {isVoided ? (
                      <span className="font-semibold text-[#DC2626]">বাতিলকৃত</span>
                    ) : p.dueAmount > 0 ? (
                      <span className="font-semibold text-[#D97706]">
                        দিবো {formatTaka(p.dueAmount)}
                      </span>
                    ) : (
                      <span className="font-medium text-[#0D7A56]">
                        পরিশোধ ({getChannelShortLabel(p.paymentMethod)})
                      </span>
                    )}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
