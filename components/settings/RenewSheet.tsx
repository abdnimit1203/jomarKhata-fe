"use client";

/**
 * নবায়ন (renew), three clear steps:
 *   ১ প্ল্যান বাছুন — cards with the price, an optional struck-through "before" price, per-month
 *     price, the saving and a badge ("সবচেয়ে জনপ্রিয়"). All of it comes from the admin settings.
 *   ২ টাকা পাঠান — bKash / Nagad / bank: QR image + number with a copy button + the exact amount.
 *   ৩ TrxID দিন — the request waits for the owner's approval; the date then updates by itself.
 * Online only (says so at the top); the khata keeps working offline.
 */
import React, { useEffect, useState } from "react";
import { Check, Copy, WifiOff, Wifi } from "lucide-react";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { SegmentedControl } from "@/components/ui/segmented";
import { Button } from "@/components/ui/Button";
import { apiFetch } from "@/lib/api";
import { currentIdToken } from "@/lib/auth-firebase";
import { formatBanglaNumber, formatTaka, toBanglaDigits } from "@/lib/format";
import { useOnline } from "@/hooks/use-online";

interface Plan {
  key: string;
  label: string;
  days: number;
  price: number;
  listPrice?: number;
  badge?: string;
}
type Method = "bkash" | "nagad" | "bank";
interface Config {
  plans: Plan[];
  paymentNumbers: Record<Method, string>;
}
interface Req {
  _id: string;
  planLabel: string;
  amount: number;
  method: string;
  trxId: string;
  status: "pending" | "approved" | "rejected" | "revoked";
  reason: string;
  createdAt: string;
}
const METHOD: Record<Method, string> = { bkash: "বিকাশ", nagad: "নগদ", bank: "ব্যাংক" };
const STATUS: Record<string, { t: string; c: string }> = {
  pending: { t: "দেখা হচ্ছে", c: "bg-warning-soft text-warning-ink" },
  approved: { t: "অনুমোদিত", c: "bg-success-soft text-success" },
  rejected: { t: "বাতিল", c: "bg-danger-soft text-danger" },
  revoked: { t: "ফেরত নেওয়া", c: "bg-danger-soft text-danger" },
};
const dmy = (d: string) => {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return toBanglaDigits(`${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`);
};

function Step({ n, title }: { n: string; title: string }) {
  return (
    <p className="flex items-center gap-2 text-sm font-bold text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs text-on-primary">{n}</span>
      {title}
    </p>
  );
}

