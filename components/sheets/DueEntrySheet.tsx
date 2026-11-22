'use client';

import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { formatTaka, parseNumericInput } from '@/lib/format';
import type { DueTransaction, PaymentChannel } from '@/types/domain';
import type { RecordDueEntryInput } from '@/services/jomarkhataService';

interface DueEntrySheetProps {
  open: boolean;
  initialPartyId?: string | null;
  defaultEntryType?: RecordDueEntryInput['entryType'];
  editDue?: DueTransaction | null;
  onClose: () => void;
}

function resolveInitialEntryType(
  editDue: DueTransaction | null | undefined,
  fallback: RecordDueEntryInput['entryType']
): RecordDueEntryInput['entryType'] {
  if (!editDue) return fallback;
  if (editDue.source === 'customer_collection') return 'customer_collection';
  if (editDue.source === 'supplier_payment') return 'supplier_payment';
  return editDue.direction === 'given' ? 'manual_due_given' : 'manual_due_received';
}

export function DueEntrySheet({
  open,
  initialPartyId,
  defaultEntryType = 'customer_collection',
  editDue,
  onClose,
}: DueEntrySheetProps) {
  const { data, actions } = useJomarkhata();
  const [entryType, setEntryType] = useState<RecordDueEntryInput['entryType']>(() =>
    resolveInitialEntryType(editDue, defaultEntryType)
  );
  const [partyId, setPartyId] = useState(() => editDue?.partyId ?? initialPartyId ?? '');
  const [amountRaw, setAmountRaw] = useState(() => (editDue ? String(editDue.amount) : ''));
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(
    () => editDue?.paymentMethod ?? 'cash'
  );
  const [note, setNote] = useState(() => editDue?.note ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parties = useMemo(() => data?.parties ?? [], [data?.parties]);
  const selectedParty = useMemo(
    () => parties.find((p) => p.id === partyId) ?? null,
    [parties, partyId]
  );

  const involvesRealMoney =
    entryType === 'customer_collection' || entryType === 'supplier_payment';
  const amount = Math.round(Math.max(0, parseNumericInput(amountRaw)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!partyId) {
      setFormError('কাস্টমার বা সাপ্লায়ার নির্বাচন করুন।');
      return;
    }
    if (amount <= 0) {
      setFormError('টাকার পরিমাণ লিখুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editDue) {
        await actions.editDueEntry(editDue.id, {
          amount,
          paymentMethod: involvesRealMoney ? paymentMethod : undefined,
          note: note.trim() || undefined,
        });
      } else {
        await actions.recordDueEntry({
          partyId,
          entryType,
          amount,
          paymentMethod: involvesRealMoney ? paymentMethod : undefined,
          note: note.trim() || undefined,
        });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  const sheetTitle = editDue
    ? 'বাকি লেনদেন সংশোধন'
    : entryType === 'customer_collection'
      ? 'বাকি আদায় (নিচ্ছি)'
      : entryType === 'supplier_payment'
        ? 'সাপ্লায়ারকে পরিশোধ (দিচ্ছি)'
        : 'বাকি খাতায় এন্ট্রি';

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={sheetTitle}
      subtitle="সঠিক মাধ্যম বেছে নিন — ক্যাশ ও বাকি অটোমেটিক হালনাগাদ হবে"
      footer={
        <button
          type="submit"
          form="due-entry-form"
          disabled={isSubmitting || amount <= 0 || !partyId}
          className={`flex h-12 w-full items-center justify-center rounded-2xl text-base font-semibold shadow-sm transition-colors disabled:opacity-50 ${
            entryType === 'customer_collection'
              ? 'bg-primary text-on-primary hover:bg-primary-hover'
              : entryType === 'supplier_payment' || entryType === 'manual_due_given'
                ? 'bg-danger text-white hover:bg-danger-hover'
                : 'bg-primary text-on-primary hover:bg-primary-hover'
          }`}
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'নিশ্চিত করুন'}
        </button>
      }
    >
      <form id="due-entry-form" onSubmit={handleSubmit} className="space-y-4">
        {!editDue && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setEntryType('customer_collection')}
              className={`min-h-[48px] rounded-2xl border px-3 py-2 text-xs font-semibold transition-all ${
                entryType === 'customer_collection'
                  ? 'border-primary bg-primary text-on-primary'
                  : 'border-border-strong bg-canvas text-ink'
              }`}
            >
              বাকি আদায় (নিচ্ছি)
            </button>
            <button
              type="button"
              onClick={() => setEntryType('supplier_payment')}
              className={`min-h-[48px] rounded-2xl border px-3 py-2 text-xs font-semibold transition-all ${
                entryType === 'supplier_payment'
                  ? 'border-danger bg-danger text-white'
                  : 'border-border-strong bg-canvas text-ink'
              }`}
            >
              সাপ্লায়ার পরিশোধ (দিচ্ছি)
            </button>
            <button
              type="button"
              onClick={() => setEntryType('manual_due_given')}
              className={`min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-medium transition-all ${
                entryType === 'manual_due_given'
                  ? 'border-danger bg-danger-soft text-danger'
                  : 'border-border bg-white text-ink-muted'
              }`}
            >
              নতুন বাকি দিলাম (ক্যাশ ছাড়া)
            </button>
            <button
              type="button"
              onClick={() => setEntryType('manual_due_received')}
              className={`min-h-[44px] rounded-2xl border px-3 py-2 text-xs font-medium transition-all ${
                entryType === 'manual_due_received'
                  ? 'border-primary-ink bg-secondary text-primary-ink'
                  : 'border-border bg-white text-ink-muted'
              }`}
            >
              সাপ্লায়ার বাকি নিলাম (ক্যাশ ছাড়া)
            </button>
          </div>
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-muted">
            কাস্টমার / সাপ্লায়ার *
          </label>
          <select
            value={partyId}
            disabled={!!editDue}
            onChange={(e) => setPartyId(e.target.value)}
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink focus:border-primary-ink focus:bg-white focus:outline-none disabled:opacity-60"
          >
            <option value="">— নির্বাচন করুন —</option>
            {parties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.role === 'customer' ? 'কাস্টমার' : 'সাপ্লায়ার'}) —{' '}
                {p.balance > 0
                  ? `পাবো ${formatTaka(p.balance)}`
                  : p.balance < 0
                    ? `দিবো ${formatTaka(Math.abs(p.balance))}`
                    : '০ ৳'}
              </option>
            ))}
          </select>
          {selectedParty && selectedParty.balance !== 0 && !editDue && (
            <div className="mt-1.5 flex items-center justify-between text-xs text-ink-muted">
              <span>
                বর্তমান স্থিতি:{' '}
                <strong className={selectedParty.balance > 0 ? 'text-danger' : 'text-primary-ink'}>
                  {selectedParty.balance > 0 ? 'পাবো' : 'দিবো'}{' '}
                  {formatTaka(Math.abs(selectedParty.balance))}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => setAmountRaw(String(Math.abs(selectedParty.balance)))}
                className="font-semibold text-primary-ink hover:underline"
              >
                পুরো বাকি বসান
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-muted">টাকার পরিমাণ *</label>
          <NumericInput
            value={amountRaw}
            onChange={(raw) => setAmountRaw(raw)}
            placeholder="যেমন: ১,০০০"
            inputSize="lg"
            autoFocus
          />
        </div>

        {involvesRealMoney && (
          <PaymentChannelPicker
            label={
              entryType === 'customer_collection'
                ? 'কোন মাধ্যমে টাকা পেলেন?'
                : 'কোন মাধ্যম থেকে পরিশোধ করলেন?'
            }
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        )}

        <div>
          <label className="mb-1 block text-xs text-ink-muted">নোট / বিবরণ (ঐচ্ছিক)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: বিকাশে পাঠিয়েছে / পুরোনো বাকি শোধ"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}
