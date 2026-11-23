'use client';

import React, { useMemo, useState } from 'react';
import { Minus, Plus, Search, AlertCircle, Package } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { PaymentChannelPicker } from '@/components/ui/PaymentChannelPicker';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { dateInputToIso, formatBanglaNumber, formatTaka, parseNumericInput, toDateInputValue } from '@/lib/format';
import { DateInput } from '@/components/ui/DateInput';
import type { EntryMode, PaymentChannel, SaleLineItem, SaleRecord } from '@/types/domain';
import { PartyPicker } from '@/components/ui/PartyPicker';
import { SegmentedControl } from '@/components/ui/segmented';

interface SaleFormSheetProps {
  open: boolean;
  editSale?: SaleRecord | null;
  onClose: () => void;
}

export function SaleFormSheet({ open, editSale, onClose }: SaleFormSheetProps) {
  const { data, actions } = useJomarkhata();
  const initialFirstItem = editSale?.mode === 'quick' ? editSale.items[0] : undefined;
  const initialUseBreakdown = Boolean(initialFirstItem && initialFirstItem.qty > 1);

  const [mode, setMode] = useState<EntryMode>(() => editSale?.mode ?? 'quick');
  const [quickDirectAmount, setQuickDirectAmount] = useState(() =>
    editSale?.mode === 'quick' && !initialUseBreakdown ? String(editSale.subtotal) : ''
  );
  const [useQuickItemBreakdown, setUseQuickItemBreakdown] = useState(initialUseBreakdown);
  const [quickDescription, setQuickDescription] = useState(() =>
    editSale?.mode === 'quick'
      ? editSale.description ||
        (initialFirstItem?.name !== 'সহজ বিক্রি' ? initialFirstItem?.name || '' : '')
      : ''
  );
  const [quickQty, setQuickQty] = useState(() =>
    initialUseBreakdown && initialFirstItem ? String(initialFirstItem.qty) : '1'
  );
  const [quickUnitPrice, setQuickUnitPrice] = useState(() =>
    initialUseBreakdown && initialFirstItem ? String(initialFirstItem.unitPrice) : ''
  );
  const [quickOptionalCost, setQuickOptionalCost] = useState(() =>
    initialFirstItem && typeof initialFirstItem.unitCostSnapshot === 'number'
      ? String(initialFirstItem.unitCostSnapshot)
      : ''
  );

  const [productSearch, setProductSearch] = useState('');
  const [selectedItems, setSelectedItems] = useState<SaleLineItem[]>(() =>
    editSale?.mode === 'product' ? editSale.items : []
  );

  const [discountRaw, setDiscountRaw] = useState(() =>
    editSale && editSale.discount > 0 ? String(editSale.discount) : ''
  );
  const [paidRaw, setPaidRaw] = useState(() => (editSale ? String(editSale.paidAmount) : ''));
  const [isFullyPaid, setIsFullyPaid] = useState(() => (editSale ? editSale.dueAmount === 0 : true));
  const [paymentMethod, setPaymentMethod] = useState<PaymentChannel>(
    () => editSale?.paymentMethod ?? 'cash'
  );
  const [partyId, setPartyId] = useState<string>(() => editSale?.partyId ?? '');
  const [note, setNote] = useState(() => editSale?.note ?? '');
  const [dateValue, setDateValue] = useState(() => toDateInputValue(editSale?.date ?? new Date().toISOString()));
  const [editReason, setEditReason] = useState('');


  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return (data?.products ?? []).filter(
      (p) => p.isActive && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    );
  }, [data?.products, productSearch]);

  const subtotal = useMemo(() => {
    if (mode === 'quick') {
      if (useQuickItemBreakdown) {
        const q = Math.max(0, parseNumericInput(quickQty));
        const rate = Math.max(0, parseNumericInput(quickUnitPrice));
        return Math.round(q * rate);
      }
      return Math.round(Math.max(0, parseNumericInput(quickDirectAmount)));
    }
    return Math.round(selectedItems.reduce((sum, item) => sum + item.lineTotal, 0));
  }, [mode, useQuickItemBreakdown, quickQty, quickUnitPrice, quickDirectAmount, selectedItems]);

  const discount = Math.min(subtotal, Math.max(0, Math.round(parseNumericInput(discountRaw))));
  const total = Math.max(0, subtotal - discount);
  const paidAmount = isFullyPaid
    ? total
    : Math.min(total, Math.max(0, Math.round(parseNumericInput(paidRaw))));
  const dueAmount = Math.max(0, total - paidAmount);

  const handleToggleProduct = (productId: string, delta: number) => {
    setRawEdits((r) => {
      const next = { ...r };
      delete next[`q:${productId}`];
      return next;
    });
    const product = data?.products.find((p) => p.id === productId);
    if (!product) return;

    setSelectedItems((prev) => {
      const idx = prev.findIndex((i) => i.productId === productId);
      if (idx === -1) {
        if (delta <= 0) return prev;
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            qty: delta,
            unitPrice: product.sellingPrice,
            unitCostSnapshot: product.purchasePrice,
            lineTotal: delta * product.sellingPrice,
          },
        ];
      }
      const existing = prev[idx];
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        return prev.filter((i) => i.productId !== productId);
      }
      const next = [...prev];
      next[idx] = {
        ...existing,
        qty: nextQty,
        lineTotal: Math.round(nextQty * existing.unitPrice),
      };
      return next;
    });
  };

  // Raw text per cart field, so decimals like "1." / "0.5" can be typed before they parse.
  const [rawEdits, setRawEdits] = useState<Record<string, string>>({});
  /** Typed quantity / edited unit price for a chosen product (S6). */
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

  // Non-blocking over-stock warning (AP-9 / D33: selling is allowed, stock may go negative).
  const overStock = selectedItems
    .map((i) => {
      const prod = data?.products.find((p) => p.id === i.productId);
      if (!prod) return null;
      const alreadyInThisSale = editSale?.items.find((x) => x.productId === i.productId)?.qty ?? 0;
      const available = prod.stockQty + alreadyInThisSale;
      return i.qty > available ? { name: i.name, available, unit: prod.unit } : null;
    })
    .filter((x): x is { name: string; available: number; unit: string } => x !== null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (total <= 0) {
      setFormError('বিক্রির মোট টাকা শূন্যের বেশি হতে হবে।');
      return;
    }
    if (mode === 'product' && selectedItems.some((i) => !(i.qty > 0))) {
      setFormError('প্রতিটি পণ্যের পরিমাণ শূন্যের বেশি দিন।');
      return;
    }

    if (dueAmount > 0 && !partyId) {
      setFormError('বাকি রাখতে হলে কাস্টমার নির্বাচন করুন অথবা "+ নতুন কাস্টমার" যোগ করুন।');
      return;
    }

    let items: SaleLineItem[] = [];
    if (mode === 'quick') {
      const parsedCost = quickOptionalCost.trim() ? parseNumericInput(quickOptionalCost) : null;
      const qty = useQuickItemBreakdown ? Math.max(1, parseNumericInput(quickQty)) : 1;
      const unitPrice = useQuickItemBreakdown ? parseNumericInput(quickUnitPrice) : subtotal;
      items = [
        {
          productId: null,
          name: quickDescription.trim() || 'সহজ বিক্রি',
          qty,
          unitPrice,
          unitCostSnapshot: parsedCost !== null && parsedCost >= 0 ? parsedCost : null,
          lineTotal: subtotal,
        },
      ];
    } else {
      if (selectedItems.length === 0) {
        setFormError('অন্তত একটি পণ্য নির্বাচন করুন অথবা "সহজ বিক্রি" ব্যবহার করুন।');
        return;
      }
      items = selectedItems;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        mode,
        partyId: partyId || null,
        description: mode === 'quick' ? quickDescription.trim() || undefined : undefined,
        items,
        discount,
        paidAmount,
        paymentMethod,
        note: note.trim() || undefined,
        date: dateInputToIso(dateValue, editSale?.date),
      };
      if (editSale) {
        await actions.editSale(editSale.id, payload, editReason);
      } else {
        await actions.createSale(payload);
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'বিক্রি সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editSale ? `বিক্রি সংশোধন (${editSale.invoiceNo})` : 'নতুন বিক্রি (বেচা)'}
      subtitle="পণ্য ছাড়াই সহজ বিক্রি অথবা স্টক থেকে বিক্রি"
      footer={
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">মোট বিল</span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-lg font-bold text-ink">{formatTaka(total)}</span>
              {dueAmount > 0 && (
                <span className="text-xs font-semibold text-danger">
                  বাকি {formatTaka(dueAmount)}
                </span>
              )}
            </div>
          </div>
          <button
            type="submit"
            form="sale-form"
            disabled={isSubmitting || total <= 0}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-semibold text-on-primary shadow-sm transition-colors hover:brightness-[0.97] active:scale-[0.99] disabled:opacity-50"
          >
            {isSubmitting
              ? 'সংরক্ষণ হচ্ছে...'
              : editSale
                ? 'সংশোধন সংরক্ষণ করুন'
                : 'বিক্রি সংরক্ষণ করুন'}
          </button>
        </div>
      }
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-4">
        <SegmentedControl
          aria-label="বিক্রির ধরন"
          variant="track"
          fullWidth={true}
          value={mode}
          onValueChange={setMode}
          options={[
            { value: 'quick', label: 'সহজ বিক্রি (দ্রুত)' },
            { value: 'product', label: 'পণ্য থেকে বিক্রি' },
          ]}
        />

        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {mode === 'quick' ? (
          <div className="space-y-3.5 rounded-2xl bg-canvas p-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-muted">
                {useQuickItemBreakdown ? 'বিবরণ ও দর অনুযায়ী হিসাব' : 'মোট বিক্রির টাকা *'}
              </label>
              <button
                type="button"
                onClick={() => setUseQuickItemBreakdown((v) => !v)}
                className="text-xs font-semibold text-primary-ink hover:underline"
              >
                {useQuickItemBreakdown ? 'সরাসরি মোট টাকা লিখুন' : '+ পরিমাণ ও দর দিন'}
              </button>
            </div>

            {!useQuickItemBreakdown ? (
              <NumericInput
                value={quickDirectAmount}
                onChange={(raw) => setQuickDirectAmount(raw)}
                placeholder="যেমন: ৫০০"
                inputSize="lg"
                autoFocus
              />
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">পরিমাণ</label>
                  <NumericInput
                    value={quickQty}
                    onChange={(raw) => setQuickQty(raw)}
                    placeholder="১"
                    suffix="টি"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-ink-muted">প্রতিটির দর</label>
                  <NumericInput
                    value={quickUnitPrice}
                    onChange={(raw) => setQuickUnitPrice(raw)}
                    placeholder="০"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs text-ink-muted">কী বিক্রি করলেন (ঐচ্ছিক)</label>
              <input
                type="text"
                value={quickDescription}
                onChange={(e) => setQuickDescription(e.target.value)}
                placeholder="যেমন: চাল-ডাল, চা-বিস্কুট, খুচরা মালামাল"
                className="h-11 w-full rounded-xl border border-border-strong bg-white px-3.5 text-sm text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-ink-muted">
                ক্রয়মূল্য (ঐচ্ছিক — দিলে সঠিক লাভ হিসাব হবে)
              </label>
              <NumericInput
                value={quickOptionalCost}
                onChange={(raw) => setQuickOptionalCost(raw)}
                placeholder="না জানা থাকলে খালি রাখুন"
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
                className="h-11 w-full rounded-xl border border-border-strong bg-canvas pr-3.5 pl-10 text-sm text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:bg-white focus:outline-none"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="rounded-2xl bg-canvas p-5 text-center">
                <Package className="mx-auto h-7 w-7 text-ink-subtle" />
                <p className="mt-2 text-sm font-medium text-ink">কোনো পণ্য পাওয়া যায়নি</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  পণ্য ছাড়াই বিক্রি করতে &quot;সহজ বিক্রি&quot; ট্যাব ব্যবহার করুন।
                </p>
              </div>
            ) : (
              <div className="max-h-56 space-y-2 overflow-y-auto pr-0.5">
                {filteredProducts.map((prod) => {
                  const chosen = selectedItems.find((i) => i.productId === prod.id);
                  const qty = chosen?.qty ?? 0;
                  return (
                    <div
                      key={prod.id}
                      className={`flex items-center justify-between gap-2 rounded-2xl border p-3 transition-colors ${
                        qty > 0
                          ? 'border-primary-ink bg-secondary'
                          : 'border-border bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{prod.name}</p>
                        <p className="text-xs text-ink-muted tabular-nums">
                          {formatTaka(prod.sellingPrice)} · স্টক {formatBanglaNumber(prod.stockQty)} {prod.unit}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {qty > 0 && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleToggleProduct(prod.id, -1)}
                              aria-label="কমান"
                              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-ink shadow-xs active:scale-95"
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
                          aria-label="যোগ করুন"
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-gradient text-on-primary active:scale-95"
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
            <p className="text-sm font-semibold text-ink-muted">বাছাই করা পণ্য — পরিমাণ ও দাম বদলানো যায়</p>
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
                  দাম (প্রতি)
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

        {overStock.length > 0 && (
          <div role="status" className="rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">
            {overStock.map((o) => (
              <p key={o.name}>
                ⚠ {o.name}: স্টকে আছে {formatBanglaNumber(o.available)} {o.unit}। তবুও বিক্রি করা যাবে — স্টক মাইনাসে দেখাবে, পরে কেনা লিখলে ঠিক হয়ে যাবে।
              </p>
            ))}
          </div>
        )}

        <div>
          <label className="mb-1 block text-sm font-semibold text-ink-muted">ছাড় (ঐচ্ছিক)</label>
          <NumericInput value={discountRaw} onChange={(raw) => setDiscountRaw(raw)} placeholder="০" />
          {discount > 0 && (
            <p className="mt-1 text-sm font-semibold text-ink-muted tabular-nums">
              মোট {formatTaka(subtotal)} − ছাড় {formatTaka(discount)} = {formatTaka(total)}
            </p>
          )}
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">টাকা আদায়</span>
            <SegmentedControl
              aria-label="টাকা আদায়"
              variant="track"
              size="sm"
              value={isFullyPaid ? 'paid' : 'due'}
              onValueChange={(v) => {
                setIsFullyPaid(v === 'paid');
                setPaidRaw(v === 'paid' ? String(total) : '0');
              }}
              activeTone={(v) => (v === 'due' ? 'danger' : 'primary')}
              options={[
                { value: 'paid', label: 'পুরোটা জমা' },
                { value: 'due', label: 'বাকি / আংশিক' },
              ]}
            />
          </div>

          {!isFullyPaid && (
            <div>
              <label className="mb-1 block text-xs text-ink-muted">এখন জমা নিলেন</label>
              <NumericInput value={paidRaw} onChange={(raw) => setPaidRaw(raw)} placeholder="০" />
              <p className="mt-1 text-sm font-semibold text-danger tabular-nums">বাকি থাকবে {formatTaka(dueAmount)}</p>
            </div>
          )}

          {paidAmount > 0 && (
            <PaymentChannelPicker
              label="কোন মাধ্যমে টাকা নিলেন?"
              value={paymentMethod}
              onChange={setPaymentMethod}
            />
          )}
        </div>

        <div
          className={`space-y-2.5 rounded-2xl border p-4 ${
            dueAmount > 0 && !partyId
              ? 'border-danger-border bg-danger-soft/60'
              : 'border-border bg-white'
          }`}
        >
          <PartyPicker
            label={dueAmount > 0 ? 'কাস্টমার (বাকির জন্য বাধ্যতামূলক) *' : 'কাস্টমার (ঐচ্ছিক)'}
            value={partyId}
            onChange={setPartyId}
            role="customer"
            emptyLabel={dueAmount > 0 ? undefined : 'নগদ ক্রেতা (নাম ছাড়া)'}
            invalid={dueAmount > 0 && !partyId}
          />

          {dueAmount > 0 && !partyId && (
            <p className="text-xs text-danger">
              বাকি টাকা ({formatTaka(dueAmount)}) অজানা ক্রেতার নামে রাখা যাবে না। অনুগ্রহ করে কাস্টমার নির্বাচন করুন।
            </p>
          )}
        </div>

        {editSale && (
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
          <DateInput value={dateValue} onChange={setDateValue} aria-label="বিক্রির তারিখ" />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">নোট / মন্তব্য (ঐচ্ছিক)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="সংক্ষিপ্ত নোট লিখুন"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}
