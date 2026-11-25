'use client';

/**
 * Sidebar → সেটিংস. Every box saves ON ITS OWN (only that box's fields are sent), so changing the
 * WhatsApp number never touches prices or trial days. The shell already checked super admin.
 */
import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { adminFetch } from './adminApi';
import { useTr } from './i18n';

interface Plan {
  key: string;
  label: string;
  days: number;
  price: number;
  /** Struck-through "before" price (0 = none). */
  listPrice?: number;
  badge?: string;
}
interface Video {
  title: string;
  url: string;
}
type Method = 'bkash' | 'nagad' | 'bank';
interface SettingsValue {
  supportWhatsApp: string;
  supportEmail: string;
  bugReportEnabled: boolean;
  trialDays: number;
  referralRate: number;
  paymentNumbers: { bkash: string; nagad: string; bank: string };
  paymentQr: { bkash: string; nagad: string; bank: string };
  telegramChatIds: string[];
  plans: Plan[];
  tutorialVideos: Video[];
}

/** QR photo -> small PNG data URL (max 480 px), so it fits in the settings document. */
async function qrToDataUrl(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}
type Box = 'plans' | 'payment' | 'help' | 'trial' | 'telegram' | 'videos';

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
  const tr = useTr();
  const [s, setS] = useState<SettingsValue | null>(null);
  const [chatIds, setChatIds] = useState('');
  const [botReady, setBotReady] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState<Box | null>(null);
  const [msg, setMsg] = useState<Partial<Record<Box, { ok: boolean; text: string }>>>({});

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
  if (!s) return <p className="text-ink-muted">{tr('লোড হচ্ছে…')}</p>;

  /** Save one box: only its fields go to the server. */
  const save = async (box: Box, body: Partial<SettingsValue>) => {
    setSaving(box);
    setMsg((m) => ({ ...m, [box]: undefined }));
    try {
      const res = await adminFetch<{ settings: SettingsValue }>('/admin/settings', { method: 'PUT', body });
      setS(res.settings);
      setMsg((m) => ({ ...m, [box]: { ok: true, text: tr('সংরক্ষণ হয়েছে। অ্যাপে কয়েক মিনিটের মধ্যে বদলাবে।') } }));
    } catch (e) {
      setMsg((m) => ({ ...m, [box]: { ok: false, text: e instanceof Error ? e.message : tr('সংরক্ষণ করা যায়নি।') } }));
    } finally {
      setSaving(null);
    }
  };

  const setPlan = (i: number, patch: Partial<Plan>) => setS({ ...s, plans: s.plans.map((p, j) => (j === i ? { ...p, ...patch } : p)) });

  const footer = (box: Box, body: () => Partial<SettingsValue>) => (
    <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
      <button
        type="button"
        disabled={saving !== null}
        onClick={() => void save(box, body())}
        className="h-9 rounded-xl bg-primary px-5 text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {saving === box ? tr('সংরক্ষণ হচ্ছে…') : tr('সংরক্ষণ করুন')}
      </button>
      {msg[box] && <span className={`text-sm font-semibold ${msg[box]!.ok ? 'text-success' : 'text-danger'}`}>{msg[box]!.text}</span>}
    </div>
  );

  const card = 'space-y-4 rounded-2xl border-t-4 bg-white p-5 shadow-card';
  return (
    <div className="grid max-w-5xl gap-5 xl:grid-cols-2">
      <section className={`${card} border-tile-indigo-fg xl:col-span-2`}>
        <h2 className="font-bold text-tile-indigo-fg">{tr('প্ল্যান ও দাম')}</h2>
        <div className="space-y-2">
          {s.plans.map((p, i) => (
            <div key={i} className="grid grid-cols-[1fr_5rem_6rem_6rem_9rem_2.5rem] items-center gap-2">
              <input className={input} value={p.label} onChange={(e) => setPlan(i, { label: e.target.value })} aria-label={tr('প্ল্যানের নাম')} placeholder={tr('যেমন: ৬ মাস')} />
              <input className={input} type="number" min={1} value={p.days} onChange={(e) => setPlan(i, { days: Number(e.target.value) })} aria-label={tr('দিন')} />
              <input className={input} type="number" min={0} value={p.price} onChange={(e) => setPlan(i, { price: Number(e.target.value) })} aria-label={tr('দাম (টাকা)')} />
              <input className={input} type="number" min={0} value={p.listPrice ?? 0} onChange={(e) => setPlan(i, { listPrice: Number(e.target.value) || undefined })} aria-label={tr('কাটা দাম')} />
              <input className={input} value={p.badge ?? ''} onChange={(e) => setPlan(i, { badge: e.target.value || undefined })} aria-label={tr('ব্যাজ')} placeholder={tr('ব্যাজ (ঐচ্ছিক)')} />
              <button type="button" aria-label={tr('মুছুন')} disabled={s.plans.length <= 1} onClick={() => setS({ ...s, plans: s.plans.filter((_, j) => j !== i) })} className="flex h-10 items-center justify-center rounded-xl text-danger disabled:opacity-30">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-muted">{tr('নাম · দিন · দাম · কাটা দাম · ব্যাজ। কাটা দাম ০ হলে দেখাবে না। ৬ মাস/১ বছরে মাসিক দাম × মাস দিলে সাশ্রয়টা সত্যি থাকে।')}</p>
          <button type="button" onClick={() => setS({ ...s, plans: [...s.plans, { key: `p${Date.now().toString(36)}`, label: '', days: 30, price: 0 }] })} className="flex items-center gap-1 text-sm font-bold text-primary-ink">
            <Plus className="h-4 w-4" /> {tr('প্ল্যান যোগ করুন')}
          </button>
        </div>
        {footer('plans', () => ({ plans: s.plans }))}
      </section>

      <section className={`${card} border-tile-green-fg`}>
        <h2 className="font-bold text-tile-green-fg">{tr('পেমেন্টের নম্বর ও সাহায্য')}</h2>
        <Field label={tr('বিকাশ নম্বর')}>
          <input className={input} value={s.paymentNumbers.bkash} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bkash: e.target.value } })} />
        </Field>
        <Field label={tr('নগদ নম্বর')}>
          <input className={input} value={s.paymentNumbers.nagad} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, nagad: e.target.value } })} />
        </Field>
        <Field label={tr('ব্যাংক অ্যাকাউন্ট')}>
          <input className={input} value={s.paymentNumbers.bank} onChange={(e) => setS({ ...s, paymentNumbers: { ...s.paymentNumbers, bank: e.target.value } })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          {(['bkash', 'nagad', 'bank'] as Method[]).map((m) => (
            <div key={m} className="space-y-1.5 rounded-xl bg-canvas p-2.5 text-center">
              <p className="text-xs font-bold text-ink">{tr({ bkash: 'বিকাশ QR', nagad: 'নগদ QR', bank: 'ব্যাংক QR' }[m])}</p>
              {s.paymentQr[m] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.paymentQr[m]} alt="" className="mx-auto h-24 w-24 rounded-lg bg-white object-contain" />
              ) : (
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border-strong text-xs text-ink-subtle">{tr('নেই')}</div>
              )}
              <label className="block cursor-pointer text-xs font-bold text-primary-ink">
                {tr('ছবি বাছুন')}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setS({ ...s, paymentQr: { ...s.paymentQr, [m]: await qrToDataUrl(f) } });
                  }}
                />
              </label>
              {s.paymentQr[m] && (
                <button type="button" onClick={() => setS({ ...s, paymentQr: { ...s.paymentQr, [m]: '' } })} className="block w-full text-xs text-danger">
                  {tr('মুছুন')}
                </button>
              )}
            </div>
          ))}
        </div>
        {footer('payment', () => ({ paymentNumbers: s.paymentNumbers, paymentQr: s.paymentQr }))}
      </section>

      <section className={`${card} border-tile-orange-fg`}>
        <h2 className="font-bold text-tile-orange-fg">{tr('হেল্পলাইন ও সমস্যা রিপোর্ট')}</h2>
        <Field label={tr('WhatsApp হেল্পলাইন')} hint={tr('অ্যাপের সেটিংস → হেল্পলাইনে দেখাবে। খালি রাখলে বাটন দেখাবে না।')}>
          <input className={input} value={s.supportWhatsApp} onChange={(e) => setS({ ...s, supportWhatsApp: e.target.value })} placeholder="01XXXXXXXXX" />
        </Field>
        <Field label={tr('হেল্পলাইন ইমেইল')} hint={tr('খালি রাখলে ইমেইল বাটন দেখাবে না।')}>
          <input className={input} type="email" value={s.supportEmail} onChange={(e) => setS({ ...s, supportEmail: e.target.value })} placeholder="help@example.com" />
        </Field>
        <label className="flex items-start gap-3 rounded-xl bg-canvas p-3">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-primary" checked={s.bugReportEnabled} onChange={(e) => setS({ ...s, bugReportEnabled: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold text-ink">{tr('অ্যাপে “সমস্যা জানান” বাটন চালু')}</span>
            <span className="block text-xs text-ink-muted">{tr('ডান পাশে ছোট বাটন; রিপোর্ট আসবে বাম মেনুর ‘রিপোর্ট’-এ আর টেলিগ্রামে।')}</span>
          </span>
        </label>
        {footer('help', () => ({ supportWhatsApp: s.supportWhatsApp, supportEmail: s.supportEmail.trim(), bugReportEnabled: s.bugReportEnabled }))}
      </section>

      <section className={`${card} border-tile-purple-fg xl:col-span-2`}>
        <h2 className="font-bold text-tile-purple-fg">{tr('টিউটোরিয়াল ভিডিও (ইউটিউব লিংক)')}</h2>
        <div className="space-y-2">
          {s.tutorialVideos.map((v, i) => (
            <div key={i} className="grid grid-cols-[14rem_1fr_2.5rem] items-center gap-2">
              <input className={input} value={v.title} onChange={(e) => setS({ ...s, tutorialVideos: s.tutorialVideos.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} aria-label={tr('ভিডিওর নাম')} />
              <input className={input} value={v.url} onChange={(e) => setS({ ...s, tutorialVideos: s.tutorialVideos.map((x, j) => (j === i ? { ...x, url: e.target.value.trim() } : x)) })} aria-label={tr('লিংক')} placeholder="https://youtube.com/shorts/…" />
              <button type="button" aria-label={tr('মুছুন')} onClick={() => setS({ ...s, tutorialVideos: s.tutorialVideos.filter((_, j) => j !== i) })} className="flex h-10 items-center justify-center rounded-xl text-danger">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <p className="text-xs text-ink-muted">{tr('ল্যান্ডিং পেজ আর অ্যাপের “ভিডিও দেখে শিখুন”-এ এই ক্রমে দেখাবে। লিংক খালি থাকলে দেখাবে না।')}</p>
          <button type="button" onClick={() => setS({ ...s, tutorialVideos: [...s.tutorialVideos, { title: '', url: '' }] })} className="flex items-center gap-1 text-sm font-bold text-primary-ink">
            <Plus className="h-4 w-4" /> {tr('ভিডিও যোগ করুন')}
          </button>
        </div>
        {footer('videos', () => ({ tutorialVideos: s.tutorialVideos.filter((v) => v.title.trim()) }))}
      </section>

      <div className="space-y-5">
        <section className={`${card} border-tile-sky-fg`}>
          <h2 className="font-bold text-tile-sky-fg">{tr('ট্রায়াল ও রেফারেল')}</h2>
          <Field label={tr('ফ্রি ট্রায়াল (দিন)')} hint={tr('শুধু নতুন অ্যাকাউন্টে খাটবে।')}>
            <input type="number" min={0} max={365} className={input} value={s.trialDays} onChange={(e) => setS({ ...s, trialDays: Number(e.target.value) })} />
          </Field>
          <Field label={tr('রেফারেল কমিশন (%)')} hint={tr('বদলালে শুধু পরের পেমেন্টে খাটবে।')}>
            <input type="number" min={0} max={100} className={input} value={Math.round(s.referralRate * 100)} onChange={(e) => setS({ ...s, referralRate: Number(e.target.value) / 100 })} />
          </Field>
          {footer('trial', () => ({ trialDays: s.trialDays, referralRate: s.referralRate }))}
        </section>

        <section className={`${card} border-tile-gold-fg`}>
          <h2 className="font-bold text-tile-gold-fg">{tr('টেলিগ্রাম অ্যালার্ট')}</h2>
          <p className={`text-sm font-semibold ${botReady ? 'text-success' : 'text-danger'}`}>
            {botReady ? tr('বট চালু আছে (token সার্ভারের .env-এ)।') : tr('বট token সেট করা নেই (সার্ভারের .env-এ TELEGRAM_BOT_TOKEN দিন)।')}
          </p>
          <Field label={tr('কাকে মেসেজ যাবে (chat ID, কমা দিয়ে একাধিক)')} hint={tr('@userinfobot থেকে নিজের ID নিন। বটকে একবার /start পাঠাতে হবে।')}>
            <input className={input} value={chatIds} onChange={(e) => setChatIds(e.target.value)} placeholder="123456789" />
          </Field>
          {footer('telegram', () => ({ telegramChatIds: chatIds.split(',').map((x) => x.trim()).filter(Boolean) }))}
        </section>
      </div>
    </div>
  );
}
