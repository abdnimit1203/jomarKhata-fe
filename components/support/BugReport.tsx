'use client';

/**
 * "সমস্যা জানান" (owner, 2026-11-25): a small tab on the right edge of every app screen → one box,
 * one button. Sends who (account if signed in, else guest), where (screen) and the message to the
 * server (POST /reports → admin "রিপোর্ট" tab + Telegram). The owner turns it on/off from the
 * dashboard settings (`bugReportEnabled` in /config).
 *
 * Who is reporting is filled in automatically from this phone (user ID, shop, owner name, mobile),
 * so it works offline and for guests too. Written offline → kept on the phone and sent when the
 * internet comes back.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Bug, Send } from 'lucide-react';
import { ModalSheet } from '@/components/ui/ModalSheet';
import { useJomarkhata } from '@/context/JomarkhataContext';
import { useServerConfig } from '@/lib/serverConfig';
import { useOnline } from '@/hooks/use-online';
import { apiFetch } from '@/lib/api';
import { currentIdToken } from '@/lib/auth-firebase';
import { APP_VERSION } from '@/lib/version';

const OPEN_EVENT = 'jk-open-bug-report';
const QUEUE_KEY = 'jk_report_queue';
export const openBugReport = () => window.dispatchEvent(new Event(OPEN_EVENT));

interface ReportBody {
  message: string;
  page: string;
  appVersion: string;
  shopName: string;
  reporterName: string;
  reporterPhone: string;
  writtenAt: string;
}

function readQueue(): ReportBody[] {
  try {
    return JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? '[]') as ReportBody[];
  } catch {
    return [];
  }
}
function writeQueue(q: ReportBody[]) {
  try {
    if (q.length) window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-10)));
    else window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    /* ignore */
  }
}

async function post(body: ReportBody) {
  const token = await currentIdToken().catch(() => null);
  await apiFetch('/reports', { token: token ?? undefined, body });
}

export function BugReport() {
  const { activeRoute, showToast, data, auth } = useJomarkhata();
  const { bugReportEnabled } = useServerConfig();
  const online = useOnline();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const profile = data?.businessProfile;
  const accountId = auth.status === 'authenticated' ? auth.user.accountId : '';

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  /** Send reports that were written offline. */
  const flush = useCallback(async () => {
    const q = readQueue();
    if (!q.length || !navigator.onLine) return;
    const left: ReportBody[] = [];
    for (const r of q) {
      try {
        await post(r);
      } catch {
        left.push(r);
      }
    }
    writeQueue(left);
  }, []);
  useEffect(() => {
    void flush();
    window.addEventListener('online', flush);
    return () => window.removeEventListener('online', flush);
  }, [flush]);

  const send = async () => {
    const body: ReportBody = {
      message: message.trim(),
      page: `/app · ${activeRoute}`,
      appVersion: APP_VERSION,
      shopName: profile?.shopName ?? '',
      reporterName: profile?.ownerName ?? '',
      reporterPhone: profile?.phone ?? '',
      writtenAt: new Date().toISOString(),
    };
    setBusy(true);
    setError('');
    try {
      if (!online) {
        writeQueue([...readQueue(), body]);
        setMessage('');
        setOpen(false);
        showToast('রিপোর্ট ফোনে রাখা হলো। নেট এলেই নিজে থেকে পাঠানো হবে।', 'info');
        return;
      }
      await post(body);
      setMessage('');
      setOpen(false);
      showToast('ধন্যবাদ! সমস্যাটা আমরা পেয়েছি, দ্রুত ঠিক করব।');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'পাঠানো যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const who = [profile?.ownerName, profile?.phone].filter(Boolean).join(' · ');

  return (
    <>
      {bugReportEnabled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="অ্যাপে সমস্যা জানান"
          title="সমস্যা জানান"
          // phone & tablet: just above the bottom nav bar (h-16 + safe area); desktop (no bottom bar): bottom corner
          className="fixed right-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-30 flex items-center gap-1 rounded-l-2xl bg-tile-orange-fg py-2.5 pr-1.5 pl-2 text-on-primary opacity-80 shadow-card transition-all hover:pr-3 hover:opacity-100 lg:bottom-8 print:hidden"
        >
          <Bug className="h-4 w-4" />
        </button>
      )}
      <ModalSheet open={open} onClose={() => setOpen(false)} title="সমস্যা জানান" subtitle="কোথায় কী কাজ করছে না, এক-দুই লাইনে লিখুন">
        <div className="space-y-3 pb-2">
          {/* who is reporting — filled automatically from this phone */}
          <div className="rounded-2xl bg-canvas px-3.5 py-2.5">
            <p className="text-xs text-ink-muted">পাঠাচ্ছেন</p>
            <p className="text-sm font-bold text-ink">
              {profile?.shopName || 'জমারখাতা'}
              {accountId ? <span className="ml-2 font-mono text-xs font-semibold text-primary-ink">{accountId}</span> : <span className="ml-2 text-xs font-semibold text-ink-muted">(গেস্ট)</span>}
            </p>
            {who && <p className="text-xs text-ink-muted">{who}</p>}
          </div>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="যেমন: বিক্রি সেভ করলে কিছু হয় না"
            className="w-full rounded-2xl border border-border-strong bg-white p-3.5 text-base text-ink focus:border-primary-ink focus:outline-none"
          />
          <p className="text-xs text-ink-muted">আপনার হিসাবের কোনো তথ্য পাঠানো হয় না — শুধু এই লেখা, উপরের পরিচয়, কোন পেজ থেকে আর অ্যাপ ভার্সন।</p>
          {!online && <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning-ink">এখন নেট নেই। পাঠান চাপলে ফোনে রাখা থাকবে, নেট এলেই নিজে থেকে চলে যাবে।</p>}
          {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
          <button
            type="button"
            disabled={busy || message.trim().length < 3}
            onClick={send}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary-gradient text-base font-bold text-on-primary disabled:opacity-50"
          >
            <Send className="h-5 w-5" /> {busy ? 'পাঠানো হচ্ছে…' : online ? 'পাঠিয়ে দিন' : 'ফোনে রাখুন, পরে যাবে'}
          </button>
        </div>
      </ModalSheet>
    </>
  );
}
