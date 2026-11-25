"use client";

/**
 * One fold-out group in Settings (owner, 2026-11-25: "দোকান সেটিং অন থাকুক, বাকিগুলো ট্যাবের ভিতরে,
 * ক্লিক করলে ওপেন হয়"). Header row: coloured icon, title, one-line hint, chevron. Each group keeps
 * its own tile colour so the page doesn't look the same everywhere.
 */
import React, { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export type GroupTone =
  "blue" | "indigo" | "green" | "purple" | "sky" | "orange" | "gold";

const TONE: Record<GroupTone, { card: string; chip: string }> = {
  blue: { card: "bg-white", chip: "bg-primary-gradient text-on-primary" },
  indigo: { card: "bg-tile-indigo-bg", chip: "bg-white text-tile-indigo-fg" },
  green: { card: "bg-tile-green-bg", chip: "bg-white text-tile-green-fg" },
  purple: { card: "bg-tile-purple-bg", chip: "bg-white text-tile-purple-fg" },
  sky: { card: "bg-tile-sky-bg", chip: "bg-white text-tile-sky-fg" },
  orange: { card: "bg-tile-orange-bg", chip: "bg-white text-tile-orange-fg" },
  gold: { card: "bg-tile-gold-bg", chip: "bg-white text-tile-gold-fg" },
};

export function SettingsGroup({
  title,
  hint,
  icon,
  tone,
  defaultOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ReactNode;
  tone: GroupTone;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const t = TONE[tone];
  return (
    <section className={`rounded-3xl shadow-card ${t.card}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-16 w-full items-center gap-3 rounded-3xl px-4 py-3 text-left"
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${t.chip}`}
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-ink">{title}</span>
          {hint && (
            <span className="block truncate text-xs text-ink-muted">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id={id} className="px-4 pb-4">
          {children}
        </div>
      )}
    </section>
  );
}
