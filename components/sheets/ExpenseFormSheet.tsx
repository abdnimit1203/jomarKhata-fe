'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EXPENSE_CATEGORIES, parseNumericInput } from '@/lib/format';
import type { ExpenseRecord, PaymentChannel } from '@/types/domain';

interface ExpenseFormSheetProps {
  open: boolean;
  editExpense?: ExpenseRecord | null;
  onClose: () => void;
}

export function ExpenseFormSheet({ open, editExpense, onClose }: ExpenseFormSheetProps) {
  const { actions } = useJomarkhata();
  const [amountRaw, setAmountRaw] = useState(() => (editExpense ? String(editExpense.amount) : ''));
  const [category, setCategory] = useState<string>(() => editExpense?.category ?? 'চা-নাস্তা');
  const [title, setTitle] = useState(() => editExpense?.title ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(
    () => editExpense?.paymentMethod ?? 'cash'
  );
  const [note, setNote] = useState(() => editExpense?.note ?? '');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amount = Math.round(Math.max(0, parseNumericInput(amountRaw)));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (amount <= 0) {
      setFormError('খরচের পরিমাণ শূন্যের বেশি হতে হবে।');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        category,
        title: title.trim() || category,
        amount,
        paymentMethod,
        note: note.trim() || undefined,
      };
      if (editExpense) {
        await actions.editExpense(editExpense.id, payload);
      } else {
        await actions.createExpense(payload);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'খরচ সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editExpense ? 'খরচ সংশোধন' : 'সহজ খরচ যোগ করুন'}
      subtitle="শুধু টাকার পরিমাণ লিখেই খরচ সংরক্ষণ করতে পারবেন"
      footer={
        <button
          type="submit"
          form="expense-form"
          disabled={isSubmitting || amount <= 0}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-base font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-50"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : editExpense ? 'সংশোধন সংরক্ষণ করুন' : 'খরচ সংরক্ষণ করুন'}
        </button>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-muted">খরচের টাকা *</label>
          <NumericInput
            value={amountRaw}
            onChange={(raw) => setAmountRaw(raw)}
            placeholder="যেমন: ১৫০"
            inputSize="lg"
            autoFocus
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold text-ink-muted">খরচের খাত (এক ট্যাপে বেছে নিন)</label>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`min-h-[40px] rounded-xl border px-3.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-primary bg-primary text-white'
                      : 'border-border-strong bg-canvas text-ink hover:bg-surface-muted'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <PaymentChannelPicker
          label="কোন মাধ্যম থেকে খরচ করলেন?"
          value={paymentMethod}
          onChange={setPaymentMethod}
        />

        <div>
          <label className="mb-1 block text-xs text-ink-muted">বিবরণ / নোট (ঐচ্ছিক)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`যেমন: ${category}`}
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}