function PlanCard({ p, selected, onPick }: { p: Plan; selected: boolean; onPick: () => void }) {
  const months = Math.max(1, Math.round(p.days / 30));
  const save = p.listPrice && p.listPrice > p.price ? p.listPrice - p.price : 0;
  const pct = save ? Math.round((save / p.listPrice!) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`relative w-full rounded-2xl border-2 p-4 text-left transition-all ${
        selected ? "border-primary bg-secondary shadow-card" : "border-border bg-white hover:border-border-strong"
      }`}
    >
      {p.badge && (
        <span className="absolute -top-3 right-4 rounded-full bg-primary-gradient px-3 py-0.5 text-xs font-bold text-on-primary shadow-sm">
          {p.badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            selected ? "border-primary bg-primary text-on-primary" : "border-border-strong"
          }`}
        >
          {selected && <Check className="h-4 w-4" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold text-ink">{p.label}</span>
          {months > 1 && (
            <span className="block text-xs text-ink-muted">মাসে মাত্র {formatTaka(Math.round(p.price / months))}</span>
          )}
        </span>
        <span className="text-right">
          {save > 0 && <span className="block text-sm text-ink-subtle line-through">{formatTaka(p.listPrice!)}</span>}
          <span className="block text-2xl font-extrabold text-primary-ink">{formatTaka(p.price)}</span>
        </span>
      </div>
      {save > 0 && (
        <span className="mt-2 inline-block rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
          সাশ্রয় {formatTaka(save)} ({formatBanglaNumber(pct)}%)
        </span>
      )}
    </button>
  );
}

function CopyNumber({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          window.setTimeout(() => setDone(false), 1600);
        } catch {
          /* the number is still visible and selectable */
        }
      }}
      className="flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-bold text-on-primary"
    >
      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {done ? "কপি হয়েছে" : "কপি"}
    </button>
  );
}

export function RenewSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const online = useOnline();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [qr, setQr] = useState<Record<Method, string> | null>(null);
  const [mine, setMine] = useState<Req[]>([]);
  const [plan, setPlan] = useState("");
  const [method, setMethod] = useState<Method>("bkash");
  const [trxId, setTrxId] = useState("");
  const [payer, setPayer] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  useEffect(() => {
    if (!open || !online) return;
    let alive = true;
    (async () => {
      try {
        const c = await apiFetch<Config>("/config");
        if (!alive) return;
        setCfg(c);
        setPlan((p) => p || c.plans[1]?.key || c.plans[0]?.key || "");
        const first = (["bkash", "nagad", "bank"] as Method[]).find((m) => c.paymentNumbers[m]);
        if (first) setMethod((m) => (c.paymentNumbers[m] ? m : first));
        apiFetch<{ paymentQr: Record<Method, string> }>("/config/payment-qr")
          .then((r) => alive && setQr(r.paymentQr))
          .catch(() => {});
        const token = await currentIdToken();
        const r = token ? await apiFetch<{ requests: Req[] }>("/me/payments", { token }) : { requests: [] };
        if (alive) setMine(r.requests);
      } catch (e) {
        if (alive) setMsg({ ok: false, t: e instanceof Error ? e.message : "লোড করা যায়নি।" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, online]);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const token = await currentIdToken();
      if (!token) throw new Error("আবার লগইন করুন।");
      const r = await apiFetch<{ request: Req }>("/me/payments", {
        token,
        body: { plan, method, trxId: trxId.trim(), payerNumber: payer.trim() },
      });
      setMine([r.request, ...mine]);
      setTrxId("");
      setMsg({ ok: true, t: "রিকোয়েস্ট পাঠানো হয়েছে। যাচাই হলে মেয়াদ নিজে থেকেই বাড়বে।" });
    } catch (e) {
      setMsg({ ok: false, t: e instanceof Error ? e.message : "পাঠানো যায়নি।" });
    } finally {
      setBusy(false);
    }
  };

  const chosen = cfg?.plans.find((p) => p.key === plan);
  const methods = cfg ? (["bkash", "nagad", "bank"] as Method[]).filter((m) => cfg.paymentNumbers[m]) : [];
  const number = cfg?.paymentNumbers[method];
  const qrImg = qr?.[method];
  const field =
    "h-12 w-full rounded-xl border border-border-strong bg-white px-3.5 text-base text-ink focus:border-primary-ink focus:outline-none";

  return (
    <ModalSheet open={open} onClose={onClose} title="সাবস্ক্রিপশন নবায়ন" subtitle="৩ ধাপে: প্ল্যান বাছুন → টাকা পাঠান → TrxID দিন">
      <div className="space-y-5 pb-2">
        {/* internet note, always visible */}
        {online ? (
          <p className="flex items-center gap-2 rounded-xl bg-tile-sky-bg px-3 py-2 text-xs font-semibold text-tile-sky-fg">
            <Wifi className="h-4 w-4 shrink-0" /> রিকোয়েস্ট পাঠাতে ইন্টারনেট লাগে। আপনার হিসাব নেট ছাড়াও চলবে।
          </p>
        ) : (
          <p className="flex items-start gap-2 rounded-2xl bg-warning-soft p-4 text-sm font-semibold text-warning-ink">
            <WifiOff className="mt-0.5 h-5 w-5 shrink-0" /> নবায়ন করতে ইন্টারনেট লাগবে। নেট চালু হলে আবার খুলুন — এর মধ্যে আপনার হিসাব আগের মতোই চলবে।
          </p>
        )}

        {online && !cfg && <p className="py-6 text-center text-sm text-ink-muted">{msg ? msg.t : "লোড হচ্ছে…"}</p>}

        {online && cfg && (
          <>
            <section className="space-y-3">
              <Step n="১" title="প্ল্যান বাছুন" />
              <div className="space-y-3 pt-1">
                {cfg.plans.map((p) => (
                  <PlanCard key={p.key} p={p} selected={plan === p.key} onPick={() => setPlan(p.key)} />
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <Step n="২" title="টাকা পাঠান" />
              {methods.length === 0 ? (
                <p className="rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">
                  পেমেন্টের নম্বর এখনও দেওয়া হয়নি। সেটিংস → হেল্পলাইন থেকে যোগাযোগ করুন।
                </p>
              ) : (
                <>
                  {methods.length > 1 && (
                    <SegmentedControl
                      aria-label="কীভাবে টাকা পাঠাবেন"
                      variant="track"
                      fullWidth
                      value={method}
                      onValueChange={(v) => setMethod(v as Method)}
                      options={methods.map((m) => ({ value: m, label: METHOD[m] }))}
                    />
                  )}
                  <div className="space-y-3 rounded-2xl border border-border bg-white p-4 shadow-card">
                    {chosen && (
                      <p className="text-center text-sm text-ink-muted">
                        {METHOD[method]}-এ পাঠান <b className="block text-3xl font-extrabold text-primary-ink">{formatTaka(chosen.price)}</b>
                      </p>
                    )}
                    {qrImg && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={qrImg} alt={`${METHOD[method]} QR`} className="mx-auto h-48 w-48 rounded-xl border border-border bg-white object-contain p-1" />
                    )}
                    <div className="flex items-center gap-2 rounded-xl bg-surface-muted p-2 pl-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs text-ink-muted">{METHOD[method]} নম্বর</span>
                        <span className="block truncate font-mono text-lg font-bold text-ink select-all">{number}</span>
                      </span>
                      {number && <CopyNumber value={number} />}
                    </div>
                    <p className="text-xs leading-relaxed text-ink-muted">
                      {method === "bank"
                        ? "ব্যাংক থেকে টাকা পাঠিয়ে লেনদেনের রেফারেন্স নম্বরটা নিচে লিখুন।"
                        : `${METHOD[method]} অ্যাপে "Send Money" দিয়ে এই নম্বরে টাকা পাঠান। মেসেজে আসা TrxID নিচে লিখুন।`}
                    </p>
                  </div>
                </>
              )}
            </section>

            <section className="space-y-3">
              <Step n="৩" title="TrxID দিন" />
              <input className={field} value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="TrxID (লেনদেন নম্বর)" aria-label="TrxID" autoCapitalize="characters" />
              <input className={field} value={payer} onChange={(e) => setPayer(e.target.value)} placeholder="যে নম্বর থেকে পাঠালেন (ঐচ্ছিক)" aria-label="যে নম্বর থেকে পাঠালেন" inputMode="tel" />
              {msg && (
                <p className={`rounded-2xl p-3 text-sm font-semibold ${msg.ok ? "bg-success-soft text-ink" : "bg-danger-soft text-danger"}`}>{msg.t}</p>
              )}
              <Button size="xl" fullWidth disabled={busy || !number || trxId.trim().length < 4} onClick={submit}>
                {busy ? "পাঠানো হচ্ছে…" : chosen ? `${chosen.label}-এর রিকোয়েস্ট পাঠান` : "রিকোয়েস্ট পাঠান"}
              </Button>
              <p className="text-center text-xs text-ink-muted">যাচাই হলে মেয়াদ নিজে থেকেই বাড়বে।</p>
            </section>

            {mine.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-xs font-semibold text-ink-muted">আগের রিকোয়েস্ট</p>
                {mine.slice(0, 5).map((r) => (
                  <div key={r._id} className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-xs">
                    <span>
                      {dmy(r.createdAt)} · {r.planLabel} · {formatBanglaNumber(r.amount)} ৳ · <span className="font-mono">{r.trxId}</span>
                      {(r.status === "rejected" || r.status === "revoked") && r.reason && <span className="block text-danger">{r.reason}</span>}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 font-bold ${(STATUS[r.status] ?? STATUS.pending).c}`}>{(STATUS[r.status] ?? STATUS.pending).t}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </ModalSheet>
  );
}
