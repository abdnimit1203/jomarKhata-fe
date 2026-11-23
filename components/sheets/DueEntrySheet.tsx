'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowDownLeft, ArrowUpRight, HandCoins, PackageOpen } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { PartyPicker, balanceText } from '@/components/ui/PartyPicker';
import { FeatureIcon } from '@/components/ui/FeatureIcon';
import { DateInput } from '@/components/ui/DateInput';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { dateInputToIso, formatTaka, parseNumericInput, toDateInputValue } from '@/lib/format';
import type { DueTransaction, PaymentChannel, PartyRole } from '@/types/domain';
import type { RecordDueEntryInput } from '@/services/jomarkhataService';
import { DUE_CHOICES, choiceOf, entryOf, type DueChoice } from '@/lib/dues';

type EntryType = RecordDueEntryInput['entryType'];

const CHOICE_ICON: Record<DueChoice, React.ComponentType<{ className?: string }>> = {
  got: ArrowDownLeft,
  paid: ArrowUpRight,
  gave_credit: PackageOpen,
  took_credit: HandCoins,
};

/** Sensible first choice for a role: customers usually pay us; we usually pay suppliers. */
function defaultChoice(role: PartyRole | undefined): DueChoice {
  return role === 'supplier' ? 'paid' : 'got';
}

function entryTypeOfDue(d: DueTransaction): EntryType {
  if (d.source === 'customer_collection') return 'customer_collection';
  if (d.source === 'supplier_payment') return 'supplier_payment';
  return d.direction === 'given' ? 'manual_due_given' : 'manual_due_received';
}

interface DueEntrySheetProps {
  open: boolean;
  initialPartyId?: string | null;
  defaultEntryType?: EntryType;
  editDue?: DueTransaction | null;
  onClose: () => void;
}

/**
 * পাওনা-দেনা entry. Four plain choices (টাকা পেলাম / টাকা দিলাম / বাকিতে দিলাম / বাকিতে নিলাম),
 * each mapped to one existing service entry type in lib/dues.ts (no service change).
 */
