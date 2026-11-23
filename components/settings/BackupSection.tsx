'use client';

import React, { useEffect, useState } from 'react';
import { DatabaseBackup, Download, HardDrive, Trash2 } from 'lucide-react';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { Button } from '@/components/ui/Button';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { downloadTextFile, formatBanglaDateTime, formatBanglaNumber } from '@/lib/format';
import { RestoreFlow } from './RestoreFlow';

export function backupFileName(shopName: string) {
  // \p{M} keeps Bengali vowel signs (কার) and hasanta, so "ব্যাকআপ" stays readable in the file name.
  const safe = shopName.replace(/[^\p{L}\p{M}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'khata';
  return `jomarkhata-${safe}-${new Date().toISOString().slice(0, 10)}.json`;
}

/** S8 settings block: backup (optional password), restore, safety copy, guarded clear khata. */
export function BackupSection() {
  const { data, actions, showToast, mode, storagePersisted } = useJomarkhata();
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [safety, setSafety] = useState<{ reason: string; createdAt: string; json: string } | null>(null);
  const [usePassword, setUsePassword] = useState(false);
  const [password, setPassword] = useState('');
  const [clearOpen, setClearOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void actions.getLastBackupAt().then(setLastBackupAt);
    void actions.getSafetyCopy().then(setSafety);
  }, [actions, data]);

  if (!data) return null;
  const shopName = data.businessProfile.shopName;

  const download = async () => {
    if (usePassword && password.length < 4) return showToast('পাসওয়ার্ড অন্তত ৪ অক্ষরের দিন।', 'error');
    try {
      const json = await actions.exportBackupJson(usePassword ? password : undefined);
      downloadTextFile(backupFileName(shopName), json, 'application/json');
      setLastBackupAt(new Date().toISOString());
      showToast(usePassword ? 'পাসওয়ার্ডসহ ব্যাকআপ ডাউনলোড হয়েছে। পাসওয়ার্ড ভুলবেন না।' : 'ব্যাকআপ ডাউনলোড হয়েছে।');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'ব্যাকআপ নেওয়া যায়নি।', 'error');
    }
  };

  const clear = async () => {
    setBusy(true);
    try {
      await actions.clearKhata();
      setClearOpen(false);
      setTyped('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'খাতা খালি করা যায়নি।', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-primary-ink">
          <DatabaseBackup className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-base font-bold text-ink">ব্যাকআপ ও নিরাপত্তা</h2>
          <p className="text-sm text-ink-muted">
            হিসাব শুধু এই ফোনে আছে। ফোন হারালে বা অ্যাপ মুছলে ব্যাকআপ ফাইল দিয়েই ফেরত আনা যাবে।
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-canvas p-3">
          <p className="text-xs text-ink-muted">শেষ ব্যাকআপ</p>
          <p className="font-bold text-ink">{lastBackupAt ? formatBanglaDateTime(lastBackupAt) : 'এখনও নেওয়া হয়নি'}</p>
        </div>
        <div className="rounded-2xl bg-canvas p-3">
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <HardDrive className="h-3.5 w-3.5" /> ফোনে স্থায়ী সংরক্ষণ
          </p>
          <p className={`font-bold ${storagePersisted ? 'text-success' : 'text-warning-ink'}`}>
            {storagePersisted === null ? 'জানা যায়নি' : storagePersisted ? 'চালু' : 'চালু হয়নি'}
          </p>
        </div>
      </div>

      {/* Backup */}
      <div className="space-y-2.5 rounded-2xl border border-border p-3.5">
        <label className="flex items-center gap-2.5 text-sm font-semibold text-ink">
          <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} className="h-5 w-5 accent-primary" />
          পাসওয়ার্ড দিয়ে সুরক্ষিত করুন (ঐচ্ছিক)
        </label>
        {usePassword && (
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="পাসওয়ার্ড (মনে রাখবেন, ভুললে ফাইল খোলা যাবে না)"
            aria-label="ব্যাকআপ পাসওয়ার্ড"
            className="h-12 w-full rounded-2xl border border-border-strong bg-white px-4 text-base text-ink focus:border-primary-ink focus:outline-none"
          />
        )}
        <Button fullWidth onClick={download}>
          <Download className="h-5 w-5" /> ব্যাকআপ ডাউনলোড করুন
        </Button>
        <p className="text-xs text-ink-muted">ফাইলে আপনার দোকানের সব হিসাব থাকে — কাউকে পাঠানোর আগে ভাবুন, সম্ভব হলে পাসওয়ার্ড দিন।</p>
      </div>

      {/* Restore (real khata only) */}
      {mode === 'real' && (
        <div className="space-y-2 rounded-2xl border border-border p-3.5">
          <h3 className="text-sm font-bold text-ink">ব্যাকআপ থেকে ফিরিয়ে আনুন</h3>
          <RestoreFlow currentShopName={shopName} />
        </div>
      )}

      {safety && (
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-canvas p-3 text-sm">
          <span className="text-ink-muted">
            নিরাপত্তা-কপি ({safety.reason === 'restore' ? 'রিস্টোরের আগে' : 'খালি করার আগে'}): {formatBanglaDateTime(safety.createdAt)}
          </span>
          <button
            type="button"
            onClick={() => downloadTextFile(`jomarkhata-safety-copy-${safety.createdAt.slice(0, 10)}.json`, safety.json, 'application/json')}
            className="shrink-0 font-bold text-primary-ink"
          >
            ডাউনলোড
          </button>
        </div>
      )}

      {/* Danger zone */}
      {mode === 'real' && (
        <button
          type="button"
          onClick={() => setClearOpen(true)}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-danger-soft text-sm font-bold text-danger"
        >
          <Trash2 className="h-4 w-4" /> খাতা খালি করুন
        </button>
      )}

      {clearOpen && (
        <ModalSheet open onClose={() => setClearOpen(false)} title="খাতা খালি করবেন?" subtitle="সব বিক্রি, কেনা, বাকি, খরচ, পণ্য ও পার্টি মুছে যাবে">
          <div className="space-y-3 pb-2">
            <p className="text-sm text-ink">
              মোট {formatBanglaNumber(data.sales.length)}টি বিক্রি, {formatBanglaNumber(data.parties.length)} জন পার্টি ও{' '}
              {formatBanglaNumber(data.expenses.length)}টি খরচ মুছে যাবে। দোকানের নাম থাকবে।
            </p>
            <Button variant="secondary" fullWidth onClick={download}>
              <Download className="h-5 w-5" /> আগে ব্যাকআপ ডাউনলোড করুন
            </Button>
            <label htmlFor="clear-confirm" className="block text-sm font-semibold text-ink-muted">
              নিশ্চিত করতে লিখুন: <strong className="text-danger">খালি</strong>
            </label>
            <input
              id="clear-confirm"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-12 w-full rounded-2xl border border-border-strong bg-white px-4 text-base text-ink focus:border-danger focus:outline-none"
            />
            <Button variant="danger" fullWidth disabled={typed.trim() !== 'খালি' || busy} onClick={clear}>
              {busy ? 'খালি হচ্ছে…' : 'হ্যাঁ, খাতা খালি করুন'}
            </Button>
          </div>
        </ModalSheet>
      )}
    </section>
  );
}
