"use client";

/**
 * "সমস্যা জানান" (owner, 2026-11-25): a small tab on the right edge of every app screen → one box,
 * one button. Sends who (account if signed in, else guest), where (screen) and the message to the
 * server (POST /reports → admin "রিপোর্ট" tab + Telegram). The owner turns it on/off from the
 * dashboard settings (`bugReportEnabled` in /config). Needs internet; says so when offline.
 */
import React, { useEffect, useState } from "react";
import { Bug, Send } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { useJomarkhata } from "@/context/JomarkhataContext";
import { useServerConfig } from "@/lib/serverConfig";
import { useOnline } from "@/hooks/use-online";
import { apiFetch } from "@/lib/api";
import { currentIdToken } from "@/lib/auth-firebase";
import { APP_VERSION } from "@/lib/version";

const OPEN_EVENT = "jk-open-bug-report";
export const openBugReport = () => window.dispatchEvent(new Event(OPEN_EVENT));

export function BugReport() {
  const { activeRoute, showToast } = useJomarkhata();
  const { bugReportEnabled } = useServerConfig();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const token = await currentIdToken().catch(() => null);
      await apiFetch("/reports", {
        token: token ?? undefined,
        body: {
          message: message.trim(),
          page: `/app · ${activeRoute}`,
          appVersion: APP_VERSION,
        },
      });
      setMessage("");
      setOpen(false);
      showToast("ধন্যবাদ! সমস্যাটা আমরা পেয়েছি, দ্রুত ঠিক করব।");
    } catch (e) {
      setError(e instanceof Error ? e.message : "পাঠানো যায়নি।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {bugReportEnabled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="অ্যাপে সমস্যা জানান"
          title="সমস্যা জানান"
          className="fixed top-1/2 right-0 z-30 flex -translate-y-1/2 items-center gap-1 rounded-l-2xl bg-tile-orange-fg py-2.5 pr-1.5 pl-2 text-on-primary opacity-80 shadow-card transition-all hover:pr-3 hover:opacity-100 print:hidden"
        >
          <Bug className="h-4 w-4" />
        </button>
      )}
      <ModalSheet
        open={open}
        onClose={() => setOpen(false)}
        title="সমস্যা জানান"
        subtitle="কোথায় কী কাজ করছে না, এক-দুই লাইনে লিখুন"
      >
        <div className="space-y-3 pb-2">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="যেমন: বিক্রি সেভ করলে কিছু হয় না"
            className="w-full rounded-2xl border border-border-strong bg-white p-3.5 text-base text-ink focus:border-primary-ink focus:outline-none"
          />
          <p className="text-xs text-ink-muted">
            আপনার হিসাবের কোনো তথ্য পাঠানো হয় না — শুধু এই লেখা, কোন পেজ থেকে, আর
            অ্যাপ ভার্সন।
          </p>
          {!online && (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-ink">
              পাঠাতে ইন্টারনেট লাগবে। নেট চালু করে আবার চাপুন।
            </p>
          )}
          {error && (
            <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}
          <button
            type="button"
            disabled={busy || !online || message.trim().length < 3}
            onClick={send}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-base font-bold text-on-primary disabled:opacity-50"
          >
            <Send className="h-5 w-5" /> {busy ? "পাঠানো হচ্ছে…" : "পাঠিয়ে দিন"}
          </button>
        </div>
      </ModalSheet>
    </>
  );
}