export function DueEntrySheet({ open, initialPartyId, defaultEntryType, editDue, onClose }: DueEntrySheetProps) {
  const { data, actions } = useJomarkhata();
  const initialParty = data?.parties.find((p) => p.id === (editDue?.partyId ?? initialPartyId));
  const [choice, setChoice] = useState<DueChoice>(() =>
    editDue ? choiceOf(entryTypeOfDue(editDue)) : defaultEntryType ? choiceOf(defaultEntryType) : defaultChoice(initialParty?.role)
  );
  const [partyId, setPartyId] = useState(() => editDue?.partyId ?? initialPartyId ?? '');
  const [amountRaw, setAmountRaw] = useState(() => (editDue ? String(editDue.amount) : ''));
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(() => editDue?.paymentMethod ?? 'cash');
  const [note, setNote] = useState(() => editDue?.note ?? '');
  const [dateValue, setDateValue] = useState(() => toDateInputValue(editDue?.date ?? new Date().toISOString()));
  const [editReason, setEditReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const party = useMemo(() => data?.parties.find((p) => p.id === partyId) ?? null, [data?.parties, partyId]);
  const preferredRole: PartyRole | undefined =
    defaultEntryType === 'supplier_payment' ? 'supplier' : defaultEntryType === 'customer_collection' ? 'customer' : undefined;

  const picked = DUE_CHOICES.find((c) => c.key === choice)!;
  const entryType = entryOf(choice);
  const withMoney = picked.withMoney;
  const amount = Math.round(Math.max(0, parseNumericInput(amountRaw)));
  const gives = entryType === 'supplier_payment' || entryType === 'manual_due_given';
  const delta = gives ? amount : -amount;
  const baseBalance = party ? party.balance - (editDue ? (editDue.direction === 'given' ? editDue.amount : -editDue.amount) : 0) : 0;
  const after = baseBalance + delta;

  const choosePartyId = (id: string) => {
    setPartyId(id);
    const p = data?.parties.find((x) => x.id === id);
    if (p && !defaultEntryType && !editDue) setChoice(defaultChoice(p.role));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!partyId) return setFormError('কার সাথে লেনদেন, আগে বাছুন।');
    if (amount <= 0) return setFormError('টাকার পরিমাণ লিখুন।');
    setIsSubmitting(true);
    try {
      const date = dateInputToIso(dateValue, editDue?.date);
      if (editDue) {
        await actions.editDueEntry(editDue.id, {
          amount,
          paymentMethod: withMoney ? paymentMethod : undefined,
          note: note.trim() || undefined,
          date,
        }, editReason);
      } else {
        await actions.recordDueEntry({
          partyId,
          entryType,
          amount,
          paymentMethod: withMoney ? paymentMethod : undefined,
          note: note.trim() || undefined,
          date,
        });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = editDue ? 'লেনদেন সংশোধন' : party ? `${party.name} — লেনদেন` : 'নতুন লেনদেন';

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={party ? `এখন: ${balanceText(party.balance)}` : 'কার সাথে লেনদেন, আগে বাছুন'}
      footer={
        <button
          type="submit"
          form="due-entry-form"
          disabled={isSubmitting || amount <= 0 || !partyId}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-bold text-on-primary shadow-sm transition-colors hover:brightness-[0.97] disabled:opacity-50"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে…' : `${picked.label} — সংরক্ষণ করুন`}
        </button>
      }
    >
      <form id="due-entry-form" onSubmit={handleSubmit} className="space-y-4">
        {!initialPartyId && (
          <PartyPicker
            label="কার সাথে? *"
            value={partyId}
            onChange={choosePartyId}
            role={party?.role ?? preferredRole}
            disabled={!!editDue}
            invalid={!!formError && !partyId}
          />
        )}

        {partyId && !editDue && (
          <div role="radiogroup" aria-label="কী হলো?" className="grid grid-cols-2 gap-2.5">
            {DUE_CHOICES.map((c) => {
              const Icon = CHOICE_ICON[c.key];
              const active = c.key === choice;
              return (
                <button
                  key={c.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChoice(c.key)}
                  className={`flex items-center gap-2.5 rounded-2xl border-2 bg-white p-2.5 text-left transition-colors ${
                    active ? 'border-primary-ink shadow-card' : 'border-border'
                  }`}
                >
                  <FeatureIcon tone={c.tone} size="sm">
                    <Icon />
                  </FeatureIcon>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold text-ink">{c.label}</span>
                    <span className="block text-xs leading-snug text-ink-muted">{c.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {editDue && (
          <p className="rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm font-semibold text-ink">{picked.label}</p>
        )}

        {formError && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-sm font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="due-amount" className="text-sm font-semibold text-ink-muted">
              টাকার পরিমাণ *
            </label>
            {party && party.balance !== 0 && !editDue && (
              <button
                type="button"
                onClick={() => setAmountRaw(String(Math.abs(party.balance)))}
                className="text-sm font-semibold text-primary-ink hover:underline"
              >
                পুরো হিসাব ({formatTaka(Math.abs(party.balance))})
              </button>
            )}
          </div>
          <NumericInput id="due-amount" value={amountRaw} onChange={(raw) => setAmountRaw(raw)} placeholder="যেমন: ১,০০০" inputSize="lg" />
          {party && amount > 0 && (
            <p className="mt-1.5 text-sm font-semibold text-ink-muted">
              এরপর:{' '}
              <span className={after > 0 ? 'text-danger' : after < 0 ? 'text-primary-ink' : 'text-ink'}>{balanceText(after)}</span>
            </p>
          )}
        </div>

        {withMoney && (
          <PaymentChannelPicker
            label={choice === 'got' ? 'কোন মাধ্যমে টাকা পেলেন?' : 'কোন মাধ্যমে টাকা দিলেন?'}
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        )}

        {editDue && (
          <div>
            <label htmlFor="edit-reason" className="mb-1 block text-sm font-semibold text-ink-muted">
              সংশোধনের কারণ (ঐচ্ছিক)
            </label>
            <input
              id="edit-reason"
              type="text"
              value={editReason}
              onChange={(e) => setEditReason(e.target.value)}
              placeholder="যেমন: দাম ভুল লেখা হয়েছিল"
              className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
            />
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-muted">তারিখ</span>
          <DateInput value={dateValue} onChange={setDateValue} aria-label="লেনদেনের তারিখ" />
        </div>

        <div>
          <label htmlFor="due-note" className="mb-1 block text-sm text-ink-muted">
            নোট (ঐচ্ছিক)
          </label>
          <input
            id="due-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: বিকাশে পাঠিয়েছে / পুরোনো বাকি শোধ"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-base text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}
