'use client';

// Dev-only helper to preview Bangla fonts live. Remove once a font is chosen.
import { useEffect, useState } from 'react';

const FONTS = [
  { key: 'hind-siliguri', label: 'Hind Siliguri (বর্তমান)' },
  { key: 'noto-sans-bengali', label: 'Noto Sans Bengali' },
  { key: 'anek-bangla', label: 'Anek Bangla' },
  { key: 'baloo-da-2', label: 'Baloo Da 2' },
  { key: 'tiro-bangla', label: 'Tiro Bangla' },
  { key: 'noto-serif-bengali', label: 'Noto Serif Bengali' },
] as const;

const STORAGE_KEY = 'dev-font';

function applyFont(key: string) {
  document.documentElement.style.setProperty('--app-font', `var(--font-${key})`);
}

export default function FontSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<string>('hind-siliguri');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && FONTS.some((f) => f.key === saved)) {
        setCurrent(saved);
        applyFont(saved);
      }
    } catch {}
  }, []);

  const choose = (key: string) => {
    setCurrent(key);
    applyFont(key);
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {}
  };

  return (
    <div className="fixed bottom-24 left-3 z-[9999]">
      {open && (
        <div className="mb-2 w-60 rounded-2xl border border-[#DCE7E1] bg-white p-2 shadow-lg">
          {FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => choose(f.key)}
              style={{ fontFamily: `var(--font-${f.key})` }}
              className={`block w-full rounded-xl px-3 py-2 text-left text-sm ${
                current === f.key ? 'bg-[#E6F4EE] font-semibold text-[#0D7A56]' : 'text-[#0F1F18]'
              }`}
            >
              {f.label}
              <span className="block text-xs opacity-70">দোকানের সব হিসাব ২,৪০০ ৳</span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0D7A56] text-sm font-bold text-white shadow-lg"
        aria-label="Change font"
      >
        Aa
      </button>
    </div>
  );
}
