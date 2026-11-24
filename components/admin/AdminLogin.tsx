'use client';

/**
 * /admin/login — the owner's own sign-in, deliberately different from the shop app:
 * dark panel look, sign-in only (no new account, no guest, no referral), online only.
 * Firebase checks the password; then the server must confirm super_admin.
 */
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { useFmtDate, useNum, useTr } from './i18n';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { authProvider, firebaseAuthProvider, loginConfigured } from '@/lib/auth-firebase';
import { checkAdmin } from './adminApi';

export function AdminLogin() {
  const tr = useTr();
  const fd = useFmtDate();
  const num = useNum();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // already signed in as super admin → straight to the dashboard
  useEffect(() => {
    let alive = true;
    checkAdmin()
      .then((r) => alive && r === 'ok' && router.replace('/admin/dashboard'))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router]);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      const r = await checkAdmin();
      if (r === 'ok') return router.replace('/admin/dashboard');
      await authProvider.signOut().catch(() => {});
      setMsg('এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'লগইন করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const field =
    'h-11 w-full rounded-xl border border-slate-700 bg-slate-900 pl-10 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-sky-400 focus:outline-none';

  return (
    <div className="flex min-h-dvh items-center justify-center bg-admin-login px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-admin-card p-7 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-lg font-extrabold text-white">{tr("অ্যাডমিন প্যানেল")}</h1>
            <p className="text-xs text-slate-400">{tr("জমারখাতা · শুধু অনুমোদিত অ্যাকাউন্ট")}</p>
          </div>
        </div>

        {!loginConfigured && <p className="mb-4 rounded-lg bg-amber-500/15 p-3 text-sm text-amber-300">{tr("লগইন সেট করা নেই (Firebase / API env)।")}</p>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => firebaseAuthProvider.signInWithEmail(email, password));
          }}
          className="space-y-3"
        >
          <div className="relative">
            <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="email" autoComplete="username" aria-label={tr("ইমেইল")} placeholder={tr("ইমেইল")} value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input type="password" autoComplete="current-password" aria-label={tr("পাসওয়ার্ড")} placeholder={tr("পাসওয়ার্ড")} value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </div>
          <button type="submit" disabled={busy || !loginConfigured} className="h-11 w-full rounded-xl bg-sky-500 text-sm font-bold text-white hover:bg-sky-400 disabled:opacity-50">
            {busy ? 'যাচাই হচ্ছে…' : 'লগইন'}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="h-px flex-1 bg-slate-800" /> {tr("অথবা")} <span className="h-px flex-1 bg-slate-800" />
        </div>
        <button
          type="button"
          disabled={busy || !loginConfigured}
          onClick={() => void run(() => firebaseAuthProvider.signInWithGoogle())}
          className="h-11 w-full rounded-xl border border-slate-700 text-sm font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
        >
          {tr("Google দিয়ে লগইন")}
        </button>

        {msg && <p className="mt-4 rounded-lg bg-red-500/15 p-3 text-sm font-semibold text-red-300">{msg}</p>}
      </div>
    </div>
  );
}
