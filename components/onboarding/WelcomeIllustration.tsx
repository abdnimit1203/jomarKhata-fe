import React from 'react';

/**
 * Original illustration for the welcome screen: a small shop, a phone showing the khata,
 * and a coin stack. Colours come only from design tokens (CSS variables), no raw hex.
 */
export function WelcomeIllustration({ className }: { className?: string }) {
  const c = {
    primary: 'var(--color-primary)',
    primaryDeep: 'var(--color-primary-deep)',
    secondary: 'var(--color-secondary)',
    accent: 'var(--color-highlight)',
    onAccent: 'var(--color-ink)',
    green: 'var(--color-tile-green-fg)',
    orange: 'var(--color-tile-orange-fg)',
    sky: 'var(--color-tile-sky-bg)',
    skyFg: 'var(--color-tile-sky-fg)',
    greenBg: 'var(--color-tile-green-bg)',
    surface: 'var(--color-surface)',
    canvas: 'var(--color-canvas)',
    border: 'var(--color-border-strong)',
    danger: 'var(--color-danger)',
    dangerSoft: 'var(--color-danger-soft)',
    ink: 'var(--color-ink)',
  };

  return (
    <svg viewBox="0 0 320 260" role="img" aria-label="দোকান, মোবাইলে হিসাবের খাতা আর টাকার কয়েন" className={className}>
      {/* Sun / glow */}
      <circle cx="244" cy="62" r="40" fill={c.accent} opacity="0.28" />
      <circle cx="244" cy="62" r="24" fill={c.accent} opacity="0.5" />

      {/* Ground */}
      <ellipse cx="160" cy="236" rx="148" ry="16" fill={c.secondary} />

      {/* Shop body */}
      <rect x="34" y="96" width="150" height="136" rx="10" fill={c.surface} stroke={c.border} strokeWidth="2" />
      {/* Awning */}
      <path d="M26 96 h166 l-10 -30 h-146 z" fill={c.primary} />
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M${26 + i * 33.2} 96 q16.6 18 33.2 0`}
          fill={i % 2 === 0 ? c.primary : c.secondary}
          stroke={c.primary}
          strokeWidth="1.5"
        />
      ))}
      {/* Shop sign */}
      <rect x="66" y="74" width="86" height="16" rx="4" fill={c.surface} opacity="0.95" />
      <rect x="76" y="80" width="66" height="4" rx="2" fill={c.primary} />
      {/* Window with shelves */}
      <rect x="48" y="128" width="64" height="50" rx="6" fill={c.canvas} stroke={c.border} strokeWidth="2" />
      <rect x="54" y="140" width="52" height="3" rx="1.5" fill={c.border} />
      <rect x="54" y="160" width="52" height="3" rx="1.5" fill={c.border} />
      <rect x="58" y="130" width="10" height="10" rx="2" fill={c.accent} />
      <rect x="72" y="132" width="8" height="8" rx="2" fill={c.green} />
      <rect x="84" y="129" width="12" height="11" rx="2" fill={c.danger} opacity="0.8" />
      <rect x="60" y="150" width="14" height="10" rx="2" fill={c.orange} opacity="0.85" />
      <rect x="80" y="149" width="9" height="11" rx="2" fill={c.accent} />
      {/* Door */}
      <rect x="124" y="140" width="44" height="92" rx="6" fill={c.sky} stroke={c.skyFg} strokeWidth="2" />
      <circle cx="160" cy="188" r="3" fill={c.skyFg} />

      {/* Phone */}
      <g transform="rotate(-6 236 162)">
        <rect x="190" y="88" width="92" height="160" rx="16" fill={c.primaryDeep} />
        <rect x="197" y="100" width="78" height="136" rx="10" fill={c.surface} />
        {/* app header */}
        <rect x="197" y="100" width="78" height="30" rx="10" fill={c.primary} />
        <rect x="197" y="118" width="78" height="12" fill={c.primary} />
        <rect x="205" y="108" width="36" height="5" rx="2.5" fill={c.surface} opacity="0.85" />
        <rect x="205" y="118" width="24" height="5" rx="2.5" fill={c.accent} />
        {/* ledger rows */}
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <circle cx="211" cy={146 + i * 22} r="6" fill={i % 2 === 0 ? c.greenBg : c.dangerSoft} />
            <rect x="221" y={142 + i * 22} width="24" height="4" rx="2" fill={c.ink} opacity="0.55" />
            <rect x="221" y={149 + i * 22} width="16" height="3" rx="1.5" fill={c.ink} opacity="0.25" />
            <rect x="251" y={143 + i * 22} width="18" height="5" rx="2.5" fill={i % 2 === 0 ? c.green : c.danger} />
          </g>
        ))}
      </g>

      {/* Coin stack */}
      {[0, 1, 2].map((i) => (
        <ellipse key={i} cx="178" cy={226 - i * 9} rx="20" ry="7" fill={c.accent} stroke={c.onAccent} strokeOpacity="0.25" strokeWidth="1.5" />
      ))}
      <text x="178" y="212" textAnchor="middle" fontSize="11" fontWeight="800" fill={c.onAccent}>৳</text>

      {/* Plant */}
      <rect x="14" y="214" width="18" height="18" rx="4" fill={c.accent} />
      <path d="M23 214 q-12 -14 -4 -28 q6 10 4 28 z" fill={c.green} />
      <path d="M23 214 q10 -12 6 -24 q-8 8 -6 24 z" fill={c.green} opacity="0.75" />
    </svg>
  );
}
