"use client";

/**
 * নবায়ন (renew): pick a plan, send money to the shown bKash / Nagad / bank number, submit the TrxID.
 * The request waits for the owner's approval (admin panel); after approval the subscription date
 * updates by itself. Online only — offline it says so (the khata keeps working).
 */
import React, { useEffect, useState } from "react";
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
}
interface Config {
  plans: Plan[];
  paymentNumbers: { bkash: string; nagad: string; bank: string };
}
interface Req {
  _id: string;
  planLabel: string;
  amount: number;
  method: string;
  trxId: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  createdAt: string;
}
const METHOD: Record<string, string> = {
  bkash: "বিকাশ",
  nagad: "নগদ",
  bank: "ব্যাংক",
};
const STATUS: Record<string, { t: string; c: string }> = {
  pending: { t: "দেখা হচ্ছে", c: "bg-warning-soft text-warning-ink" },
  approved: { t: "অনুমোদিত", c: "bg-success-soft text-success" },
  rejected: { t: "বাতিল", c: "bg-danger-soft text-danger" },
};
const dmy = (d: string) => {
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, "0");
  return toBanglaDigits(
    `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`,
  );
};

export function RenewSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const online = useOnline();
  const [cfg, setCfg] = useState<Config | null>(null);
  const [mine, setMine] = useState<Req[]>([]);
  const [plan, setPlan] = useState("");
  const [method, setMethod] = useState<"bkash" | "nagad" | "bank">("bkash");
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
        const token = await currentIdToken();
        const r = token
          ? await apiFetch<{ requests: Req[] }>("/me/payments", { token })
          : { requests: [] };
        if (!alive) return;
        setCfg(c);
        setPlan((p) => p || c.plans[1]?.key || c.plans[0]?.key || "");
        setMine(r.requests);
      } catch (e) {
        if (alive)
          setMsg({
            ok: false,
            t: e instanceof Error ? e.message : "লোড করা যায়নি।",
          });
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
      setMsg({
        ok: true,
        t: "রিকোয়েস্ট পাঠানো হয়েছে। যাচাই হলে মেয়াদ নিজে থেকেই বাড়বে।",
      });
    } catch (e) {
      setMsg({
        ok: false,
        t: e instanceof Error ? e.message : "পাঠানো যায়নি।",
      });
    } finally {
      setBusy(false);
    }
  };

  const chosen = cfg?.plans.find((p) => p.key === plan);
  const number = cfg?.paymentNumbers[method];
  const field =
    "h-11 w-full rounded-xl border border-border-strong bg-white px-3.5 text-base text-ink focus:border-primary-ink focus:outline-none";

  return (
    <ModalSheet
      open={open}
      onClose={onClose}
      title="সাবস্ক্রিপশন নবায়ন"
      subtitle="প্ল্যান বাছুন, টাকা পাঠান, TrxID দিন"
    >
      {!online ? (
        <p className="rounded-2xl bg-warning-soft p-4 text-sm font-semibold text-warning-ink">
          নবায়ন করতে ইন্টারনেট লাগবে। নেট চালু হলে আবার চেষ্টা করুন — আপনার হিসাব এর
          মধ্যে আগের মতোই চলবে।
        </p>
      ) : !cfg ? (
        <p className="py-6 text-center text-sm text-ink-muted">
          {msg ? msg.t : "লোড হচ্ছে…"}
        </p>
      ) : (
        <div className="space-y-4 pb-2">
          <div className="grid grid-cols-1 gap-2">
            {cfg.plans.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPlan(p.key)}
                className={`flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left ${plan === p.key ? "border-primary bg-secondary" : "border-border bg-white"}`}
              >
                <span className="font-bold text-ink">{p.label}</span>
                <span className="font-extrabold text-primary-ink">
                  {formatTaka(p.price)}
                </span>
              </button>
            ))}
          </div>
          <SegmentedControl
            aria-label="কীভাবে টাকা পাঠাবেন"
            variant="track"
            fullWidth
            value={method}
            onValueChange={(v) => setMethod(v as typeof method)}
            options={(["bkash", "nagad", "bank"] as const)
              .filter((m) => cfg.paymentNumbers[m])
              .map((m) => ({ value: m, label: METHOD[m] }))}
          />
          {number ? (
            <p className="rounded-2xl bg-surface-muted p-3 text-sm">
              {chosen && <b>{formatTaka(chosen.price)}</b>} পাঠান এই{" "}
              {METHOD[method]} নম্বরে:{" "}
              <b className="font-mono text-base select-all">{number}</b>
            </p>
          ) : (
            <p className="rounded-2xl bg-warning-soft p-3 text-sm font-semibold text-warning-ink">
              পেমেন্টের নম্বর এখনও দেওয়া হয়নি। সাহায্যের জন্য যোগাযোগ করুন।
            </p>
          )}
          <input
            className={field}
            value={trxId}
            onChange={(e) => setTrxId(e.target.value)}
            placeholder="TrxID (লেনদেন নম্বর)"
            aria-label="TrxID"
            autoCapitalize="characters"
          />
          <input
            className={field}
            value={payer}
            onChange={(e) => setPayer(e.target.value)}
            placeholder="যে নম্বর থেকে পাঠালেন (ঐচ্ছিক)"
            aria-label="যে নম্বর থেকে পাঠালেন"
            inputMode="tel"
          />
          {msg && (
            <p
              className={`rounded-2xl p-3 text-sm font-semibold ${msg.ok ? "bg-success-soft text-ink" : "bg-danger-soft text-danger"}`}
            >
              {msg.t}
            </p>
          )}
          <Button
            size="xl"
            fullWidth
            disabled={busy || !number || trxId.trim().length < 4}
            onClick={submit}
          >
            {busy ? "পাঠানো হচ্ছে…" : "রিকোয়েস্ট পাঠান"}
          </Button>

          {mine.length > 0 && (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs font-semibold text-ink-muted">
                আগের রিকোয়েস্ট
              </p>
              {mine.slice(0, 5).map((r) => (
                <div
                  key={r._id}
                  className="flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2 text-xs"
                >
                  <span>
                    {dmy(r.createdAt)} · {r.planLabel} ·{" "}
                    {formatBanglaNumber(r.amount)} ৳ ·{" "}
                    <span className="font-mono">{r.trxId}</span>
                    {r.status === "rejected" && r.reason && (
                      <span className="block text-danger">{r.reason}</span>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${STATUS[r.status].c}`}
                  >
                    {STATUS[r.status].t}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </ModalSheet>
  );
}
