'use client';

import React, { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { NumericInput } from '@/components/ui/NumericInput';
import { useJomarkhata } from '@/context/JomarkhataContext';
import {
  formatBanglaNumber,
  parseNumericInput,
  PRODUCT_CATEGORIES,
  PRODUCT_UNITS,
} from '@/lib/format';
import type { Party, PartyRole, Product } from '@/types/domain';
import { SimpleSelect } from '@/components/ui/select';
import { SegmentedControl } from '@/components/ui/segmented';

export function ProductFormSheet({
  open,
  editProduct,
  onClose,
}: {
  open: boolean;
  editProduct?: Product | null;
  onClose: () => void;
}) {
  const { data, actions } = useJomarkhata();
  const [name, setName] = useState(() => editProduct?.name ?? '');
  const [category, setCategory] = useState<string>(
    () => editProduct?.category ?? PRODUCT_CATEGORIES[0]
  );
  const [unit, setUnit] = useState<string>(() => editProduct?.unit ?? PRODUCT_UNITS[0]);
  const [purchasePrice, setPurchasePrice] = useState(() =>
    editProduct ? String(editProduct.purchasePrice) : ''
  );
  const [sellingPrice, setSellingPrice] = useState(() =>
    editProduct ? String(editProduct.sellingPrice) : ''
  );
  const [stockQty, setStockQty] = useState(() =>
    editProduct ? String(editProduct.stockQty) : '0'
  );
  const [lowStockThreshold, setLowStockThreshold] = useState(() =>
    editProduct
      ? String(editProduct.lowStockThreshold)
      : String(data?.businessProfile.defaultLowStockThreshold ?? 8)
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('পণ্যের নাম লিখুন।');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editProduct) {
        await actions.updateProduct(editProduct.id, {
          name: name.trim(),
          category,
          unit,
          purchasePrice: parseNumericInput(purchasePrice),
          sellingPrice: parseNumericInput(sellingPrice),
          lowStockThreshold: parseNumericInput(lowStockThreshold),
        });
      } else {
        await actions.createProduct({
          name: name.trim(),
          category,
          unit,
          purchasePrice: parseNumericInput(purchasePrice),
          sellingPrice: parseNumericInput(sellingPrice),
          stockQty: parseNumericInput(stockQty),
          lowStockThreshold: parseNumericInput(lowStockThreshold),
        });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editProduct ? 'পণ্যের তথ্য সংশোধন' : 'নতুন পণ্য যোগ করুন'}
      subtitle="প্রোডাক্ট লিস্ট সম্পূর্ণ ঐচ্ছিক — স্টক ও লাভের হিসাব সহজ করে"
      footer={
        <button
          type="submit"
          form="product-form"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-semibold text-on-primary hover:brightness-[0.97] disabled:opacity-50"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'পণ্য সংরক্ষণ করুন'}
        </button>
      }
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-muted">পণ্যের নাম *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="যেমন: মিনিকেট চাল (১ কেজি)"
            autoFocus
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-ink-muted">ক্যাটাগরি</label>
            <SimpleSelect
              value={category}
              onValueChange={setCategory}
              aria-label="ক্যাটাগরি"
              options={PRODUCT_CATEGORIES.map((c) => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-ink-muted">একক (Unit)</label>
            <SimpleSelect
              value={unit}
              onValueChange={setUnit}
              aria-label="একক"
              options={PRODUCT_UNITS.map((u) => ({ value: u, label: u }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-muted">ক্রয়মূল্য</label>
            <NumericInput value={purchasePrice} onChange={(raw) => setPurchasePrice(raw)} placeholder="০" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-muted">বিক্রয়মূল্য</label>
            <NumericInput value={sellingPrice} onChange={(raw) => setSellingPrice(raw)} placeholder="০" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {!editProduct && (
            <div>
              <label className="mb-1 block text-xs text-ink-muted">বর্তমান স্টক</label>
              <NumericInput value={stockQty} onChange={(raw) => setStockQty(raw)} placeholder="০" suffix={unit} />
            </div>
          )}
          <div className={editProduct ? 'col-span-2' : ''}>
            <label className="mb-1 block text-xs text-ink-muted">কম স্টক সতর্কতা সীমা</label>
            <NumericInput
              value={lowStockThreshold}
              onChange={(raw) => setLowStockThreshold(raw)}
              placeholder="৮"
              suffix={unit}
            />
          </div>
        </div>
      </form>
    </ModalSheet>
  );
}

export function StockAdjustSheet({
  open,
  product,
  onClose,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
}) {
  const { actions } = useJomarkhata();
  const [direction, setDirection] = useState<'add' | 'remove'>('add');
  const [qtyRaw, setQtyRaw] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!product) return null;
  const qty = Math.max(0, parseNumericInput(qtyRaw));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (qty <= 0) return;
    setIsSubmitting(true);
    try {
      await actions.adjustProductStock(product.id, direction === 'add' ? qty : -qty, note.trim() || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="স্টক সমন্বয়"
      subtitle={`${product.name} · বর্তমান স্টক ${formatBanglaNumber(product.stockQty)} ${product.unit}`}
      footer={
        <button
          type="submit"
          form="stock-adjust-form"
          disabled={isSubmitting || qty <= 0}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-semibold text-on-primary hover:brightness-[0.97] disabled:opacity-50"
        >
          {isSubmitting ? 'আপডেট হচ্ছে...' : 'স্টক হালনাগাদ করুন'}
        </button>
      }
    >
      <form id="stock-adjust-form" onSubmit={handleSubmit} className="space-y-4">
        <SegmentedControl
          aria-label="স্টক সমন্বয়"
          variant="track"
          fullWidth={true}
          value={direction}
          onValueChange={setDirection}
          activeTone={(v) => (v === 'remove' ? 'danger' : 'primary')}
          options={[
            { value: 'add', label: 'স্টক যোগ করুন (+)' },
            { value: 'remove', label: 'স্টক কমান (-)' },
          ]}
        />

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-muted">পরিমাণ *</label>
          <NumericInput value={qtyRaw} onChange={(raw) => setQtyRaw(raw)} suffix={product.unit} inputSize="lg" autoFocus />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">কারণ (ঐচ্ছিক)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="যেমন: নতুন চালান এসেছে / নষ্ট পণ্য বাদ"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>
      </form>
    </ModalSheet>
  );
}

export function PartyFormSheet({
  open,
  defaultRole = 'customer',
  editParty,
  onClose,
}: {
  open: boolean;
  defaultRole?: PartyRole;
  editParty?: Party | null;
  onClose: () => void;
}) {
  const { actions } = useJomarkhata();
  const [role, setRole] = useState<PartyRole>(() => editParty?.role ?? defaultRole);
  const [name, setName] = useState(() => editParty?.name ?? '');
  const [phone, setPhone] = useState(() => editParty?.phone ?? '');
  const [address, setAddress] = useState(() => editParty?.address ?? '');
  const [openingDue, setOpeningDue] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('নাম লেখা বাধ্যতামূলক।');
      return;
    }
    setIsSubmitting(true);
    try {
      if (editParty) {
        await actions.updateParty(editParty.id, {
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
        });
      } else {
        await actions.createParty({
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          role,
          openingDue: parseNumericInput(openingDue),
        });
      }
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title={editParty ? 'তথ্য সংশোধন' : role === 'customer' ? 'নতুন কাস্টমার যোগ করুন' : 'নতুন সাপ্লায়ার যোগ করুন'}
      footer={
        <button
          type="submit"
          form="party-form"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary-gradient text-base font-semibold text-on-primary hover:brightness-[0.97] disabled:opacity-50"
        >
          {isSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
        </button>
      }
    >
      <form id="party-form" onSubmit={handleSubmit} className="space-y-4">
        {!editParty && (
          <SegmentedControl
            aria-label="ধরন"
            variant="track"
            fullWidth={true}
            value={role}
            onValueChange={setRole}
            options={[
              { value: 'customer', label: 'কাস্টমার' },
              { value: 'supplier', label: 'সাপ্লায়ার' },
            ]}
          />
        )}

        {formError && (
          <div className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-xs font-medium text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-muted">নাম *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={role === 'customer' ? 'কাস্টমারের নাম লিখুন' : 'সাপ্লায়ার বা প্রতিষ্ঠানের নাম'}
            autoFocus
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">মোবাইল নম্বর (ঐচ্ছিক)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="017XXXXXXXX"
            className="h-12 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs text-ink-muted">ঠিকানা (ঐচ্ছিক)</label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="এলাকা বা বাজারের নাম"
            className="h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-ink focus:border-primary-ink focus:bg-white focus:outline-none"
          />
        </div>

        {!editParty && (
          <div>
            <label className="mb-1 block text-xs text-ink-muted">
              {role === 'customer' ? 'আগের বাকি, আপনি পাবেন (ঐচ্ছিক)' : 'আগের বাকি, আপনি দেবেন (ঐচ্ছিক)'}
            </label>
            <NumericInput value={openingDue} onChange={(raw) => setOpeningDue(raw)} placeholder="০" />
          </div>
        )}
      </form>
    </ModalSheet>
  );
}
