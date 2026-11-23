'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { PartyPicker, balanceText } from '@/components/ui/PartyPicker';
import { SegmentedControl } from '@/components/ui/segmented';
import { DateInput } from '@/components/ui/DateInput';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { dateInputToIso, formatTaka, parseNumericInput, toDateInputValue } from '@/lib/format';
import type { DueTransaction, PaymentChannel, PartyRole } from '@/types/domain';
import type { RecordDueEntryInput } from '@/services/jomarkhataService';
import { fromEntryType, toEntryType, type DueFlow } from '@/lib/dues';

type EntryType = RecordDueEntryInput['entryType'];
type Flow = DueFlow;

// Mapping of দিচ্ছি/নিচ্ছি × টাকা দিয়ে/শুধু বাকিতে to service entry types: see lib/dues.ts.

/** The usual "with money?" answer for a role: customers pay us cash; we pay suppliers cash. */
function defaultWithMoney(flow: Flow, role: PartyRole | undefined): boolean {
  if (!role) return true;
  return role === 'customer' ? flow === 'take' : flow === 'give';
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

export function DueEntrySheet({ open, initialPartyId, defaultEntryType, editDue, onClose }: DueEntrySheetProps) {
  const { data, actions } = useJomarkhata();
  const initial = fromEntryType(editDue ? entryTypeOfDue(editDue) : defaultEntryType ?? 'customer_collection');
  const [flow, setFlow] = useState<Flow>(initial.flow);
  const [withMoney, setWithMoney] = useState(initial.withMoney);
  const [partyId, setPartyId] = useState(() => editDue?.partyId ?? initialPartyId ?? '');
  const [amountRaw, setAmountRaw] = useState(() => (editDue ? String(editDue.amount) : ''));
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(() => editDue?.paymentMethod ?? 'cash');
  const [note, setNote] = useState(() => editDue?.note ?? '');
  const [dateValue, setDateValue] = useState(() => toDateInputValue(editDue?.date ?? new Date().toISOString()));
  const [editReason, setEditReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const party = useMemo(() => data?.parties.find((p) => p.id === partyId) ?? null, [data?.parties, partyId]);
  const fromPartyScreen = !!initialPartyId && !editDue;
  const preferredRole: PartyRole | undefined =
    defaultEntryType === 'supplier_payment' ? 'supplier' : defaultEntryType === 'customer_collection' ? 'customer' : undefined;

  const entryType = toEntryType(flow, withMoney);
  const amount = Math.round(Math.max(0, parseNumericInput(amountRaw)));
  const delta = flow === 'give' ? amount : -amount;
  const baseBalance = party ? party.balance - (editDue ? (editDue.direction === 'given' ? editDue.amount : -editDue.amount) : 0) : 0;
  const after = baseBalance + delta;

  const chooseFlow = (f: Flow) => {
    setFlow(f);
    setWithMoney(defaultWithMoney(f, party?.role));
  };
  const choosePartyId = (id: string) => {
    setPartyId(id);
    const p = data?.parties.find((x) => x.id === id);
    if (p && !fromPartyScreen && !defaultEntryType) setWithMoney(defaultWithMoney(flow, p.role));
  };

  const name = party?.name ?? 'পার্টি';
  const explanation =
    flow === 'take'
      ? withMoney
        ? `${name}-এর কাছ থেকে টাকা নিচ্ছেন`
        : `${name}-এর কাছ থেকে বাকিতে নিচ্ছেন (টাকা দেননি)`
      : withMoney
        ? `${name}-কে টাকা দিচ্ছেন`
        : `${name}-কে বাকিতে দিচ্ছেন (টাকা নেননি)`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!partyId) return setFormError('কাস্টমার বা সাপ্লায়ার বাছুন।');
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

  const title = editDue ? 'বাকি লেনদেন সংশোধন' : party ? `${party.name} — বাকির হিসাব` : 'বাকির হিসাব';

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={title}
      subtitle={party ? `এখন: ${balanceText(party.balance)}` : 'আগে কাস্টমার বা সাপ্লায়ার বাছুন'}
      footer={
        <button
          type="submit"
          form="due-entry-form"
          disabled={isSubmitting || amount <= 0 || !partyId}
          className={`flex h-12 w-full items-center justify-center rounded-2xl text-base font-bold shadow-sm transition-colors disabled:opacity-50 ${
            flow === 'give'
              ? 'bg-danger text-white hover:bg-danger-hover'
              : 'bg-primary-gradient text-on-primary hover:brightness-[0.97]'
          }`}
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে…' : flow === 'give' ? 'দিচ্ছি — নিশ্চিত করুন' : 'নিচ্ছি — নিশ্চিত করুন'}
        </button>
      }
    >
      <form id="due-entry-form" onSubmit={handleSubmit} className="space-y-4">
        {!fromPartyScreen && (
          <PartyPicker
            label="কাস্টমার / সাপ্লায়ার *"
            value={partyId}
            onChange={choosePartyId}
            role={party?.role ?? preferredRole}
            disabled={!!editDue}
            invalid={!!formError && !partyId}
          />
        )}

        {partyId && (
          <>
            {!editDue && (
              <div className="space-y-2.5">
                <SegmentedControl
                  aria-label="দিচ্ছি না নিচ্ছি"
                  variant="track"
                  fullWidth
                  value={flow}
                  onValueChange={chooseFlow}
                  activeTone={(v) => (v === 'give' ? 'danger' : 'primary')}
                  options={[
                    { value: 'give', label: 'দিচ্ছি' },
                    { value: 'take', label: 'নিচ্ছি' },
                  ]}
                />
                <SegmentedControl
                  aria-label="টাকা দিয়ে না শুধু বাকিতে"
                  variant="chips"
                  size="sm"
                  fullWidth
                  value={withMoney ? 'money' : 'credit'}
                  onValueChange={(v) => setWithMoney(v === 'money')}
                  options={[
                    { value: 'money', label: 'টাকা দিয়ে' },
                    { value: 'credit', label: 'শুধু বাকিতে' },
                  ]}
                />
              </div>
            )}
            <p className="rounded-2xl bg-surface-muted px-3.5 py-2.5 text-sm font-semibold text-ink">{explanation}</p>
          </>
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
                পুরো বাকি ({formatTaka(Math.abs(party.balance))})
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
            label={flow === 'take' ? 'কোন মাধ্যমে টাকা পেলেন?' : 'কোন মাধ্যমে টাকা দিলেন?'}
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
