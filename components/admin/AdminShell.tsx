'use client';

/**
 * Admin panel frame: left sidebar (desktop) / slide-in menu (phone), content on the right.
 * One super-admin check for every page. Not signed in → /admin/login; not super admin → no access.
 */
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { setAdminLang, useAdminLang, useFmtDate, useNum, useTr } from './i18n';
import { BadgeCheck, Bug, CreditCard, LayoutDashboard, LogOut, Menu, Receipt, Settings, Users } from 'lucide-react';
import { authProvider } from '@/lib/auth-firebase';
import { formatBanglaNumber, toBanglaDigits } from '@/lib/format';
import { adminFetch, checkAdmin } from './adminApi';

const MENU = [
  { href: '/admin/dashboard', label: 'ড্যাশবোর্ড', icon: LayoutDashboard },
  { href: '/admin/payments', label: 'সাবস্ক্রিপশন রিকোয়েস্ট', icon: CreditCard, badge: true },
  { href: '/admin/orders', label: 'সাবস্ক্রিপশন অর্ডার', icon: Receipt },
  { href: '/admin/users', label: 'ইউজার', icon: Users },
  { href: '/admin/reports', label: 'রিপোর্ট', icon: Bug },
  { href: '/admin/settings', label: 'সেটিংস', icon: Settings },
];

/** dd/MM/yyyy in Bangla digits (owner's date rule). */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '—';
  const p = (n: number) => String(n).padStart(2, '0');
  return toBanglaDigits(`${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`);
}

export const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  trial: { text: 'ট্রায়াল', cls: 'bg-tile-sky-bg text-tile-sky-fg' },
  active: { text: 'পেইড', cls: 'bg-success-soft text-success' },
  expired: { text: 'মেয়াদ শেষ', cls: 'bg-danger-soft text-danger' },
  pending: { text: 'অপেক্ষায়', cls: 'bg-warning-soft text-warning-ink' },
  approved: { text: 'অনুমোদিত', cls: 'bg-success-soft text-success' },
  rejected: { text: 'বাতিল', cls: 'bg-danger-soft text-danger' },
  revoked: { text: 'ফেরত নেওয়া', cls: 'bg-danger-soft text-danger' },
  open: { text: 'খোলা', cls: 'bg-warning-soft text-warning-ink' },
  resolved: { text: 'সমাধান হয়েছে', cls: 'bg-success-soft text-success' },
};

export function Pill({ status }: { status: string }) {
  const tr = useTr();
  const fd = useFmtDate();
  const num = useNum();
  const s = STATUS_LABEL[status] ?? { text: status, cls: 'bg-surface-muted text-ink' };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${s.cls}`}>{tr(s.text)}</span>;
}

/** Shared table look for admin lists. */
export const TABLE = 'w-full min-w-[720px] text-left text-sm';
export const TH = 'border-b border-border bg-canvas px-3 py-2.5 text-xs font-bold text-ink-muted';
export const TD = 'border-b border-border px-3 py-2.5 align-top';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const tr = useTr();
  const langNow = useAdminLang();
  const fd = useFmtDate();
  const num = useNum();
  const router = useRouter();
  const path = usePathname() ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    let alive = true;
    checkAdmin()
      .then((r) => {
        if (!alive) return;
        if (r === 'login') router.replace('/admin/login');
        else setState(r === 'ok' ? 'ok' : 'forbidden');
      })
      .catch(() => alive && setState('error'));
    return () => {
      alive = false;
    };
  }, [router]);

  // pending-requests badge, refreshed on every page change
  useEffect(() => {
    if (state !== 'ok') return;
    adminFetch<{ pending: number }>('/admin/payments?status=pending')
      .then((r) => setPending(r.pending))
      .catch(() => {});
  }, [state, path]);

  if (state === 'loading') return <p className="p-10 text-center text-ink-muted">{tr("লোড হচ্ছে…")}</p>;
  if (state === 'forbidden') return <p className="p-10 text-center font-semibold text-danger">{tr("এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।")}</p>;
  if (state === 'error') return <p className="p-10 text-center font-semibold text-danger">{tr("সার্ভারে যোগাযোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।")}</p>;

  const title = tr(MENU.find((m) => path.startsWith(m.href))?.label ?? 'অ্যাডমিন');
  const lang = langNow;
  const nav = (
    <nav className="flex h-full flex-col bg-admin-sidebar text-slate-200">
      <div className="flex items-center gap-2.5 px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-mark.png" alt="" width={34} height={34} className="h-9 w-9 rounded-lg" />
        <div>
          <p className="text-base font-extrabold text-white">{tr("জমারখাতা")}</p>
          <p className="flex items-center gap-1 text-xs text-slate-400">
            <BadgeCheck className="h-3.5 w-3.5 text-sky-400" /> {tr("সুপার অ্যাডমিন")}
          </p>
        </div>
      </div>
      <ul className="flex-1 space-y-1 px-3">
        {MENU.map((m) => {
          const active = path.startsWith(m.href);
          const Icon = m.icon;
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${active ? 'bg-primary text-on-primary' : 'hover:bg-white/10'}`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{tr(m.label)}</span>
                {m.badge && pending > 0 && (
                  <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-extrabold text-slate-900">{num(pending)}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={async () => {
          await authProvider.signOut().catch(() => {});
          router.replace('/admin/login');
        }}
        className="m-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10"
      >
        <LogOut className="h-4 w-4" /> {tr("লগআউট")}
      </button>
      {/* language: admin panel only */}
      <div className="mx-3 mb-4 grid grid-cols-2 gap-1 rounded-xl bg-white/10 p-1 text-xs font-bold">
        {(['bn', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setAdminLang(l)}
            className={`rounded-lg py-1.5 ${lang === l ? 'bg-white text-admin-sidebar' : 'text-slate-300'}`}
          >
            {l === 'bn' ? 'বাংলা' : 'English'}
          </button>
        ))}
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-dvh bg-admin-canvas">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 lg:block">{nav}</aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label={tr("মেনু বন্ধ")} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/50" />
          <aside className="relative h-full w-72">{nav}</aside>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-white px-4">
          <button type="button" aria-label={tr("মেনু")} onClick={() => setOpen(true)} className="rounded-lg p-1.5 lg:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-base font-bold text-ink">{title}</h1>
        </header>
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
