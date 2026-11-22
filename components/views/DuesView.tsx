'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Copy,
  Edit3,
  Phone,
  Plus,
  Search,
  UserPlus,
  Users,
} from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { getPeriodBounds, isWithinRange } from '@/services/financeCalculator';
import {
  formatBanglaDate,
  formatBanglaDateTime,
  formatBanglaNumber,
  formatTaka,
  getChannelShortLabel,
} from '@/lib/format';
import type { PeriodPreset } from '@/types/domain';

export function DuesView() {
  const {
    data,
    currentBalances,
    selectedPartyId,
    setSelectedPartyId,
    openSheet,
    actions,
    showToast,
  } = useJomarkhata();

  const [roleTab, setRoleTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [onlyWithDue, setOnlyWithDue] = useState(false);
  const [sortBy, setSortBy] = useState<'due' | 'recent' | 'name'>('due');
  const [search, setSearch] = useState('');

  // Party detail filter
  const [detailPeriod, setDetailPeriod] = useState<PeriodPreset>('all');

  const parties = useMemo(() => data?.parties ?? [], [data?.parties]);

  const selectedParty = useMemo(
    () => (selectedPartyId ? parties.find((p) => p.id === selectedPartyId) ?? null : null),
    [parties, selectedPartyId]
  );

  const filteredParties = useMemo(() => {
    const q = search.trim().toLowerCase();
    return parties
      .filter((p) => {
        if (roleTab !== 'all' && p.role !== roleTab) return false;
        if (onlyWithDue && p.balance === 0) return false;
        if (q && !p.name.toLowerCase().includes(q) && !p.phone.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'due') return Math.abs(b.balance) - Math.abs(a.balance);
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        const ta = a.lastTransactionAt ? new Date(a.lastTransactionAt).getTime() : 0;
        const tb = b.lastTransactionAt ? new Date(b.lastTransactionAt).getTime() : 0;
        return tb - ta;
      });
  }, [parties, roleTab, onlyWithDue, sortBy, search]);

  const partyLedger = useMemo(() => {
    if (!data || !selectedParty) return [];
    const range = getPeriodBounds(detailPeriod);
    return data.dueTransactions
      .filter((t) => t.partyId === selectedParty.id && isWithinRange(t.date, range))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data, selectedParty, detailPeriod]);

  const partyTotals = useMemo(() => {
    let totalReceived = 0;
    let totalGiven = 0;
    for (const t of partyLedger) {
      if (t.status !== 'active') continue;
      if (t.direction === 'received') totalReceived += t.amount;
      else totalGiven += t.amount;
    }
    return { totalReceived, totalGiven };
  }, [partyLedger]);

  if (!data) return null;

  // =========================================================================
  // Party Detail Ledger View (বাকির বিবরণ)
  // =========================================================================
  if (selectedParty) {
    const isReceivable = selectedParty.balance > 0;
    const isPayable = selectedParty.balance < 0;

    const handleCopyReminder = async () => {
      const msg = `আসসালামু আলাইকুম ${selectedParty.name}, ${data.businessProfile.shopName} থেকে আপনার কাছে বর্তমান বাকি ${formatTaka(Math.abs(selectedParty.balance))}। সুবিধামতো পরিশোধ করার অনুরোধ রইল। ধন্যবাদ।`;
      try {
        await navigator.clipboard.writeText(msg);
        showToast('বাকির তাগাদা বার্তা কপি হয়েছে — SMS বা WhatsApp-এ পাঠান।');
      } catch {
        showToast('তাগাদা বার্তা তৈরি হয়েছে।', 'info');
      }
    };

    return (
      <div className="mx-auto max-w-4xl space-y-4 pb-24 lg:pb-8">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSelectedPartyId(null)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-white px-3.5 text-sm font-semibold text-[#0F1F18] shadow-card transition-colors hover:bg-[#EDF3F0]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>বাকির খাতায় ফিরুন</span>
          </button>
          <button
            type="button"
            onClick={() => openSheet({ type: 'party', editParty: selectedParty })}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-2xl bg-white px-3.5 text-xs font-semibold text-[#0D7A56] shadow-card hover:bg-[#E6F4EE]"
          >
            <Edit3 className="h-4 w-4" />
            <span>তথ্য এডিট</span>
          </button>
        </div>

        {/* Party Header Summary Card */}
        <section className="rounded-3xl bg-white p-5 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-lg font-bold text-[#0F1F18]">{selectedParty.name}</h1>
                <span className="text-xs text-[#586B62]">
                  · {selectedParty.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}
                </span>
              </div>
              {selectedParty.phone && (
                <p className="mt-0.5 text-sm text-[#4F635A] tabular-nums">{selectedParty.phone}</p>
              )}
              <p
                className={`mt-2 text-lg font-bold tabular-nums ${
                  isReceivable ? 'text-[#DC2626]' : isPayable ? 'text-[#0D7A56]' : 'text-[#586B62]'
                }`}
              >
                {isReceivable
                  ? `পাবো: ${formatTaka(selectedParty.balance)}`
                  : isPayable
                    ? `দিবো: ${formatTaka(Math.abs(selectedParty.balance))}`
                    : 'বাকি শূন্য (০ ৳)'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {selectedParty.phone && (
                <a
                  href={`tel:${selectedParty.phone}`}
                  aria-label="কল করুন"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E6F4EE] text-[#0D7A56] transition-colors hover:bg-[#D5ECE1]"
                >
                  <Phone className="h-5 w-5" />
                </a>
              )}
              {isReceivable && (
                <button
                  type="button"
                  onClick={handleCopyReminder}
                  className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-[#0D7A56] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-[#096244]"
                >
                  <Copy className="h-4 w-4" />
                  <span className="hidden sm:inline">তাগাদা কপি</span>
                </button>
              )}
            </div>
          </div>

          {/* Due Reminder Date Row */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#F5F9F7] px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs font-medium text-[#354B41]">
              <Calendar className="h-4 w-4 text-[#0D7A56]" />
              <span>পরিশোধের সম্ভাব্য তারিখ:</span>
            </div>
            <input
              type="date"
              value={selectedParty.dueReminderDate ?? ''}
              onChange={(e) =>
                actions.setPartyDueReminder(selectedParty.id, e.target.value || null)
              }
              className="h-9 rounded-xl border border-[#DCE6E0] bg-white px-2.5 text-xs font-medium text-[#0F1F18] focus:border-[#0D7A56] focus:outline-none"
            />
          </div>
        </section>

        {/* Period Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {(
            [
              { id: 'today', label: 'দিন' },
              { id: 'month', label: 'মাস' },
              { id: 'year', label: 'বছর' },
              { id: 'all', label: 'সব সময়' },
            ] as Array<{ id: PeriodPreset; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDetailPeriod(tab.id)}
              className={`min-h-[40px] rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
                detailPeriod === tab.id
                  ? 'bg-[#0D7A56] text-white shadow-xs'
                  : 'bg-white text-[#486055] shadow-card hover:bg-[#EDF3F0]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Running-Balance Ledger Table (Reference Screenshots 7 & 8) */}
        <section className="overflow-hidden rounded-3xl bg-white shadow-card">
          <div className="grid grid-cols-12 border-b border-[#E6EEE9] bg-[#F6FAF7] px-4 py-3 text-xs font-semibold text-[#4A5F55]">
            <div className="col-span-5">বাকির ইতিহাস</div>
            <div className="col-span-2 text-right text-[#0D7A56]">নিয়েছি</div>
            <div className="col-span-2 text-right text-[#DC2626]">দিয়েছি</div>
            <div className="col-span-3 text-right">ব্যালেন্স</div>
          </div>

          {partyLedger.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#586B62]">
              এই সময়ে কোনো বাকি লেনদেন নেই।
            </p>
          ) : (
            <div className="divide-y divide-[#EFF4F1]">
              {partyLedger.map((t) => {
                const isVoided = t.status === 'voided';
                const targetSourceType =
                  t.source === 'sale' && t.sourceId
                    ? 'sale'
                    : t.source === 'purchase' && t.sourceId
                      ? 'purchase'
                      : 'due_transaction';
                const targetSourceId =
                  (t.source === 'sale' || t.source === 'purchase') && t.sourceId
                    ? t.sourceId
                    : t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      openSheet({
                        type: 'transaction_detail',
                        sourceType: targetSourceType,
                        sourceId: targetSourceId,
                      })
                    }
                    className={`grid w-full grid-cols-12 items-center px-4 py-3 text-left transition-colors hover:bg-[#F8FBF9] ${
                      isVoided ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="col-span-5 pr-2">
                      <p className="truncate text-xs font-semibold text-[#0F1F18]">
                        {t.note || (t.direction === 'received' ? 'নিয়েছি' : 'দিয়েছি')}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#586B62]">
                        {formatBanglaDateTime(t.date)}
                        {t.paymentMethod ? ` · ${getChannelShortLabel(t.paymentMethod)}` : ''}
                        {isVoided ? ' · বাতিলকৃত' : ''}
                      </p>
                    </div>

                    <div className="col-span-2 rounded-lg bg-[#ECF7F2]/70 py-1.5 px-1 text-right text-xs font-semibold tabular-nums text-[#0D7A56]">
                      {t.direction === 'received' ? (
                        <span className={isVoided ? 'line-through' : ''}>{formatTaka(t.amount)}</span>
                      ) : (
                        '—'
                      )}
                    </div>

                    <div className="col-span-2 ml-1 rounded-lg bg-[#FEF2F2]/70 py-1.5 px-1 text-right text-xs font-semibold tabular-nums text-[#DC2626]">
                      {t.direction === 'given' ? (
                        <span className={isVoided ? 'line-through' : ''}>{formatTaka(t.amount)}</span>
                      ) : (
                        '—'
                      )}
                    </div>

                    <div className="col-span-3 text-right text-xs font-bold tabular-nums text-[#0F1F18]">
                      {t.runningBalance > 0
                        ? formatTaka(t.runningBalance)
                        : t.runningBalance < 0
                          ? `দিবো ${formatTaka(Math.abs(t.runningBalance))}`
                          : '০ ৳'}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Totals Footer Row */}
          <div className="grid grid-cols-12 items-center border-t border-[#E2EAE5] bg-[#F6FAF7] px-4 py-3 text-xs font-bold tabular-nums">
            <div className="col-span-5 text-[#0F1F18]">মোট</div>
            <div className="col-span-2 text-right text-[#0D7A56]">
              {formatTaka(partyTotals.totalReceived)}
            </div>
            <div className="col-span-2 text-right text-[#DC2626]">
              {formatTaka(partyTotals.totalGiven)}
            </div>
            <div className="col-span-3 text-right text-[#0F1F18]">
              {formatTaka(Math.abs(selectedParty.balance))}
            </div>
          </div>
        </section>

        {/* Pinned Bottom Dual Actions (দিচ্ছি / নিচ্ছি) */}
        <div className="fixed right-0 bottom-16 left-0 z-30 border-t border-[#E4ECE7] bg-white/95 px-4 py-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                openSheet({
                  type: 'due',
                  partyId: selectedParty.id,
                  defaultEntryType:
                    selectedParty.role === 'supplier' ? 'supplier_payment' : 'manual_due_given',
                })
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-[#DC2626] text-base font-bold text-white shadow-sm transition-colors hover:bg-[#B91C1C] active:scale-[0.98]"
            >
              দিচ্ছি {selectedParty.role === 'supplier' ? '(পরিশোধ)' : '(বাকি)'}
            </button>
            <button
              type="button"
              onClick={() =>
                openSheet({
                  type: 'due',
                  partyId: selectedParty.id,
                  defaultEntryType:
                    selectedParty.role === 'customer' ? 'customer_collection' : 'manual_due_received',
                })
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-[#0D7A56] text-base font-bold text-white shadow-sm transition-colors hover:bg-[#096244] active:scale-[0.98]"
            >
              নিচ্ছি {selectedParty.role === 'customer' ? '(আদায়)' : '(বাকি)'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Main Due Book List View (বাকির খাতা)
  // =========================================================================
  const customerCount = parties.filter((p) => p.role === 'customer').length;
  const supplierCount = parties.filter((p) => p.role === 'supplier').length;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      {/* Summary Header Card (Reference Screenshots 2 & 5 styled in Emerald UI) */}
      <section className="rounded-3xl bg-white p-5 shadow-card">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#FEF2F2] p-4 text-center">
            <p className="text-xs font-semibold text-[#B91C1C]">বর্তমান মোট পাবো (কাস্টমার)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#DC2626]">
              {formatTaka(currentBalances.totalReceivables)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#E8F6EF] p-4 text-center">
            <p className="text-xs font-semibold text-[#0A6245]">বর্তমান মোট দিবো (সাপ্লায়ার)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-[#0D7A56]">
              {formatTaka(currentBalances.totalPayables)}
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#EFF4F1] pt-3 text-xs">
          <span className="text-[#4B6157]">
            পাবো/দিবো সমন্বয়ের পর নিট:{' '}
            <strong
              className={`tabular-nums ${
                currentBalances.netDuePosition >= 0 ? 'text-[#DC2626]' : 'text-[#0D7A56]'
              }`}
            >
              {currentBalances.netDuePosition >= 0 ? 'পাবো' : 'দিবো'}{' '}
              {formatTaka(Math.abs(currentBalances.netDuePosition))}
            </strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openSheet({ type: 'due', defaultEntryType: 'customer_collection' })}
              className="rounded-xl bg-[#E6F4EE] px-3 py-1.5 font-semibold text-[#0D7A56] hover:bg-[#D5ECE1]"
            >
              + বাকি আদায়
            </button>
            <button
              type="button"
              onClick={() => openSheet({ type: 'party', defaultRole: roleTab === 'supplier' ? 'supplier' : 'customer' })}
              className="inline-flex items-center gap-1 rounded-xl bg-[#0D7A56] px-3 py-1.5 font-semibold text-white hover:bg-[#096244]"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>নতুন পার্টি</span>
            </button>
          </div>
        </div>
      </section>

      {/* Segmented Role Tabs (Reference Image 1 Emerald Tabs) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-full bg-[#E9F0EC] p-1">
          {[
            { id: 'all' as const, label: `সব (${formatBanglaNumber(parties.length)})` },
            { id: 'customer' as const, label: `কাস্টমার (${formatBanglaNumber(customerCount)})` },
            { id: 'supplier' as const, label: `সাপ্লায়ার (${formatBanglaNumber(supplierCount)})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setRoleTab(tab.id)}
              className={`min-h-[40px] rounded-full px-4 text-xs font-semibold whitespace-nowrap transition-colors ${
                roleTab === tab.id ? 'bg-[#0D7A56] text-white shadow-xs' : 'text-[#486055]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOnlyWithDue((v) => !v)}
            className={`min-h-[40px] rounded-xl border px-3 text-xs font-semibold transition-colors ${
              onlyWithDue
                ? 'border-[#0D7A56] bg-[#E6F4EE] text-[#0D7A56]'
                : 'border-[#DCE6E0] bg-white text-[#486055]'
            }`}
          >
            শুধু বাকি আছে
          </button>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'due' | 'recent' | 'name')}
            aria-label="সাজানোর ক্রম"
            className="h-10 rounded-xl border border-[#DCE6E0] bg-white px-3 text-xs font-semibold text-[#354B41] focus:border-[#0D7A56] focus:outline-none"
          >
            <option value="due">বেশি বাকি আগে</option>
            <option value="recent">সাম্প্রতিক</option>
            <option value="name">নাম অনুযায়ী</option>
          </select>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-[#6F847A]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="খুঁজুন (নাম বা মোবাইল নম্বর)"
          className="h-12 w-full rounded-2xl border border-[#DCE6E0] bg-white pr-4 pl-11 text-sm text-[#0F1F18] shadow-card placeholder:text-[#7D9187] focus:border-[#0D7A56] focus:outline-none"
        />
      </div>

      {/* Party List */}
      {filteredParties.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="কোনো কাস্টমার বা সাপ্লায়ার পাওয়া যায়নি"
          description="নতুন কাস্টমার বা সাপ্লায়ার যোগ করে সহজেই বাকির খাতা শুরু করুন।"
          actionLabel="+ নতুন পার্টি যোগ করুন"
          onAction={() => openSheet({ type: 'party', defaultRole: 'customer' })}
        />
      ) : (
        <div className="space-y-2.5">
          {filteredParties.map((party) => {
            const initial = party.name.trim().charAt(0).toUpperCase();
            const isReceivable = party.balance > 0;
            const isPayable = party.balance < 0;

            return (
              <button
                key={party.id}
                type="button"
                onClick={() => setSelectedPartyId(party.id)}
                className="flex min-h-[72px] w-full items-center gap-3.5 rounded-2xl bg-white p-3.5 text-left shadow-card transition-all hover:bg-[#F9FCFA] active:scale-[0.99]"
              >
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold ${
                    party.role === 'customer'
                      ? 'bg-[#E6F4EE] text-[#0D7A56]'
                      : 'bg-[#EEF2FF] text-[#3730A3]'
                  }`}
                >
                  {initial}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#0F1F18]">{party.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[#586B62]">
                    {party.phone || 'মোবাইল নেই'}
                    {party.lastTransactionAt
                      ? ` · ${formatBanglaDate(party.lastTransactionAt)}`
                      : ''}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`text-sm font-bold tabular-nums ${
                      isReceivable
                        ? 'text-[#DC2626]'
                        : isPayable
                          ? 'text-[#0D7A56]'
                          : 'text-[#6A7F75]'
                    }`}
                  >
                    {formatTaka(Math.abs(party.balance))}
                  </p>
                  <p className="text-[11px] text-[#586B62]">
                    {isReceivable
                      ? 'পাবো'
                      : isPayable
                        ? 'দিবো'
                        : party.role === 'customer'
                          ? 'কাস্টমার'
                          : 'সাপ্লায়ার'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Floating Mobile Quick Add Due CTA */}
      <div className="pt-2">
        <button
          type="button"
          onClick={() => openSheet({ type: 'due', defaultEntryType: 'customer_collection' })}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#0D7A56] text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#096244] active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" />
          <span>বাকি আদায় / পরিশোধ যোগ করুন</span>
        </button>
      </div>
    </div>
  );
}
