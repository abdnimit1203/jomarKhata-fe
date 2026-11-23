'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Copy,
  HandCoins,
  MessageCircle,
  MessageSquare,
  PackageOpen,
  Pencil,
  Phone,
  Plus,
  Search,
  SlidersHorizontal,
  UserPlus,
  Users,
} from 'lucide-react';
import { ShowMore, usePaged } from '@/components/ui/ShowMore';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { DateInput } from '@/components/ui/DateInput';
import { FeatureIcon } from '@/components/ui/FeatureIcon';
import { MonthYearPicker } from '@/components/ui/MonthYearPicker';
import { SegmentedControl } from '@/components/ui/segmented';
import { formatBanglaDate, formatBanglaDateTime, formatBanglaNumber, formatTaka, getChannelShortLabel, toBanglaDigits } from '@/lib/format';
import { DUE_CHOICES, balanceSentence, balanceText, dueRowLabel, ownNote, partyMatches, reminderMessage, toWhatsAppNumber, type DueChoice } from '@/lib/dues';
import { BANGLA_MONTHS, currentMonth, monthRange, yearOptions, type MonthValue } from '@/lib/months';
import { T } from '@/lib/terms';
import type { DueTransaction } from '@/types/domain';

const CHOICE_ICON: Record<DueChoice, React.ComponentType<{ className?: string }>> = {
  got: ArrowDownLeft,
  paid: ArrowUpRight,
  gave_credit: PackageOpen,
  took_credit: HandCoins,
};
const CHOICE = Object.fromEntries(DUE_CHOICES.map((c) => [c.key, c])) as Record<DueChoice, (typeof DUE_CHOICES)[number]>;

/** পাওনা = green (money will come to you), দেনা = red (you have to pay). */
function balanceTone(balance: number) {
  if (balance > 0) return 'text-success';
  if (balance < 0) return 'text-danger';
  return 'text-ink-subtle';
}

