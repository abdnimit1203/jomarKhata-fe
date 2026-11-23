'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, AlertCircle, Package } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { dateInputToIso, formatBanglaNumber, formatTaka, parseNumericInput, toDateInputValue } from '@/lib/format';
import { DateInput } from '@/components/ui/DateInput';
import type { EntryMode, PaymentChannel, PurchaseLineItem, PurchaseRecord } from '@/types/domain';
import { PartyPicker } from '@/components/ui/PartyPicker';
import { SegmentedControl } from '@/components/ui/segmented';

interface PurchaseFormSheetProps {
  open: boolean;
  editPurchase?: PurchaseRecord | null;
  onClose: () => void;
}

export function PurchaseFormSheet({ open, editPurchase, onClose }: PurchaseFormSheetProps) {
  const { data, actions } = useJomarkhata();
  const [mode, setMode] = useState<EntryMode>(() => editPurchase?.mode ?? 'quick');
  const [quickAmount, setQuickAmount] = useState(() =>
    editPurchase?.mode === 'quick' ? String(editPurchase.total) : ''
  );
  const [quickDescription, setQuickDescription] = useState(() =>
    editPurchase?.mode === 'quick'
      ? editPurchase.description || editPurchase.items[0]?.name || ''
      : ''
  );

  const [productSearch, setProductSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<PurchaseLineItem[]>(() =>
    editPurchase?.mode === 'product' ? editPurchase.items : []
  );

  const [isFullyPaid, setIsFullyPaid] = useState(() =>
    editPurchase ? editPurchase.dueAmount === 0 : true
  );
  const [paidRaw, setPaidRaw] = useState(() =>
    editPurchase ? String(editPurchase.paidAmount) : ''
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(
    () => editPurchase?.paymentMethod ?? 'cash'
  );
  const [partyId, setPartyId] = useState(() => editPurchase?.partyId ?? '');
  const [note, setNote] = useState(() => editPurchase?.note ?? '');
  const [dateValue, setDateValue] = useState(() => toDateInputValue(editPurchase?.date ?? new Date().toISOString()));
  const [editReason, setEditReason] = useState('');
  // Raw text per cart field, so decimals can be typed before they parse.
  const [rawEdits, setRawEdits] = useState<Record<string, string>>({});


  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) => p.isActive && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [data?.products, productSearch]);

  const total = useMemo(() => {
    if (mode === 'quick') return Math.round(Math.max(0, parseNumericInput(quickAmount)));
    return Math.round(selectedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  }, [mode, quickAmount, selectedItems]);

  const paidAmount = isFullyPaid
    ? total
    : Math.min(total, Math.max(0, Math.round(parseNumericInput(paidRaw))));
  const dueAmount = Math.max(0, total - paidAmount);

  /** Typed quantity / edited purchase price for a chosen product (S6). */
  const updateItem = (productId: string | null | undefined, patch: { qty?: number; unitPrice?: number }) => {
    setSelectedItems((prev) =>
      prev.map((i) => {
        if (i.productId !== productId) return i;
        const qty = patch.qty ?? i.qty;
        const unitPrice = patch.unitPrice ?? i.unitPrice;
        return { ...i, qty, unitPrice, lineTotal: Math.round(qty * unitPrice) };
      })
    );
  };

  const handleToggleProduct = (productId: string, delta: number) => {
    setRawEdits((r) => {
      const next = { ...r };
      delete next[`q:${productId}`];
      return next;
    });
    const prod = data?.products.find((p) => p.id === productId);
    if (!prod) return;
    setSelectedItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx === -1) {
        if (delta <= 0) return prev;
        return [
          ...prev,
          {
            productId: prod.id,
            name: prod.name,
            unit: prod.unit,
            qty: delta,
            unitPrice: prod.purchasePrice,
            lineTotal: delta * prod.purchasePrice,
          },
        ];
      }
      const existing = prev[idx];
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) return prev.filter((i) => i.productId !== productId);
      const next = [...prev];
      next[idx] = { ...existing, qty: nextQty, lineTotal: Math.round(nextQty * existing.unitPrice) };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (total <= 0) {
      setFormError('ক্রয়ের মোট টাকা শূন্যের বেশি হতে হবে।');
      return;
    }
    if (dueAmount > 0 && !partyId) {
      setFormError('সাপ্লায়ারের বাকি রাখতে সাপ্লায়ার নির্বাচন বা নতুন যোগ করুন।');
      return;
    }

    const items: PurchaseLineItem[] =
      mode === 'quick'
        ? [
            {
              productId: null,
              name: quickDescription.trim() || 'পাইকারি ক্রয়',
              qty: 1,
              unitPrice: total,
              lineTotal: total,
            },
          ]
        : selectedItems;

    if (items.length === 0) {
      setFormError('অন্তত একটি পণ্য নির্বাচন করুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        mode,
        partyId: partyId || null,
        description: mode === 'quick' ? quickDescription.trim() || undefined : undefined,
        items,
        paidAmount,
        paymentMethod,
        note: note.trim() || undefined,
        date: dateInputToIso(dateValue, editPurchase?.date),
      };
      if (editPurchase) {
        await actions.editPurchase(editPurchase.id, payload, editReason);
      } else {
        await actions.createPurchase(payload);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'ক্রয় সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editPurchase ? `ক্রয় সংশোধন (${editPurchase.billNo})` : 'নতুন ক্রয় (কেনা)'}
      subtitle="সরাসরি মালামাল কেনা অথবা স্টকে পণ্য যোগ করুন"
      footer={
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">মোট ক্রয়</span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-lg font-bold text-ink">{formatTaka(total)}</span>
              {dueAmount > 0 && (
                <span className="text-xs font-semibold text-primary-ink">
                  দিবো {formatTaka(dueAmount)}
                </span>
              )}
            </div>
          </div>
          <button
            type="submit"
            form="purchase-form"
            disabled={isSubmitting || total <= 0}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-semibold text-on-primary shadow-sm transition-colors hover:brightness-[0.97] disabled:opacity-50"
          >
            {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : editPurchase ? 'সংশোধন সংরক্ষণ করুন' : 'ক্রয় সংরক্ষণ করুন'}
          </button>
        </div>
      }
    >
      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4">
        <SegmentedControl
          aria-label="কেনার ধরন"
          variant="track"
          fullWidth={true}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'quick', label: 'সহজ কেনা' },
            { value: 'product', label: 'স্টকে পণ্য কেনা' },
          ]}
        />

        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {mode === 'quick' ? (
          <div className="space-y-3 rounded-2xl bg-canvas p-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-ink-muted">মোট কেনার টাকা *</label>
              <NumericInput
                value={quickAmount}
                onChange={(raw) => setQuickAmount(raw)}
                placeholder="যেমন: ৫,০০০"
                inputSize="lg"
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-ink-muted">কী কিনলেন (ঐচ্ছিক)</label>
              <input
                type="text"
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                placeholder="যেমন: পাইকারি বাজারের মালামাল"
                className="h-11 w-full rounded-xl border border-border-strong bg-white px-3.5 text-sm text-ink focus:border-primary-ink focus:outline-none"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="পণ্য খুঁজুন..."
                className="h-11 w-full rounded-xl border border-border-strong bg-canvas pr-3.5 pl-10 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl bg-canvas p-5 text-center">
                <Package className="mx-auto h-7 w-7 text-ink-subtle" />
                <p className="mt-2 text-sm font-medium text-ink">কোনো পণ্য নেই</p>
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {filteredProducts.map((prod) => {
                  const chosen = selectedItems.find((i) => i.productId === prod.id);
                  const qty = chosen?.qty ?? 0;
                  return (
                    <div
                      key={prod.id}
                      className={`flex items-center justify-between gap-2 rounded-2xl border p-3 ${
                        qty > 0 ? 'border-primary-ink bg-secondary' : 'border-border bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{prod.name}</p>
                        <p className="text-xs text-ink-muted tabular-nums">
                          ক্রয়দর {formatTaka(prod.purchasePrice)} · বর্তমান স্টক {formatBanglaNumber(prod.stockQty)} {prod.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {qty > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleProduct(prod.id, -1)}
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink shadow-xs"
                            >
                              <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-7 text-center text-sm font-bold tabular-nums text-primary-ink">
                              {formatBanglaNumber(qty)}
                            </span>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleProduct(prod.id, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-on-primary"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {mode === 'product' && selectedItems.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-border bg-white p-3">
            <p className="text-sm font-semibold text-ink-muted">বাছাই করা পণ্য — পরিমাণ ও কেনা দাম বদলানো যায়</p>
            {selectedItems.map((item) => (
              <div key={item.productId ?? item.name} className="grid grid-cols-12 items-end gap-2">
                <p className="col-span-12 truncate text-sm font-semibold text-ink">{item.name}</p>
                <label className="col-span-4 text-xs text-ink-muted">
                  পরিমাণ
                  <NumericInput
                    value={rawEdits[`q:${item.productId}`] ?? String(item.qty)}
                    onChange={(raw, n) => {
                      setRawEdits((r) => ({ ...r, [`q:${item.productId}`]: raw }));
                      updateItem(item.productId, { qty: n });
                    }}
                    suffix={item.unit ?? ''}
                  />
                </label>
                <label className="col-span-4 text-xs text-ink-muted">
                  কেনা দাম (প্রতি)
                  <NumericInput
                    value={rawEdits[`p:${item.productId}`] ?? String(item.unitPrice)}
                    onChange={(raw, n) => {
                      setRawEdits((r) => ({ ...r, [`p:${item.productId}`]: raw }));
                      updateItem(item.productId, { unitPrice: n });
                    }}
                  />
                </label>
                <p className="col-span-4 pb-3 text-right text-sm font-bold tabular-nums text-ink">{formatTaka(item.lineTotal)}</p>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">পরিশোধ</span>
            <SegmentedControl
              aria-label="পরিশোধ"
              variant="track"
              size="sm"
              value={isFullyPaid ? 'paid' : 'due'}
              onValueChange={(v) => {
                setIsFullyPaid(v === 'paid');
                setPaidRaw(v === 'paid' ? String(total) : '0');
              }}
              activeTone={(v) => (v === 'due' ? 'warning' : 'primary')}
              options={[
                { value: 'paid', label: 'পুরোটা পরিশোধ' },
                { value: 'due', label: 'বাকি / আংশিক' },
              ]}
            />
          </div>

          {!isFullyPaid && (
            <div>
              <label className="mb-1 block text-xs text-ink-muted">এখন পরিশোধ করলেন</label>
              <NumericInput value={paidRaw} onChange={(raw) => setPaidRaw(raw)} placeholder="০" />
            </div>
          )}

          {paidAmount > 0 && (
            <PaymentChannelPicker
              label="কোন মাধ্যম থেকে পরিশোধ করলেন?"
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          )}
        </div>

        <div
          className={`space-y-2.5 rounded-2xl border p-4 ${
            dueAmount > 0 && !partyId ? 'border-danger-border bg-danger-soft/60' : 'border-border bg-white'
          }`}
        >
          <PartyPicker
            label={dueAmount > 0 ? 'সাপ্লায়ার (বাকির জন্য বাধ্যতামূলক) *' : 'সাপ্লায়ার (ঐচ্ছিক)'}
            value={partyId}
            onChange={setPartyId}
            role="supplier"
            emptyLabel={dueAmount > 0 ? undefined : 'নগদ সরবরাহকারী'}
            invalid={dueAmount > 0 && !partyId}
          />
        </div>

        {editPurchase && (
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
          <DateInput value={dateValue} onChange={setDateValue} aria-label="কেনার তারিখ" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">নোট (ঐচ্ছিক)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="সংক্ষিপ্ত মন্তব্য"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}
