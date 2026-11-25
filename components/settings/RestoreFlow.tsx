"use client";

import React, { useRef, useState } from "react";
import { CloudDownload, FileUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { downloadCloudBackup } from "@/lib/cloudBackup";
import { useJomarkhata } from "@/context/JomarkhataContext";
import { Button } from "@/components/ui/Button";
import { formatBanglaDateTime, formatBanglaNumber } from "@/lib/format";
import type { BackupPreview } from "@/lib/backup";

const COUNT_LABELS: Array<[string, string]> = [
  ["parties", "পার্টি"],
  ["products", "পণ্য"],
  ["sales", "বিক্রি"],
  ["purchases", "কেনা"],
  ["dueTransactions", "বাকি লেনদেন"],
  ["expenses", "খরচ"],
];

/**
 * Restore from a backup file (S8, plan 9.3): pick file → (password) → validate + preview →
 * explicit confirmation (extra one when it's a different shop) → atomic restore.
 * Used on the welcome screen (new phone) and in settings (replace the current khata).
 */
export function RestoreFlow({
  currentShopName,
  onDone,
}: {
  currentShopName?: string;
  onDone?: () => void;
}) {
  const { actions, auth } = useJomarkhata();
  const signedIn = auth.status === "authenticated";
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [otherShopOk, setOtherShopOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setText(null);
    setPreview(null);
    setNeedsPassword(false);
    setPassword("");
    setError(null);
    setOtherShopOk(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const inspect = async (content: string, pw?: string) => {
    setError(null);
    setBusy(true);
    try {
      setPreview(await actions.inspectBackup(content, pw));
      setNeedsPassword(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ফাইলটি পড়া যায়নি।";
      if (/পাসওয়ার্ড/.test(msg)) setNeedsPassword(true);
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const content = await f.text();
    setText(content);
    setPreview(null);
    await inspect(content);
  };

  /** The latest cloud copy goes through the same preview + confirmation as a file. */
  const fromCloud = async () => {
    setError(null);
    setBusy(true);
    try {
      const content = await downloadCloudBackup();
      setText(content);
      setPreview(null);
      await inspect(content);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ক্লাউড থেকে আনা যায়নি।");
      setBusy(false);
    }
  };

  const differentShop =
    !!preview && !!currentShopName && preview.shopName !== currentShopName;

  const restore = async () => {
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      await actions.restoreBackup(text, password || undefined);
      reset();
      onDone?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ফিরিয়ে আনা যায়নি। আপনার বর্তমান হিসাব অক্ষত আছে।",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={onFile}
        className="hidden"
        aria-label="ব্যাকআপ ফাইল বাছুন"
      />
      {!text && (
        <Button
          variant="tonal"
          fullWidth
          onClick={() => fileRef.current?.click()}
        >
          <FileUp className="h-5 w-5" /> ব্যাকআপ ফাইল বাছুন
        </Button>
      )}
      {!text && signedIn && (
        <Button variant="secondary" fullWidth disabled={busy} onClick={fromCloud}>
          <CloudDownload className="h-5 w-5" /> {busy ? "আনা হচ্ছে…" : "ক্লাউড থেকে আনুন"}
        </Button>
      )}

      {needsPassword && (
        <div className="space-y-2">
          <label
            htmlFor="restore-password"
            className="block text-sm font-semibold text-ink-muted"
          >
            ব্যাকআপের পাসওয়ার্ড
          </label>
          <input
            id="restore-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-2xl border border-border-strong bg-white px-4 text-base text-ink focus:border-primary-ink focus:outline-none"
          />
          <Button
            fullWidth
            disabled={!password || busy}
            onClick={() => text && inspect(text, password)}
          >
            খুলুন
          </Button>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {preview && (
        <div className="space-y-3 rounded-2xl bg-canvas p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-success">
            <ShieldCheck className="h-4 w-4" />
            {preview.checksumVerified
              ? "ফাইল যাচাই হয়েছে — অক্ষত আছে"
              : "ফাইল পড়া গেছে"}
          </p>
          <div>
            <p className="text-lg font-bold text-ink">{preview.shopName}</p>
            {preview.exportedAt && (
              <p className="text-sm text-ink-muted">
                ব্যাকআপ: {formatBanglaDateTime(preview.exportedAt)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            {COUNT_LABELS.map(([k, label]) => (
              <div key={k} className="rounded-xl bg-white p-2">
                <p className="text-base font-bold tabular-nums text-ink">
                  {formatBanglaNumber(preview.counts[k] ?? 0)}
                </p>
                <p className="text-xs text-ink-muted">{label}</p>
              </div>
            ))}
          </div>
          {preview.notes.map((n) => (
            <p key={n} className="text-sm text-warning-ink">
              {n}
            </p>
          ))}
          {currentShopName && (
            <p className="rounded-xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">
              এই ফোনের বর্তমান হিসাবের জায়গায় ব্যাকআপের হিসাব বসবে (দুটো মেশানো হবে
              না)। বর্তমান হিসাবের একটি কপি নিজে থেকেই এই ফোনে রাখা হবে।
            </p>
          )}
          {differentShop && (
            <label className="flex items-start gap-2.5 text-sm font-semibold text-danger">
              <input
                type="checkbox"
                checked={otherShopOk}
                onChange={(e) => setOtherShopOk(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-danger"
              />
              এটি অন্য দোকানের (“{preview.shopName}”) খাতা। আমি বুঝে এটি বসাতে
              চাই।
            </label>
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={reset} disabled={busy}>
              বাতিল
            </Button>
            <Button
              className="flex-1"
              disabled={busy || (differentShop && !otherShopOk)}
              onClick={restore}
            >
              {busy ? "ফিরিয়ে আনা হচ্ছে…" : "এই ব্যাকআপ ফিরিয়ে আনুন"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
