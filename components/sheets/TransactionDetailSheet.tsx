'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Ban, Clock, Edit3, ShieldCheck } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useJomarkhata } from '@/context/JomarkhataContext';
import {
  formatBanglaDateTime,
  formatBanglaNumber,
  formatTaka,
  getChannelLabel,
} from '@/lib/format';
import { AUDIT_ACTION_LABEL, diffAudit } from '@/lib/audit-diff';

interface TransactionDetailSheetProps {
  open: boolean;
  sourceType: 'sale' | 'purchase' | 'due_transaction' | 'expense';
  sourceId: string;
  onClose: () => void;
}

export function TransactionDetailSheet({
  open,
  sourceType,
  sourceId,
  onClose,
}: TransactionDetailSheetProps) {
  const { data, actions, openSheet, showToast } = useJomarkhata();
  const self = { type: 'transaction_detail' as const, sourceType, sourceId };
  const [confirmVoidOpen, setConfirmVoidOpen] = useState(false);
  const [isVoiding, setIsVoiding] = useState(false);
  // Per-record cloud state (S9, plan 7.7). Until the backend exists this is always "local".
  const [syncState, setSyncState] = useState<'local' | 'synced' | 'needs_review'>('local');
  useEffect(() => {
    void actions.getRecordSyncState(sourceId).then(setSyncState);
  }, [actions, sourceId, data]);

  const record = useMemo(() => {
    if (!data) return null;
    if (sourceType === 'sale') return data.sales.find((s) => s.id === sourceId) ?? null;
    if (sourceType === 'purchase') return data.purchases.find((p) => p.id === sourceId) ?? null;
    if (sourceType === 'due_transaction') {
      return data.dueTransactions.find((d) => d.id === sourceId) ?? null;
    }
    return data.expenses.find((e) => e.id === sourceId) ?? null;
  }, [data, sourceType, sourceId]);

  const linkedMovement = useMemo(() => {
    if (!data || !record) return null;
    const mmId = 'moneyMovementId' in record ? record.moneyMovementId : null;
    if (!mmId) return null;
    return data.moneyMovements.find((m) => m.id === mmId) ?? null;
  }, [data, record]);

  const audits = useMemo(() => {
    if (!data) return [];
    return data.auditLogs.filter((a) => a.entityId === sourceId);
  }, [data, sourceId]);

  if (!record) return null;

  const isVoided = record.status === 'voided';
  const canEditOrVoid =
    !isVoided &&
    !(
      sourceType === 'due_transaction' &&
      ('source' in record) &&
      (record.source === 'sale' || record.source === 'purchase')
    );

  const handleEdit = () => {
    if (sourceType === 'sale') {
      openSheet({ type: 'sale', editSale: record as NonNullable<typeof data>['sales'][number], returnTo: self });
    } else if (sourceType === 'purchase') {
      openSheet({
        type: 'purchase',
        editPurchase: record as NonNullable<typeof data>['purchases'][number],
        returnTo: self,
      });
    } else if (sourceType === 'due_transaction') {
      openSheet({
        type: 'due',
        editDue: record as NonNullable<typeof data>['dueTransactions'][number],
        returnTo: self,
      });
    } else {
      openSheet({
        type: 'expense',
        editExpense: record as NonNullable<typeof data>['expenses'][number],
        returnTo: self,
      });
    }
  };

  const handleConfirmVoid = async (reason?: string) => {
    setIsVoiding(true);
    try {
      if (sourceType === 'sale') await actions.voidSale(sourceId, reason);
      else if (sourceType === 'purchase') await actions.voidPurchase(sourceId, reason);
      else if (sourceType === 'due_transaction') await actions.voidDueEntry(sourceId, reason);
      else await actions.voidExpense(sourceId, reason);
      setConfirmVoidOpen(false);
      onClose();
    } catch (err) {
      // 6.4: never fail silently; the dialog stays open so the owner can retry.
      showToast(err instanceof Error ? `বাতিল করা যায়নি: ${err.message}` : 'বাতিল করা যায়নি। আবার চেষ্টা করুন।', 'error');
    } finally {
      setIsVoiding(false);
    }
  };

  const partyName =
    sourceType === 'due_transaction'
      ? data?.parties.find((p) => p.id === (record as { partyId: string }).partyId)?.name ?? 'পার্টি'
      : 'partyName' in record
        ? record.partyName
        : undefined;

  return (
    <>
      <ModalSheet
        open={open}
        onClose={onClose}
        title="লেনদেনের বিস্তারিত"
        subtitle={formatBanglaDateTime(record.date)}
        footer={
          canEditOrVoid ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleEdit}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-semibold text-primary-ink transition-colors hover:bg-secondary-hover"
              >
                <Edit3 className="h-4 w-4" />
                <span>সংশোধন করুন</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmVoidOpen(true)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-danger-soft text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              >
                <Ban className="h-4 w-4" />
                <span>বাতিল করুন</span>
              </button>
            </div>
          ) : undefined
        }
      >
        <div className="space-y-4">
          <p
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              syncState === 'needs_review'
                ? 'bg-warning-soft text-warning-ink'
                : syncState === 'synced'
                  ? 'bg-tile-sky-bg text-tile-sky-fg'
                  : 'bg-tile-green-bg text-tile-green-fg'
            }`}
          >
            {syncState === 'needs_review' ? 'যাচাই দরকার' : syncState === 'synced' ? 'ক্লাউডে সংরক্ষিত' : 'ফোনে সংরক্ষিত'}
          </p>
          {isVoided && (
            <div className="rounded-2xl bg-danger-soft p-3.5 text-sm text-danger">
              <p className="font-semibold">এই লেনদেনটি বাতিল (Voided) করা হয়েছে</p>
              {'voidReason' in record && record.voidReason && (
                <p className="mt-0.5 text-xs">কারণ: {record.voidReason}</p>
              )}
              <p className="mt-1 text-xs text-danger">
                ক্যাশ, স্টক ও পার্টি ব্যালেন্স স্বয়ংক্রিয়ভাবে রিভার্স করা হয়েছে।
              </p>
            </div>
          )}

          {/* Main Summary */}
          <div className="rounded-2xl bg-canvas p-4 space-y-2.5">
            {sourceType === 'sale' && 'invoiceNo' in record && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">ইনভয়েস নম্বর</span>
                  <span className="text-sm font-semibold text-ink">{record.invoiceNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">কাস্টমার</span>
                  <span className="text-sm font-semibold text-ink">{record.partyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">মোট বিল</span>
                  <span className={`text-base font-bold tabular-nums ${isVoided ? 'line-through text-ink-subtle' : 'text-ink'}`}>
                    {formatTaka(record.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">আদায় হয়েছে</span>
                  <span className="text-sm font-semibold tabular-nums text-primary-ink">
                    {formatTaka(record.paidAmount)}
                  </span>
                </div>
                {record.dueAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">বাকি</span>
                    <span className="text-sm font-semibold tabular-nums text-danger">
                      {formatTaka(record.dueAmount)}
                    </span>
                  </div>
                )}
                {record.items.length > 0 && (
                  <div className="border-t border-border pt-2.5">
                    <p className="mb-1.5 text-xs font-semibold text-ink-muted">বিবরণ</p>
                    <div className="space-y-1">
                      {record.items.map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs text-ink">
                          <span>
                            {item.name} × {formatBanglaNumber(item.qty)} {item.unit || ''}
                          </span>
                          <span className="font-semibold tabular-nums">{formatTaka(item.lineTotal)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {sourceType === 'purchase' && 'billNo' in record && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">বিল নম্বর</span>
                  <span className="text-sm font-semibold text-ink">{record.billNo}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">সাপ্লায়ার</span>
                  <span className="text-sm font-semibold text-ink">{record.partyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">মোট ক্রয়</span>
                  <span className={`text-base font-bold tabular-nums ${isVoided ? 'line-through text-ink-subtle' : 'text-ink'}`}>
                    {formatTaka(record.total)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">পরিশোধিত</span>
                  <span className="text-sm font-semibold tabular-nums text-primary-ink">
                    {formatTaka(record.paidAmount)}
                  </span>
                </div>
                {record.dueAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">সাপ্লায়ার বাকি</span>
                    <span className="text-sm font-semibold tabular-nums text-danger">
                      {formatTaka(record.dueAmount)}
                    </span>
                  </div>
                )}
              </>
            )}

            {sourceType === 'due_transaction' && 'direction' in record && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">পার্টি</span>
                  <span className="text-sm font-semibold text-ink">{partyName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">ধরন</span>
                  <span className="text-sm font-semibold text-ink">
                    {record.source === 'customer_collection'
                      ? 'টাকা পেলাম (পাওনা আদায়)'
                      : record.source === 'supplier_payment'
                        ? 'টাকা দিলাম (দেনা শোধ)'
                        : record.direction === 'given'
                          ? 'বাকি দেওয়া'
                          : 'বাকি নেওয়া'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">পরিমাণ</span>
                  <span className={`text-base font-bold tabular-nums ${isVoided ? 'line-through text-ink-subtle' : 'text-ink'}`}>
                    {formatTaka(record.amount)}
                  </span>
                </div>
                {record.note && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-muted">নোট</span>
                    <span className="text-xs text-ink">{record.note}</span>
                  </div>
                )}
              </>
            )}

            {sourceType === 'expense' && 'category' in record && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">খরচের বিবরণ</span>
                  <span className="text-sm font-semibold text-ink">{record.title}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">খাত</span>
                  <span className="text-sm text-ink">{record.category}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-muted">টাকার পরিমাণ</span>
                  <span className={`text-base font-bold tabular-nums ${isVoided ? 'line-through text-ink-subtle' : 'text-danger'}`}>
                    {formatTaka(record.amount)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Linked Canonical MoneyMovement */}
          <div className="rounded-2xl border border-border bg-white p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-muted">
              <ShieldCheck className="h-4 w-4 text-primary-ink" />
              <span>ক্যাশ ও পেমেন্ট হিসাব (একক উৎস)</span>
            </div>
            {linkedMovement ? (
              <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
                <span>
                  {getChannelLabel(linkedMovement.channel)} ·{' '}
                  {linkedMovement.direction === 'in' ? 'টাকা জমা' : 'টাকা খরচ/প্রদান'}
                  {linkedMovement.status === 'voided' ? ' (বাতিল)' : ''}
                </span>
                <span className="font-semibold tabular-nums text-ink">
                  {formatTaka(linkedMovement.amount)}
                </span>
              </div>
            ) : (
              <p className="mt-1.5 text-xs text-ink-muted">
                এই লেনদেনে সরাসরি কোনো ক্যাশ বা ডিজিটাল টাকা আদান-প্রদান হয়নি (শুধু বাকি হিসাব)।
              </p>
            )}
          </div>

          {/* Append-only Audit History */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
              <Clock className="h-3.5 w-3.5" />
              <span>পরিবর্তনের ইতিহাস</span>
            </div>
            {audits.length === 0 ? (
              <p className="text-xs text-ink-subtle">কোনো পরিবর্তনের রেকর্ড নেই।</p>
            ) : (
              <div className="space-y-2">
                {audits.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-xl border border-border bg-canvas px-3.5 py-2.5 text-xs"
                  >
                    <p className="font-medium text-ink">
                      <span className="mr-1.5 rounded-md bg-white px-1.5 py-0.5 font-bold text-primary-ink">
                        {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      {log.summary}
                    </p>
                    {log.action === 'edit' && diffAudit(log).length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {diffAudit(log).map((c) => (
                          <li key={c.label} className="text-ink">
                            <span className="font-semibold">{c.label}:</span>{' '}
                            <span className="text-ink-muted line-through">{c.before}</span> → <span className="font-semibold">{c.after}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {log.reason && <p className="mt-0.5 text-warning-ink">কারণ: {log.reason}</p>}
                    <p className="mt-1 text-xs text-ink-subtle">{formatBanglaDateTime(log.timestamp)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalSheet>

      <ConfirmDialog
        open={confirmVoidOpen}
        title="লেনদেনটি বাতিল করবেন?"
        description="বাতিল করলে এর ক্যাশ, বাকি আর স্টক আগের অবস্থায় ফিরে যাবে। লেনদেনটি মুছবে না — “বাতিল” চিহ্ন নিয়ে ইতিহাসে থেকে যাবে।"
        confirmLabel="হ্যাঁ, বাতিল করুন"
        tone="danger"
        showReasonInput
        isSubmitting={isVoiding}
        onCancel={() => setConfirmVoidOpen(false)}
        onConfirm={handleConfirmVoid}
      />
    </>
  );
}
