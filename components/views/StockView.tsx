'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Edit3, Package, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { EmptyState } from '@/components/ui/StateBlocks';
import { formatBanglaNumber, formatTaka, PRODUCT_CATEGORIES } from '@/lib/format';

export function StockView() {
  const { data, currentBalances, openSheet } = useJomarkhata();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  const products = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.products
      .filter((p) => {
        if (!p.isActive) return false;
        if (category !== 'all' && p.category !== category) return false;
        if (onlyLowStock && p.stockQty > p.lowStockThreshold) return false;
        if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) {
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, search, category, onlyLowStock]);

  if (!data) return null;

  return (
    <div className="mx-auto max-w-5xl space-y-4 pb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink">স্টকের হিসাব ও প্রোডাক্ট লিস্ট</h1>
          <p className="text-xs text-ink-muted">
            সম্পূর্ণ ঐচ্ছিক মডিউল — চাইলে পণ্য যোগ করে স্টক ও সঠিক লাভের হিসাব রাখুন
          </p>
        </div>
        <button
          type="button"
          onClick={() => openSheet({ type: 'product' })}
          className="inline-flex h-11 items-center gap-1.5 rounded-2xl bg-primary px-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          <span>নতুন পণ্য</span>
        </button>
      </div>

      {/* Stock Summary Strip */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">মোট পণ্য</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-ink">
            {formatBanglaNumber(data.products.filter((p) => p.isActive).length)} টি
          </p>
        </div>
        <div className="rounded-2xl bg-white p-3.5 shadow-card">
          <p className="text-xs text-ink-muted">স্টক মূল্য (ক্রয়দর)</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-primary">
            {formatTaka(currentBalances.totalStockValue)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOnlyLowStock((v) => !v)}
          className={`rounded-2xl p-3.5 text-left shadow-card transition-colors ${
            onlyLowStock ? 'bg-warning-soft ring-1 ring-accent' : 'bg-white'
          }`}
        >
          <p className="text-xs text-warning-ink">কম স্টক</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-accent-ink">
            {formatBanglaNumber(currentBalances.lowStockCount)} টি
          </p>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্যের নাম খুঁজুন..."
            className="h-11 w-full rounded-2xl border border-border-strong bg-white pr-4 pl-11 text-sm text-ink shadow-card focus:border-primary focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            aria-label="ক্যাটাগরি"
            className="h-11 rounded-2xl border border-border-strong bg-white px-3 text-xs font-semibold text-ink-muted shadow-card focus:border-primary focus:outline-none"
          >
            <option value="all">সব ক্যাটাগরি</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setOnlyLowStock((v) => !v)}
            className={`h-11 rounded-2xl border px-3 text-xs font-semibold whitespace-nowrap shadow-card ${
              onlyLowStock
                ? 'border-accent bg-warning-soft text-accent-ink'
                : 'border-border-strong bg-white text-ink-muted'
            }`}
          >
            কম স্টক
          </button>
        </div>
      </div>

      {/* Product Grid/List */}
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="কোনো পণ্য পাওয়া যায়নি"
          description="স্টক ম্যানেজমেন্ট সম্পূর্ণ ঐচ্ছিক। চাইলে নতুন পণ্য যোগ করে স্টক ও ক্রয়মূল্য ট্র্যাক করুন।"
          actionLabel="+ নতুন পণ্য যোগ করুন"
          onAction={() => openSheet({ type: 'product' })}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {products.map((prod) => {
            const isLow = prod.stockQty <= prod.lowStockThreshold;
            return (
              <div
                key={prod.id}
                className="flex flex-col justify-between gap-3 rounded-2xl bg-white p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{prod.name}</p>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {prod.category} · ক্রয় {formatTaka(prod.purchasePrice)} · বিক্রয়{' '}
                      <strong className="text-ink">{formatTaka(prod.sellingPrice)}</strong>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-lg font-bold tabular-nums ${
                        isLow ? 'text-accent-ink' : 'text-primary'
                      }`}
                    >
                      {formatBanglaNumber(prod.stockQty)} {prod.unit}
                    </p>
                    {isLow && (
                      <p className="inline-flex items-center gap-1 text-xs font-semibold text-accent-ink">
                        <AlertTriangle className="h-3 w-3" />
                        <span>কম স্টক</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 border-t border-border pt-2.5">
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'stock_adjust', product: prod })}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary text-xs font-semibold text-primary transition-colors hover:bg-secondary-hover"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>স্টক যোগ / কমান</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openSheet({ type: 'product', editProduct: prod })}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-surface-muted px-3.5 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-muted"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>এডিট</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
