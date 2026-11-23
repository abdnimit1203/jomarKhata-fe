'use client';

import React, { useMemo, useState } from 'react';
import { Calendar, Copy, Edit3, MessageCircle, MessageSquare, Phone, Plus, Search, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import { ShowMore, usePaged } from '@/components/ui/ShowMore';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { DateInput } from '@/components/ui/DateInput';
import { partyMatches } from '@/components/ui/PartyPicker';
import { getPeriodBounds, isWithinRange } from '@/services/financeCalculator';
import { formatBanglaDate, formatBanglaDateTime, formatBanglaNumber, formatTaka, getChannelShortLabel } from '@/lib/format';
import type { Party, PeriodPreset } from '@/types/domain';
import { SegmentedControl } from '@/components/ui/segmented';
import { reminderMessage, toWhatsAppNumber } from '@/lib/dues';



function BalanceLabel({ balance, className = '' }: { balance: number; className?: string }) {
  if (balance > 0) return <span className={`text-danger ${className}`}>পাবো {formatTaka(balance)}</span>;
  if (balance < 0) return <span className={`text-primary-ink ${className}`}>দিবো {formatTaka(Math.abs(balance))}</span>;
  return <span className={`text-ink-subtle ${className}`}>বাকি নেই</span>;
}

export function DuesView() {
  const { data, currentBalances, selectedPartyId, setSelectedPartyId, openSheet, actions, showToast } = useJomarkhata();

  const [roleTab, setRoleTab] = useState<'all' | 'customer' | 'supplier'>('all');
  const [onlyWithDue, setOnlyWithDue] = useState(false);
  const [sortBy, setSortBy] = useState<'due' | 'recent' | 'name'>('due');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detailPeriod, setDetailPeriod] = useState<PeriodPreset>('all');
  const [remindOpen, setRemindOpen] = useState(false);

  const parties = useMemo(() => data?.parties ?? [], [data?.parties]);
  const selectedParty = useMemo(
    () => (selectedPartyId ? parties.find((p) => p.id === selectedPartyId) ?? null : null),
    [parties, selectedPartyId]
  );

  const filteredParties = useMemo(() => {
    return parties
      .filter((p) => (roleTab === 'all' || p.role === roleTab) && (!onlyWithDue || p.balance !== 0) && partyMatches(p, search))
      .sort((a, b) => {
        if (sortBy === 'due') return Math.abs(b.balance) - Math.abs(a.balance);
        if (sortBy === 'name') return a.name.localeCompare(b.name, 'bn');
        const ta = a.lastTransactionAt ? Date.parse(a.lastTransactionAt) : 0;
        const tb = b.lastTransactionAt ? Date.parse(b.lastTransactionAt) : 0;
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
    let given = 0;
    let received = 0;
    for (const t of partyLedger) {
      if (t.status !== 'active') continue;
      if (t.direction === 'given') given += t.amount;
      else received += t.amount;
    }
    return { given, received };
  }, [partyLedger]);

  // Hooks must run before any early return.
  const listPage = usePaged(filteredParties, `${roleTab}|${onlyWithDue}|${sortBy}|${search}`);
  const ledgerPage = usePaged(partyLedger, `${selectedPartyId}|${detailPeriod}`);

  if (!data) return null;

  // ===================================================================== Party detail
  if (selectedParty) {
    const msg = reminderMessage(selectedParty, data.businessProfile.shopName);
    const wa = selectedParty.phone ? toWhatsAppNumber(selectedParty.phone) : null;
    const copyReminder = async () => {
      try {
        await navigator.clipboard.writeText(msg);
        showToast('তাগাদার বার্তা কপি হয়েছে। এখন যেকোনো অ্যাপে পেস্ট করে পাঠান।');
      } catch {
        showToast('কপি করা যায়নি। বার্তাটি হাতে লিখে পাঠান।', 'error');
      }
      setRemindOpen(false);
    };
    const opened = (app: string) => {
      showToast(`${app} খোলা হয়েছে — বার্তা পাঠানো হলো কিনা সেখানে দেখে নিন।`, 'info');
      setRemindOpen(false);
    };

    return (
      <div className="mx-auto max-w-4xl space-y-4 pb-36 lg:pb-8">
        <section className="rounded-3xl bg-white p-4 shadow-card">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-ink-muted">{selectedParty.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}</p>
              <h2 className="truncate text-xl font-bold text-ink">{selectedParty.name}</h2>
              <p className="text-sm text-ink-muted tabular-nums">{selectedParty.phone || 'মোবাইল নম্বর নেই'}</p>
            </div>
            <button
              type="button"
              onClick={() => openSheet({ type: 'party', editParty: selectedParty })}
              aria-label="তথ্য এডিট"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-muted text-ink-muted"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          </div>

          <p className="mt-3 text-2xl font-extrabold tabular-nums">
            <BalanceLabel balance={selectedParty.balance} />
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {selectedParty.phone ? (
              <a
                href={`tel:${selectedParty.phone}`}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-bold text-primary-ink"
              >
                <Phone className="h-4 w-4" /> কল করুন
              </a>
            ) : (
              <button
                type="button"
                onClick={() => openSheet({ type: 'party', editParty: selectedParty })}
                className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-sm font-bold text-ink-muted"
              >
                <Phone className="h-4 w-4" /> মোবাইল যোগ করুন
              </button>
            )}
            <button
              type="button"
              disabled={selectedParty.balance <= 0}
              onClick={() => setRemindOpen((v) => !v)}
              aria-expanded={remindOpen}
              className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-sm font-bold text-on-primary disabled:opacity-40"
            >
              <MessageCircle className="h-4 w-4" /> তাগাদা পাঠান
            </button>
          </div>

          {remindOpen && (
            <div className="mt-2 space-y-2 rounded-2xl bg-canvas p-3">
              <p className="text-sm text-ink">{msg}</p>
              <div className="grid grid-cols-3 gap-2">
                {wa ? (
                  <a
                    href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => opened('WhatsApp')}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-tile-green-bg text-sm font-bold text-tile-green-fg"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-xl bg-surface-muted text-xs text-ink-muted">WhatsApp নম্বর নেই</span>
                )}
                {selectedParty.phone ? (
                  <a
                    href={`sms:${selectedParty.phone}?body=${encodeURIComponent(msg)}`}
                    onClick={() => opened('SMS')}
                    className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-tile-sky-bg text-sm font-bold text-tile-sky-fg"
                  >
                    <MessageSquare className="h-4 w-4" /> SMS
                  </a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-xl bg-surface-muted text-xs text-ink-muted">মোবাইল নেই</span>
                )}
                <button
                  type="button"
                  onClick={copyReminder}
                  className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-white text-sm font-bold text-ink shadow-card"
                >
                  <Copy className="h-4 w-4" /> কপি
                </button>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-canvas px-3.5 py-2.5">
            <span className="flex items-center gap-2 text-sm font-medium text-ink-muted">
              <Calendar className="h-4 w-4 text-primary-ink" /> পরিশোধের তারিখ
            </span>
            <DateInput
              value={selectedParty.dueReminderDate ?? ''}
              onChange={(value) => actions.setPartyDueReminder(selectedParty.id, value || null)}
              aria-label="পরিশোধের সম্ভাব্য তারিখ"
              className="w-44"
            />
          </div>
        </section>

        <SegmentedControl
          aria-label="সময়কাল"
          variant="chips"
          value={detailPeriod}
          onValueChange={(v) => setDetailPeriod(v as PeriodPreset)}
          options={[
            { value: 'today', label: 'আজ' },
            { value: 'month', label: 'মাস' },
            { value: 'year', label: 'বছর' },
            { value: 'all', label: 'সব' },
          ]}
        />

        {/* Ledger: one readable row per entry; every balance carries the word পাবো / দিবো */}
        <section className="overflow-hidden rounded-3xl bg-white shadow-card">
          <div className="grid grid-cols-2 gap-2 border-b border-border bg-canvas px-4 py-3 text-sm font-bold tabular-nums">
            <p className="text-danger">দিয়েছি {formatTaka(partyTotals.given)}</p>
            <p className="text-right text-primary-ink">নিয়েছি {formatTaka(partyTotals.received)}</p>
          </div>
          {partyLedger.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">এই সময়ে কোনো লেনদেন নেই।</p>
          ) : (
            <div className="divide-y divide-border">
              {ledgerPage.visible.map((t) => {
                const isVoided = t.status === 'voided';
                const linked = (t.source === 'sale' || t.source === 'purchase') && t.sourceId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      openSheet({
                        type: 'transaction_detail',
                        sourceType: linked ? (t.source as 'sale' | 'purchase') : 'due_transaction',
                        sourceId: linked ? (t.sourceId as string) : t.id,
                      })
                    }
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas ${isVoided ? 'opacity-55' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {t.note || (t.direction === 'received' ? 'নিয়েছি' : 'দিয়েছি')}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {formatBanglaDateTime(t.date)}
                        {t.paymentMethod ? ` · ${getChannelShortLabel(t.paymentMethod)}` : ' · শুধু বাকি'}
                        {isVoided ? ' · বাতিল' : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold tabular-nums ${t.direction === 'given' ? 'text-danger' : 'text-primary-ink'} ${isVoided ? 'line-through' : ''}`}>
                        {t.direction === 'given' ? 'দিয়েছি' : 'নিয়েছি'} {formatTaka(t.amount)}
                      </p>
                      <p className="text-xs font-semibold tabular-nums">
                        <BalanceLabel balance={t.runningBalance} />
                      </p>
                    </div>
                  </button>
                );
              })}
              {ledgerPage.remaining > 0 && (
                <div className="p-3">
                  <ShowMore remaining={ledgerPage.remaining} onMore={ledgerPage.more} />
                </div>
              )}
            </div>
          )}
        </section>

        {/* Sticky দিচ্ছি / নিচ্ছি (above the bottom bar on mobile) */}
        <div className="fixed right-0 bottom-16 left-0 z-30 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                openSheet({
                  type: 'due',
                  partyId: selectedParty.id,
                  defaultEntryType: selectedParty.role === 'supplier' ? 'supplier_payment' : 'manual_due_given',
                })
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-danger text-base font-bold text-white shadow-sm hover:bg-danger-hover active:scale-[0.98]"
            >
              দিচ্ছি
            </button>
            <button
              type="button"
              onClick={() =>
                openSheet({
                  type: 'due',
                  partyId: selectedParty.id,
                  defaultEntryType: selectedParty.role === 'customer' ? 'customer_collection' : 'manual_due_received',
                })
              }
              className="flex h-12 items-center justify-center rounded-2xl bg-primary-gradient text-base font-bold text-on-primary shadow-sm hover:brightness-[0.97] active:scale-[0.98]"
            >
              নিচ্ছি
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===================================================================== List
  const customerCount = parties.filter((p) => p.role === 'customer').length;
  const supplierCount = parties.length - customerCount;
  const filtersActive = onlyWithDue || sortBy !== 'due';

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-28 lg:pb-6">
      {/* Compact summary */}
      <section className="grid grid-cols-2 gap-2.5">
        <div className="rounded-2xl bg-danger-soft px-3.5 py-3">
          <p className="text-xs font-semibold text-danger">মোট পাবো</p>
          <p className="text-xl font-bold tabular-nums text-danger">{formatTaka(currentBalances.totalReceivables)}</p>
        </div>
        <div className="rounded-2xl bg-secondary px-3.5 py-3">
          <p className="text-xs font-semibold text-primary-ink">মোট দিবো</p>
          <p className="text-xl font-bold tabular-nums text-primary-ink">{formatTaka(currentBalances.totalPayables)}</p>
        </div>
      </section>

      {/* Search right below the summary */}
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="নাম বা মোবাইল দিয়ে খুঁজুন"
          aria-label="পার্টি খুঁজুন"
          className="h-12 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-base text-ink shadow-card placeholder:text-ink-subtle focus:border-primary-ink focus:outline-none"
        />
      </div>

      {/* One row: role tabs + filter icon + new party */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <SegmentedControl
            aria-label="কাস্টমার / সাপ্লায়ার"
            variant="track"
            size="sm"
            value={roleTab}
            onValueChange={setRoleTab}
            options={[
              { value: 'all', label: `সব ${formatBanglaNumber(parties.length)}` },
              { value: 'customer', label: `কাস্টমার ${formatBanglaNumber(customerCount)}` },
              { value: 'supplier', label: `সাপ্লায়ার ${formatBanglaNumber(supplierCount)}` },
            ]}
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-label="ফিল্টার ও সাজানো"
          aria-expanded={filtersOpen}
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border-strong bg-white text-ink-muted"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {filtersActive && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger" />}
        </button>
        <button
          type="button"
          onClick={() => openSheet({ type: 'party', defaultRole: roleTab === 'supplier' ? 'supplier' : 'customer' })}
          aria-label="নতুন পার্টি"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-ink"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </div>

      {filtersOpen && (
        <div className="space-y-2.5 rounded-2xl bg-white p-3.5 shadow-card">
          <label className="flex items-center gap-2.5 text-sm font-semibold text-ink">
            <input type="checkbox" checked={onlyWithDue} onChange={(e) => setOnlyWithDue(e.target.checked)} className="h-5 w-5 accent-primary" />
            শুধু যাদের বাকি আছে
          </label>
          <SegmentedControl
            aria-label="সাজানোর ক্রম"
            variant="chips"
            size="sm"
            value={sortBy}
            onValueChange={setSortBy}
            options={[
              { value: 'due', label: 'বেশি বাকি আগে' },
              { value: 'recent', label: 'সাম্প্রতিক' },
              { value: 'name', label: 'নাম' },
            ]}
          />
        </div>
      )}

      {filteredParties.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={parties.length === 0 ? 'এখনও কোনো কাস্টমার বা সাপ্লায়ার নেই' : 'কাউকে পাওয়া যায়নি'}
          description="নতুন কাস্টমার বা সাপ্লায়ার যোগ করে বাকির খাতা শুরু করুন।"
          actionLabel="+ নতুন পার্টি যোগ করুন"
          onAction={() => openSheet({ type: 'party', defaultRole: 'customer' })}
        />
      ) : (
        <div className="space-y-2">
          {listPage.visible.map((party) => (
            <button
              key={party.id}
              type="button"
              onClick={() => setSelectedPartyId(party.id)}
              className="flex min-h-[68px] w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-card transition-all hover:bg-canvas active:scale-[0.99]"
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-base font-bold ${
                  party.role === 'customer' ? 'bg-secondary text-primary-ink' : 'bg-warning-soft text-warning-ink'
                }`}
              >
                {party.name.trim().charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-ink">{party.name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {party.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}
                  {party.phone ? ` · ${party.phone}` : ''}
                  {party.lastTransactionAt ? ` · ${formatBanglaDate(party.lastTransactionAt)}` : ''}
                </span>
              </span>
              <span className="shrink-0 text-right text-sm font-bold tabular-nums">
                <BalanceLabel balance={party.balance} />
              </span>
            </button>
          ))}
          <ShowMore remaining={listPage.remaining} onMore={listPage.more} />
        </div>
      )}

      {/* Sticky "নতুন বাকি" (mobile: floats above the bottom bar) */}
      <div className="fixed right-4 bottom-20 z-30 lg:static lg:pt-2">
        <button
          type="button"
          onClick={() => openSheet({ type: 'due' })}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary-gradient px-5 text-base font-bold text-on-primary shadow-hero active:scale-[0.98] lg:w-full lg:rounded-2xl"
        >
          <Plus className="h-5 w-5" /> নতুন বাকি
        </button>
      </div>
    </div>
  );
}