export function DuesView() {
  const { data, currentBalances, selectedPartyId, setSelectedPartyId, openSheet, actions, showToast } = useJomarkhata();

  const [view, setView] = useState<'all' | 'receivable' | 'payable'>('all');
  const [role, setRole] = useState<'all' | 'customer' | 'supplier'>('all');
  const [sortBy, setSortBy] = useState<'amount' | 'recent' | 'name'>('amount');
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [range, setRange] = useState<'all' | 'month'>('all');
  const [picked, setPicked] = useState<MonthValue>(() => currentMonth());
  const [panel, setPanel] = useState<'none' | 'remind' | 'day'>('none');

  const parties = useMemo(() => data?.parties ?? [], [data?.parties]);
  const selectedParty = useMemo(
    () => (selectedPartyId ? parties.find((p) => p.id === selectedPartyId) ?? null : null),
    [parties, selectedPartyId]
  );

  const filteredParties = useMemo(
    () =>
      parties
        .filter(
          (p) =>
            (view === 'all' || (view === 'receivable' ? p.balance > 0 : p.balance < 0)) &&
            (role === 'all' || p.role === role) &&
            partyMatches(p, search)
        )
        .sort((a, b) => {
          if (sortBy === 'amount') return Math.abs(b.balance) - Math.abs(a.balance);
          if (sortBy === 'name') return a.name.localeCompare(b.name, 'bn');
          return (b.lastTransactionAt ? Date.parse(b.lastTransactionAt) : 0) - (a.lastTransactionAt ? Date.parse(a.lastTransactionAt) : 0);
        }),
    [parties, view, role, sortBy, search]
  );

  const partyRows = useMemo(() => {
    if (!data || !selectedParty) return [];
    const r = range === 'month' ? monthRange(picked) : null;
    return data.dueTransactions
      .filter((t) => t.partyId === selectedParty.id && (!r || (Date.parse(t.date) >= r.start.getTime() && Date.parse(t.date) <= r.end.getTime())))
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [data, selectedParty, range, picked]);

  const listPage = usePaged(filteredParties, `${view}|${role}|${sortBy}|${search}`);
  const rowsPage = usePaged(partyRows, `${selectedPartyId}|${range}|${picked.year}-${picked.month}`);

  if (!data) return null;

  // ======================================================================= one party
  if (selectedParty) {
    const msg = reminderMessage(selectedParty, data.businessProfile.shopName);
    const wa = selectedParty.phone ? toWhatsAppNumber(selectedParty.phone) : null;
    const b = selectedParty.balance;
    const cardTone = b > 0 ? 'bg-tile-green-bg' : b < 0 ? 'bg-danger-soft' : 'bg-surface-muted';
    const opened = (app: string) => {
      showToast(`${app} খোলা হয়েছে — বার্তা পাঠানো হলো কিনা সেখানে দেখে নিন।`, 'info');
      setPanel('none');
    };
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(msg);
        showToast('বার্তা কপি হয়েছে। যেকোনো অ্যাপে পেস্ট করে পাঠান।');
      } catch {
        showToast('কপি করা যায়নি। বার্তাটি হাতে লিখে পাঠান।', 'error');
      }
      setPanel('none');
    };

    // group the visible rows by month, newest first
    const groups: Array<{ key: string; label: string; rows: DueTransaction[]; net: number }> = [];
    for (const r of rowsPage.visible) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      let g = groups.find((x) => x.key === key);
      if (!g) {
        g = { key, label: `${BANGLA_MONTHS[d.getMonth()]} ${toBanglaDigits(d.getFullYear())}`, rows: [], net: 0 };
        groups.push(g);
      }
      g.rows.push(r);
      if (r.status === 'active') g.net += r.direction === 'given' ? r.amount : -r.amount;
    }

    const action = (label: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void, disabled = false) => (
      <button type="button" onClick={onClick} disabled={disabled} className="flex flex-col items-center gap-1 disabled:opacity-40">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary-ink shadow-card">
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-xs font-semibold text-ink">{label}</span>
      </button>
    );

    return (
      <div className="mx-auto max-w-4xl space-y-4 pb-36 lg:pb-8">
        <section className={`rounded-3xl p-4 ${cardTone}`}>
          <p className="text-xs font-semibold text-ink-muted">
            {selectedParty.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}
            {selectedParty.phone ? ` · ${selectedParty.phone}` : ''}
          </p>
          <p className={`mt-1 text-3xl font-extrabold tabular-nums ${balanceTone(b)}`}>{balanceText(b)}</p>
          <p className="mt-0.5 text-sm font-semibold text-ink">{balanceSentence(selectedParty.name, b)}</p>

          <div className="mt-4 grid grid-cols-4 gap-2">
            {selectedParty.phone
              ? action('কল', Phone, () => window.open(`tel:${selectedParty.phone}`, '_self'))
              : action('কল', Phone, () => openSheet({ type: 'party', editParty: selectedParty }))}
            {action(T.remind, MessageCircle, () => setPanel(panel === 'remind' ? 'none' : 'remind'), b <= 0)}
            {action(T.collectionDay, CalendarClock, () => setPanel(panel === 'day' ? 'none' : 'day'))}
            {action('এডিট', Pencil, () => openSheet({ type: 'party', editParty: selectedParty }))}
          </div>

          {panel === 'remind' && (
            <div className="mt-3 space-y-2 rounded-2xl bg-white p-3">
              <p className="text-sm text-ink">{msg}</p>
              <div className="grid grid-cols-3 gap-2">
                {wa ? (
                  <a href={`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" onClick={() => opened('WhatsApp')} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-tile-green-bg text-sm font-bold text-tile-green-fg">
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-xl bg-surface-muted text-xs text-ink-muted">WhatsApp নম্বর নেই</span>
                )}
                {selectedParty.phone ? (
                  <a href={`sms:${selectedParty.phone}?body=${encodeURIComponent(msg)}`} onClick={() => opened('SMS')} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-tile-sky-bg text-sm font-bold text-tile-sky-fg">
                    <MessageSquare className="h-4 w-4" /> SMS
                  </a>
                ) : (
                  <span className="flex h-11 items-center justify-center rounded-xl bg-surface-muted text-xs text-ink-muted">মোবাইল নেই</span>
                )}
                <button type="button" onClick={copy} className="flex h-11 items-center justify-center gap-1.5 rounded-xl bg-canvas text-sm font-bold text-ink">
                  <Copy className="h-4 w-4" /> কপি
                </button>
              </div>
            </div>
          )}
          {panel === 'day' && (
            <div className="mt-3 rounded-2xl bg-white p-3">
              <p className="mb-2 text-sm font-semibold text-ink-muted">কবে টাকা দেওয়ার কথা?</p>
              <DateInput
                value={selectedParty.dueReminderDate ?? ''}
                onChange={(value) => actions.setPartyDueReminder(selectedParty.id, value || null)}
                aria-label={T.collectionDay}
              />
            </div>
          )}
          {panel === 'none' && selectedParty.dueReminderDate && (
            <p className="mt-3 text-sm font-semibold text-ink-muted">
              {T.collectionDay}: {formatBanglaDate(selectedParty.dueReminderDate)}
            </p>
          )}
        </section>

        <div className="space-y-2">
          <SegmentedControl
            aria-label="কোন সময়ের লেনদেন"
            variant="track"
            size="sm"
            value={range}
            onValueChange={setRange}
            options={[
              { value: 'all', label: 'সব লেনদেন' },
              { value: 'month', label: 'মাস বাছুন' },
            ]}
          />
          {range === 'month' && (
            <MonthYearPicker value={picked} onChange={setPicked} years={yearOptions(partyRows.map((r) => r.date).concat(selectedParty.createdAt))} />
          )}
        </div>

        {/* Timeline grouped by month: what happened, and where the balance stood after it */}
        {partyRows.length === 0 ? (
          <p className="rounded-3xl bg-white py-10 text-center text-sm text-ink-muted shadow-card">এই সময়ে কোনো লেনদেন নেই।</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <section key={g.key} className="overflow-hidden rounded-3xl bg-white shadow-card">
                <div className="flex items-center justify-between gap-2 bg-canvas px-4 py-2.5">
                  <h3 className="text-sm font-bold text-ink">{g.label}</h3>
                  <span className={`text-xs font-bold tabular-nums ${balanceTone(g.net)}`}>
                    {g.net === 0 ? 'এ মাসে বদল নেই' : g.net > 0 ? `এ মাসে ${T.receivable} +${formatTaka(g.net)}` : `এ মাসে ${T.receivable} −${formatTaka(-g.net)}`}
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {g.rows.map((t) => {
                    const kind = dueRowLabel(t);
                    const Icon = CHOICE_ICON[kind];
                    const voided = t.status === 'voided';
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
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-canvas ${voided ? 'opacity-55' : ''}`}
                      >
                        <FeatureIcon tone={CHOICE[kind].tone} size="sm">
                          <Icon />
                        </FeatureIcon>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {CHOICE[kind].label}
                            {ownNote(t.note) ? ` · ${ownNote(t.note)}` : ''}
                          </span>
                          <span className="block text-xs text-ink-muted">
                            {formatBanglaDateTime(t.date)}
                            {t.paymentMethod ? ` · ${getChannelShortLabel(t.paymentMethod)}` : ''}
                            {voided ? ' · বাতিল' : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-sm font-bold tabular-nums text-ink ${voided ? 'line-through' : ''}`}>{formatTaka(t.amount)}</span>
                          <span className={`block text-xs font-semibold tabular-nums ${balanceTone(t.runningBalance)}`}>এরপর {balanceText(t.runningBalance)}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
            <ShowMore remaining={rowsPage.remaining} onMore={rowsPage.more} />
          </div>
        )}

        {/* One clear action instead of two split buttons */}
        <div className="fixed right-0 bottom-16 left-0 z-30 border-t border-border bg-white/95 px-4 py-3 backdrop-blur-md lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={() => openSheet({ type: 'due', partyId: selectedParty.id })}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-base font-bold text-on-primary shadow-sm active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" /> {T.newDueEntry}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ======================================================================= list
  const withReceivable = parties.filter((p) => p.balance > 0).length;
  const withPayable = parties.filter((p) => p.balance < 0).length;
  const filtersActive = role !== 'all' || sortBy !== 'amount';

  return (
    <div className="mx-auto max-w-5xl space-y-3 pb-28 lg:pb-6">
      <section className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={() => setView('receivable')} className="rounded-2xl bg-tile-green-bg px-3.5 py-3 text-left">
          <p className="text-xs font-semibold text-ink-muted">মোট {T.receivable} — আপনি পাবেন</p>
          <p className="text-xl font-bold tabular-nums text-success">{formatTaka(currentBalances.totalReceivables)}</p>
        </button>
        <button type="button" onClick={() => setView('payable')} className="rounded-2xl bg-danger-soft px-3.5 py-3 text-left">
          <p className="text-xs font-semibold text-ink-muted">মোট {T.payable} — আপনাকে দিতে হবে</p>
          <p className="text-xl font-bold tabular-nums text-danger">{formatTaka(currentBalances.totalPayables)}</p>
        </button>
      </section>

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

      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <SegmentedControl
            aria-label="কাদের দেখাবে"
            variant="track"
            size="sm"
            value={view}
            onValueChange={setView}
            options={[
              { value: 'all', label: `সবাই ${formatBanglaNumber(parties.length)}` },
              { value: 'receivable', label: `${T.receivable} ${formatBanglaNumber(withReceivable)}` },
              { value: 'payable', label: `${T.payable} ${formatBanglaNumber(withPayable)}` },
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
          onClick={() => openSheet({ type: 'party', defaultRole: role === 'supplier' ? 'supplier' : 'customer' })}
          aria-label="নতুন পার্টি"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-ink"
        >
          <UserPlus className="h-4 w-4" />
        </button>
      </div>

      {filtersOpen && (
        <div className="space-y-2.5 rounded-2xl bg-white p-3.5 shadow-card">
          <SegmentedControl
            aria-label="কাস্টমার না সাপ্লায়ার"
            variant="chips"
            size="sm"
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'all', label: 'সব ধরন' },
              { value: 'customer', label: 'কাস্টমার' },
              { value: 'supplier', label: 'সাপ্লায়ার' },
            ]}
          />
          <SegmentedControl
            aria-label="সাজানোর ক্রম"
            variant="chips"
            size="sm"
            value={sortBy}
            onValueChange={setSortBy}
            options={[
              { value: 'amount', label: 'বেশি টাকা আগে' },
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
          description="কাস্টমার বা সাপ্লায়ার যোগ করে পাওনা-দেনার হিসাব শুরু করুন।"
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
              className="flex min-h-[64px] w-full items-stretch overflow-hidden rounded-2xl bg-white text-left shadow-card transition-all hover:bg-canvas active:scale-[0.99]"
            >
              <span aria-hidden="true" className={`w-1.5 shrink-0 ${party.balance > 0 ? 'bg-success' : party.balance < 0 ? 'bg-danger' : 'bg-border-strong'}`} />
              <span className="flex min-w-0 flex-1 items-center gap-3 p-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">{party.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {party.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}
                    {party.lastTransactionAt ? ` · শেষ লেনদেন ${formatBanglaDate(party.lastTransactionAt)}` : ''}
                  </span>
                </span>
                <span className={`shrink-0 text-right text-sm font-bold tabular-nums ${balanceTone(party.balance)}`}>{balanceText(party.balance)}</span>
              </span>
            </button>
          ))}
          <ShowMore remaining={listPage.remaining} onMore={listPage.more} />
        </div>
      )}

      <div className="fixed right-4 bottom-20 z-30 lg:static lg:pt-2">
        <button
          type="button"
          onClick={() => openSheet({ type: 'due' })}
          className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary-gradient px-5 text-base font-bold text-on-primary shadow-hero active:scale-[0.98] lg:w-full lg:rounded-2xl"
        >
          <Plus className="h-5 w-5" /> {T.newDueEntry}
        </button>
      </div>
    </div>
  );
}
