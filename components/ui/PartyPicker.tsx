'use client';

import React, { useMemo, useState } from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { cn } from '@/lib/utils';
import { balanceText, partyMatches } from '@/lib/dues';
export { balanceText, partyMatches } from '@/lib/dues';
import type { Party, PartyRole } from '@/types/domain';
import { SegmentedControl } from './segmented';

const MAX_SHOWN = 30; // keeps typing fast with thousands of parties (plan 4.4 / Phase 8)
const ROLE_LABEL: Record<PartyRole, string> = { customer: 'কাস্টমার', supplier: 'সাপ্লায়ার' };




interface PartyPickerProps {
  value: string;
  onChange: (partyId: string) => void;
  label: string;
  /** Preferred role: listed first and preset for a new party. */
  role?: PartyRole;
  /** When set, "no party" is a valid choice shown with this label (e.g. নগদ ক্রেতা). */
  emptyLabel?: string;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Shared searchable party picker (S5, plan 4.4): search by name or mobile, add a new party inline.
 * Used by the due, sale and purchase forms.
 */
export function PartyPicker({ value, onChange, label, role, emptyLabel, disabled, invalid }: PartyPickerProps) {
  const { data, actions, showToast } = useJomarkhata();
  const parties = useMemo(() => data?.parties ?? [], [data?.parties]);
  const selected = parties.find((p) => p.id === value) ?? null;

  const [searching, setSearching] = useState(!value && !emptyLabel);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<PartyRole>(role ?? 'customer');
  const [saving, setSaving] = useState(false);

  const matches = useMemo(() => {
    const list = parties.filter((p) => partyMatches(p, query));
    list.sort((a, b) => {
      if (role && a.role !== b.role) return a.role === role ? -1 : 1;
      const ta = a.lastTransactionAt ? Date.parse(a.lastTransactionAt) : 0;
      const tb = b.lastTransactionAt ? Date.parse(b.lastTransactionAt) : 0;
      return tb - ta;
    });
    return list;
  }, [parties, query, role]);

  const pick = (id: string) => {
    onChange(id);
    setSearching(false);
    setQuery('');
    setAdding(false);
  };

  const create = async () => {
    if (!newName.trim()) return showToast('নাম লিখুন।', 'error');
    setSaving(true);
    try {
      const created = await actions.createParty({ name: newName.trim(), phone: newPhone.trim(), role: newRole });
      pick(created.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'যোগ করা যায়নি।', 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'h-11 w-full rounded-xl border border-border-strong bg-white px-3 text-base text-ink placeholder:text-ink-subtle focus:border-primary-ink focus:outline-none';

  return (
    <div className="space-y-2">
      <span className="block text-sm font-semibold text-ink-muted">{label}</span>

      {!searching ? (
        <div
          className={cn(
            'flex min-h-14 items-center gap-3 rounded-2xl border bg-white px-3 py-2',
            invalid ? 'border-danger-border bg-danger-soft' : 'border-border-strong'
          )}
        >
          {selected ? (
            <>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-base font-bold text-primary-ink">
                {selected.name.trim().charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-semibold text-ink">{selected.name}</span>
                <span className="block truncate text-xs text-ink-muted">
                  {ROLE_LABEL[selected.role]} · {balanceText(selected.balance)}
                </span>
              </span>
            </>
          ) : (
            <span className="min-w-0 flex-1 text-base text-ink-muted">{emptyLabel ?? '— কেউ বাছাই হয়নি —'}</span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={() => setSearching(true)}
              className="shrink-0 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-primary-ink"
            >
              {selected ? 'বদলান' : `${role ? ROLE_LABEL[role] : 'পার্টি'} বাছুন`}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-border-strong bg-white p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="নাম বা মোবাইল দিয়ে খুঁজুন"
              aria-label={`${label} খুঁজুন`}
              className={cn(inputClass, 'pl-9')}
              autoFocus
            />
          </div>

          <div role="listbox" aria-label={label} className="mt-2 max-h-64 overflow-y-auto">
            {emptyLabel && !query && (
              <button
                type="button"
                role="option"
                aria-selected={!value}
                onClick={() => pick('')}
                className="flex min-h-12 w-full items-center rounded-xl px-2.5 text-left text-base text-ink-muted hover:bg-canvas"
              >
                {emptyLabel}
              </button>
            )}
            {matches.slice(0, MAX_SHOWN).map((p) => (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === value}
                onClick={() => pick(p.id)}
                className="flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-canvas"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-ink-muted">
                    {ROLE_LABEL[p.role]}
                    {p.phone ? ` · ${p.phone}` : ''}
                  </span>
                </span>
                <span
                  className={cn(
                    'shrink-0 text-xs font-bold tabular-nums',
                    p.balance > 0 ? 'text-success' : p.balance < 0 ? 'text-danger' : 'text-ink-subtle'
                  )}
                >
                  {balanceText(p.balance)}
                </span>
              </button>
            ))}
            {matches.length > MAX_SHOWN && (
              <p className="px-2.5 py-2 text-xs text-ink-muted">আরও {matches.length - MAX_SHOWN} জন আছে — নাম লিখে খুঁজুন।</p>
            )}
            {matches.length === 0 && <p className="px-2.5 py-3 text-sm text-ink-muted">কাউকে পাওয়া যায়নি।</p>}
          </div>

          {!adding ? (
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdding(true);
                  setNewName(/\d|[০-৯]/.test(query) ? '' : query);
                  setNewPhone(/\d|[০-৯]/.test(query) ? query : '');
                }}
                className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-secondary text-sm font-bold text-primary-ink"
              >
                <UserPlus className="h-4 w-4" /> নতুন {role ? ROLE_LABEL[role] : 'পার্টি'} যোগ করুন
              </button>
              {(selected || emptyLabel) && (
                <button
                  type="button"
                  onClick={() => setSearching(false)}
                  aria-label="খোঁজা বন্ধ করুন"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-ink-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-2 rounded-xl bg-canvas p-2.5">
              {!role && (
                <SegmentedControl
                  aria-label="পার্টির ধরন"
                  variant="track"
                  size="sm"
                  fullWidth
                  value={newRole}
                  onValueChange={setNewRole}
                  options={[
                    { value: 'customer', label: 'কাস্টমার' },
                    { value: 'supplier', label: 'সাপ্লায়ার' },
                  ]}
                />
              )}
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="নাম *"
                aria-label="নতুন পার্টির নাম"
                className={inputClass}
              />
              <input
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="মোবাইল (ঐচ্ছিক)"
                aria-label="নতুন পার্টির মোবাইল"
                inputMode="tel"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  className="h-11 flex-1 rounded-xl bg-surface-muted text-sm font-semibold text-ink-muted"
                >
                  বাতিল
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={create}
                  className="h-11 flex-1 rounded-xl bg-primary-gradient text-sm font-bold text-on-primary"
                >
                  {saving ? 'যোগ হচ্ছে…' : 'যোগ করে বাছুন'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
