'use client';

/**
 * /admin/settings: everything the owner changes without env or code (BACKEND_CONTRACT §9.1).
 * Online-only. Guarded: not signed in → /admin/login; not super admin → "no permission".
 */
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { authProvider } from '@/lib/auth-firebase';
import { adminFetch, checkAdmin } from './adminApi';

interface SettingsValue {
  supportWhatsApp: string;
  trialDays: number;
  referralRate: number;
  paymentNumbers: { bkash: string; nagad: string; bank: string };
  telegramChatIds: string[];
}

const input =
  'h-11 w-full rounded-xl border border-border-strong bg-white px-3.5 text-base text-ink focus:border-primary-ink focus:outline-none';

export function AdminSettings() {
  const router = useRouter();
  const [state, setState] = useState<'loading' | 'ok' | 'forbidden' | 'error'>('loading');
  const [s, setS] = useState<SettingsValue | null>(null);
  const [chatIds, setChatIds] = useState('');
  const [botReady, setBotReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await checkAdmin();
        if (!alive) return;
        if (r === 'login') return router.replace('/admin/login');
        if (r === 'forbidden') return setState('forbidden');
        const res = await adminFetch<{ settings: SettingsValue; telegramBotConfigured: boolean }>('/admin/settings');
        if (!alive) return;
        setS(res.settings);
        setChatIds(res.settings.telegramChatIds.join(', '));
        setBotReady(res.telegramBotConfigured);
        setState('ok');
      } catch {
        if (alive) setState('error');
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  if (state === 'loading') return <p className="p-8 text-center text-ink-muted">লোড হচ্ছে…</p>;
  if (state === 'forbidden') return <p className="p-8 text-center font-semibold text-danger">এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।</p>;
  if (state === 'error' || !s)
    return <p className="p-8 text-center font-semibold text-danger">সার্ভারে যোগাযোগ করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।</p>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body = { ...s, telegramChatIds: chatIds.split(',').map((x) => x.trim()).filter(Boolean) };
      const res = await adminFetch<{ settings: SettingsValue }>('/admin/settings', { method: 'PUT', body });
      setS(res.settings);
      setMsg({ ok: true, text: 'সংরক্ষণ হয়েছে। অ্যাপে কয়েক মিনিটের মধ্যে বদলাবে।' });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'সংরক্ষণ করা যায়নি।' });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, el: React.ReactNode, hint?: string) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {el}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">অ্যাডমিন · সেটিংস</h1>
        <button
          type="button"
          onClick={async () => {
            await authProvider.signOut().catch(() => {});
            router.replace('/admin/login');
          }}
          className="rounded-xl border border-border-strong px-3 py-2 text-sm font-bold"
        >
          লগআউট
        </button>
      </div>

      <form onSubmit={save} className="space-y-5">
        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-bold">সাহায্য ও পেমেন্ট</h2>
          {field('WhatsApp হেল্পলাইন নম্বর', <input className={input} value={s.supportWhatsApp} onChange={(e) => setS({ ...s, supportWhatsApp: e.target.value })} placeholder="01XXXXXXXXX" />, 'অ্যাপের "সাহায্য দরকার?" বাটনে যাবে।')}
          {field('বিকাশ নম্বর', <input className={input} value={s.paymentNumbers.bkash} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bkash: e.target.value } })} />)}
          {field('নগদ নম্বর', <input className={input} value={s.paymentNumbers.nagad} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, nagad: e.target.value } })} />)}
          {field('ব্যাংক অ্যাকাউন্ট', <input className={input} value={s.paymentNumbers.bank} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bank: e.target.value } })} />)}
        </section>

        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-bold">ট্রায়াল ও রেফারেল</h2>
          {field('নতুন অ্যাকাউন্টের ফ্রি ট্রায়াল (দিন)', <input type="number" min={0} max={365} className={input} value={s.trialDays} onChange={(e) => setS({ ...s, trialDays: Number(e.target.value) })} />, 'শুধু নতুন অ্যাকাউন্টে খাটবে।')}
          {field('রেফারেল কমিশন (%)', <input type="number" min={0} max={100} className={input} value={Math.round(s.referralRate * 100)} onChange={(e) => setS({ ...s, referralRate: Number(e.target.value) / 100 })} />, 'বদলালে শুধু পরের পেমেন্টে খাটবে।')}
        </section>

        <section className="space-y-4 rounded-3xl bg-white p-5 shadow-card">
          <h2 className="font-bold">টেলিগ্রাম অ্যালার্ট</h2>
          <p className={`text-sm font-semibold ${botReady ? 'text-success' : 'text-danger'}`}>
            {botReady ? 'বট চালু আছে (token সার্ভারের .env-এ)।' : 'বট token সেট করা নেই (সার্ভারের .env-এ TELEGRAM_BOT_TOKEN দিন)।'}
          </p>
          {field('কাকে মেসেজ যাবে (chat ID, কমা দিয়ে একাধিক)', <input className={input} value={chatIds} onChange={(e) => setChatIds(e.target.value)} placeholder="123456789" />, '@userinfobot থেকে নিজের ID নিন। বটকে একবার /start পাঠাতে হবে।')}
        </section>

        {msg && <p className={`rounded-2xl p-3 text-sm font-semibold ${msg.ok ? 'bg-success-soft text-ink' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
        <button type="submit" disabled={saving} className="h-12 w-full rounded-2xl bg-primary-gradient text-base font-bold text-on-primary disabled:opacity-60">
          {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
        </button>
      </form>
    </div>
  );
}
