/**
 * S1 — Design-system guard (Instructions/DESIGN_SYSTEM.md, UI_GUIDELINES.md).
 * Static checks over source files + contrast math on the tokens defined in app/globals.css.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDateInputDisplay, PAYMENT_CHANNELS, toDateInputValue } from '@/lib/format';

const ROOT = path.resolve(__dirname, '..');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(tsx?|css)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const UI_FILES = [...sourceFiles('components'), ...sourceFiles('app')];
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const css = read('app/globals.css');

function token(name: string): string {
  const m = new RegExp(`--color-${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(css);
  if (!m) throw new Error(`token --color-${name} not found in globals.css`);
  return m[1];
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

describe('tokens only — no raw colours in components', () => {
  it('no hex colour literals outside app/globals.css (except the literal browser themeColor)', () => {
    const offenders: string[] = [];
    for (const f of UI_FILES) {
      if (f.replace(/\\/g, '/') === 'app/globals.css') continue;
      read(f)
        .split('\n')
        .forEach((line, i) => {
          if (/#[0-9A-Fa-f]{6}\b/.test(line) && !/themeColor:/.test(line)) offenders.push(`${f}:${i + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('the browser themeColor matches --color-primary', () => {
    const m = /themeColor:\s*'(#[0-9A-Fa-f]{6})'/.exec(read('app/layout.tsx'));
    expect(m?.[1].toUpperCase()).toBe(token('primary').toUpperCase());
  });

  it('owner-approved base palette is defined exactly', () => {
    expect(token('canvas')).toBe('#F7F5EF');
    expect(token('primary')).toBe('#145C46');
    expect(token('secondary')).toBe('#DCECE4');
    expect(token('accent')).toBe('#E9A23B');
    expect(token('danger-soft')).toBe('#FCE7E5');
    expect(token('surface')).toBe('#FFFFFF');
  });
});

describe('contrast (WCAG ≥ 4.5:1 for text pairs in use)', () => {
  const PAIRS: Array<[string, string, string]> = [
    ['ink', 'canvas', 'body text on page'],
    ['ink', 'surface', 'body text on cards'],
    ['ink-muted', 'canvas', 'labels on page'],
    ['ink-muted', 'surface', 'labels on cards'],
    ['ink-muted', 'surface-muted', 'labels on tracks'],
    ['ink-subtle', 'surface', 'meta on cards'],
    ['ink-subtle', 'canvas', 'meta on page / tiles'],
    ['ink-subtle', 'surface-muted', 'meta on tracks / hover fills'],
    ['primary', 'surface', 'primary text on cards'],
    ['primary', 'canvas', 'primary text on page'],
    ['primary', 'secondary', 'দিবো / selected states'],
    ['surface', 'primary', 'white on primary buttons'],
    ['surface', 'primary-hover', 'white on pressed primary'],
    ['danger', 'danger-soft', 'পাবো on soft red'],
    ['danger', 'surface', 'পাবো amounts on cards'],
    ['surface', 'danger', 'white on danger buttons'],
    ['on-accent', 'accent', 'text on amber'],
    ['accent-ink', 'canvas', 'amber used as text'],
    ['accent-ink', 'surface', 'amber used as text on cards'],
    ['warning-ink', 'warning-soft', 'warning / local-only badge'],
  ];
  for (const [fg, bg, use] of PAIRS) {
    it(`${fg} on ${bg} (${use})`, () => {
      expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
    });
  }

  it('documented forbidden pairs really fail (white on amber, amber as text)', () => {
    expect(contrast('#FFFFFF', token('accent'))).toBeLessThan(4.5);
    expect(contrast(token('accent'), token('canvas'))).toBeLessThan(4.5);
  });

  it('cards need an outline: white on ivory is nearly invisible, so .shadow-card draws border-strong', () => {
    expect(contrast(token('surface'), token('canvas'))).toBeLessThan(1.2);
    expect(css).toMatch(/\.shadow-card\s*\{[^}]*0 0 0 1px var\(--color-border-strong\)/);
  });
});

describe('typography', () => {
  it('smallest text token is at least 13px and no arbitrary px font sizes are used', () => {
    const xs = /--text-xs:\s*([\d.]+)rem/.exec(css);
    expect(Number(xs?.[1]) * 16).toBeGreaterThanOrEqual(13);
    const offenders = UI_FILES.filter((f) => /text-\[\d+px\]/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('single generic app font (Noto Sans Bengali); dev font switcher removed', () => {
    expect(fs.existsSync(path.join(ROOT, 'components/FontSwitcher.tsx'))).toBe(false);
    const layout = read('app/layout.tsx');
    expect(layout).toMatch(/Noto_Sans_Bengali/);
    expect(layout).not.toMatch(/Hind_Siliguri|Plus_Jakarta|Anek_Bangla|Baloo|Tiro_Bangla|FontSwitcher/);
  });
});

describe('terminology (D10): cash = ক্যাশ, নগদ = Nagad wallet only', () => {
  it('payment channels read ক্যাশ · বিকাশ · নগদ · ব্যাংক', () => {
    expect(PAYMENT_CHANNELS.map((c) => c.shortLabel)).toEqual(['ক্যাশ', 'বিকাশ', 'নগদ', 'ব্যাংক']);
    expect(PAYMENT_CHANNELS.find((c) => c.id === 'cash')!.label).toBe('ক্যাশ');
  });

  it('no "নগদ ক্যাশ" / "নগদ (MFS)" / "হাতে নগদ" wording left in the UI', () => {
    const files = [...UI_FILES, 'lib/format.ts'];
    const offenders = files.filter((f) => /নগদ ক্যাশ|নগদ \(MFS\)|নগদ MFS|হাতে নগদ|আজ নগদ|শুরুর নগদ ক্যাশ/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('AP-12 NOT applied: the walk-in label "নগদ ক্রেতা" is unchanged (owner decision)', () => {
    expect(read('services/jomarkhataService.ts')).toMatch(/'নগদ ক্রেতা'/);
    expect(read('components/sheets/SaleFormSheet.tsx')).toMatch(/নগদ ক্রেতা/);
  });
});

describe('date input display (dd/MM/yyyy, owner standard)', () => {
  it('formats yyyy-MM-dd and ISO timestamps as dd/MM/yyyy in Bengali digits', () => {
    expect(formatDateInputDisplay('2026-11-22')).toBe('২২/১১/২০২৬');
    expect(formatDateInputDisplay('2026-01-05')).toBe('০৫/০১/২০২৬');
    const iso = new Date(2026, 2, 9, 15, 30).toISOString();
    expect(toDateInputValue(iso)).toBe('2026-03-09');
    expect(formatDateInputDisplay(iso)).toBe('০৯/০৩/২০২৬');
  });

  it('empty or invalid input gives an empty display (placeholder is shown instead)', () => {
    expect(formatDateInputDisplay('')).toBe('');
    expect(formatDateInputDisplay(null)).toBe('');
    expect(formatDateInputDisplay('not-a-date')).toBe('');
  });
});
