'use client';

/**
 * Sidebar → সেটিংস: everything the owner changes without env or code (BACKEND_CONTRACT §9.1).
 * The shell (AdminShell) already checked super admin.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminFetch } from './adminApi';

interface Plan {
  key: string;
  label: string;
  days: number;
  price: number;
}
interface SettingsValue {
  supportWhatsApp: string;
  trialDays: number;
  referralRate: number;
  paymentNumbers: { bkash: string; nagad: string; bank: string };
  telegramChatIds: string[];
  plans: Plan[];
}

const input =
  'h-10 w-full rounded-xl border border-border-strong bg-white px-3 text-sm text-ink focus:border-primary-ink focus:outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </label>
  );
}

export function AdminSettings() {
  const [s, setS] = useState<SettingsValue | null>(null);
  const [chatIds, setChatIds] = useState('');
  const [botReady, setBotReady] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<{ settings: SettingsValue; telegramBotConfigured: boolean }>('/admin/settings')
      .then((res) => {
        setS(res.settings);
        setChatIds(res.settings.telegramChatIds.join(', '));
        setBotReady(res.telegramBotConfigured);
      })
      .catch((e: unknown) => setErr(e instanceof Error ? e.message : 'লোড করা যায়নি।'));
  }, []);

  if (err) return <p className="text-danger">{err}</p>;
  if (!s) return <p className="text-ink-muted">লোড হচ্ছে…</p>;

  const setPlan = (i: number, patch: Partial<Plan>) => setS({ ...s, plans: s.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const body = { ...s, telegramChatIds: chatIds.split(',').map((x) => x.trim()).filter(Boolean) };
      const res = await adminFetch<{ settings: SettingsValue }>('/admin/settings', { method: 'PUT', body });
      setS(res.settings);
      setMsg({ ok: true, text: 'সংরক্ষণ হয়েছে। অ্যাপে কয়েক মিনিটের মধ্যে বদলাবে।' });
    } catch (error) {
      setMsg({ ok: false, text: error instanceof Error ? error.message : 'সংরক্ষণ করা যায়নি।' });
    } finally {
      setSaving(false);
    }
  };

  const card = 'space-y-4 rounded-2xl border-t-4 border-primary/30 bg-white p-5 shadow-card';
  return (
    <form onSubmit={save} className="max-w-3xl space-y-5">
      <section className={card}>
        <h2 className="font-bold text-tile-indigo-fg">প্ল্যান ও দাম</h2>
        <div className="space-y-2">
          {s.plans.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_7rem_2.5rem] items-center gap-2">
              <input className={input} value={p.label} onChange={(e) => setPlan(i, { label: e.target.value })} aria-label="প্ল্যানের নাম" placeholder="যেমন: ৬ মাস" />
              <input className={input} type="number" min={1} value={p.days} onChange={(e) => setPlan(i, { days: Number(e.target.value) })} aria-label="দিন" />
              <input className={input} type="number" min={0} value={p.price} onChange={(e) => setPlan(i, { price: Number(e.target.value) })} aria-label="দাম (টাকা)" />
              <button type="button" aria-label="মুছুন" disabled={s.plans.length <= 1} onClick={() => setS({ ...s, plans: s.plans.filter((_, j) => j !== i) })} className="flex h-10 items-center justify-center rounded-xl text-danger disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-muted">নাম · দিন · দাম (টাকা)। অ্যাপের ‘নবায়ন’ পাতায় এগুলোই দেখাবে।</p>
          <button type="button" onClick={() => setS({ ...s, plans: [...s.plans, { key: `p${Date.now().toString(36)}`, label: '', days: 30, price: 0 }] })} className="flex items-center gap-1 text-sm font-bold text-primary-ink">
            <Plus className="h-4 w-4" /> প্ল্যান যোগ করুন
          </button>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold text-tile-green-fg">পেমেন্টের নম্বর ও সাহায্য</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="বিকাশ নম্বর">
            <input className={input} value={s.paymentNumbers.bkash} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bkash: e.target.value } })} />
          </Field>
          <Field label="নগদ নম্বর">
            <input className={input} value={s.paymentNumbers.nagad} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, nagad: e.target.value } })} />
          </Field>
          <Field label="ব্যাংক অ্যাকাউন্ট">
            <input className={input} value={s.paymentNumbers.bank} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bank: e.target.value } })} />
          </Field>
          <Field label="WhatsApp হেল্পলাইন" hint='অ্যাপের "সাহায্য দরকার?" বাটনে যাবে।'>
            <input className={input} value={s.supportWhatsApp} onChange={(e) => setS({ ...s, supportWhatsApp: e.target.value })} placeholder="01XXXXXXXXX" />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold text-tile-sky-fg">ট্রায়াল ও রেফারেল</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ফ্রি ট্রায়াল (দিন)" hint="শুধু নতুন অ্যাকাউন্টে খাটবে।">
            <input type="number" min={0} max={365} className={input} value={s.trialDays} onChange={(e) => setS({ ...s, trialDays: Number(e.target.value) })} />
          </Field>
          <Field label="রেফারেল কমিশন (%)" hint="বদলালে শুধু পরের পেমেন্টে খাটবে।">
            <input type="number" min={0} max={100} className={input} value={Math.round(s.referralRate * 100)} onChange={(e) => setS({ ...s, referralRate: Number(e.target.value) / 100 })} />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h2 className="font-bold text-tile-gold-fg">টেলিগ্রাম অ্যালার্ট</h2>
        <p className={`text-sm font-semibold ${botReady ? 'text-success' : 'text-danger'}`}>
          {botReady ? 'বট চালু আছে (token সার্ভারের .env-এ)।' : 'বট token সেট করা নেই (সার্ভারের .env-এ TELEGRAM_BOT_TOKEN দিন)।'}
        </p>
        <Field label="কাকে মেসেজ যাবে (chat ID, কমা দিয়ে একাধিক)" hint="@userinfobot থেকে নিজের ID নিন। বটকে একবার /start পাঠাতে হবে।">
          <input className={input} value={chatIds} onChange={(e) => setChatIds(e.target.value)} placeholder="123456789" />
        </Field>
      </section>

      {msg && <p className={`rounded-xl p-3 text-sm font-semibold ${msg.ok ? 'bg-success-soft text-ink' : 'bg-danger-soft text-danger'}`}>{msg.text}</p>}
      <button type="submit" disabled={saving} className="h-11 w-full rounded-xl bg-primary text-sm font-bold text-on-primary disabled:opacity-60 sm:w-auto sm:px-8">
        {saving ? 'সংরক্ষণ হচ্ছে…' : 'সংরক্ষণ করুন'}
      </button>
    </form>
  );
}
