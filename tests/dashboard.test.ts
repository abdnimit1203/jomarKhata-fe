/**
 * S4 guard: above-the-fold Dashboard order (plan 3.1) and no duplicate tool grid (3.2).
 * The 360x640 fold is measured in a browser (see CHANGELOG): বেচা/কেনা end above the bottom bar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const dash = fs.readFileSync(path.resolve(__dirname, '../components/views/DashboardView.tsx'), 'utf8');
const at = (needle: string) => {
  const i = dash.indexOf(needle);
  if (i < 0) throw new Error(`missing: ${needle}`);
  return i;
};

describe('Dashboard (S4)', () => {
  it('mobile order: hero (cash + পাওনা/দেনা) → বিক্রি/কেনা → quick actions → আজ/মাস → সব হিসাব → recent', () => {
    const order = [
      at('হাতে ক্যাশ'),
      at('মোট পাওনা'),
      at("openSheet({ type: 'sale' })"),
      at("label: 'বাকি আদায়'"),
      at("'আজকের হিসাব'"),
      at('>সব হিসাব</h2>'),
      at('সাম্প্রতিক লেনদেন'),
    ];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('the duplicate tools grid is gone (those screens live in the আরও menu)', () => {
    expect(dash).not.toMatch(/আপনার ব্যবসার জন্য/);
    expect(dash).not.toMatch(/পার্টি তালিকা/);
  });

  it('hero is compact: one cash figure, channel line and a পাওনা/দেনা row', () => {
    expect(dash).toMatch(/text-3xl font-bold/);
    expect(dash).not.toMatch(/sm:text-4xl/);
    expect(dash).toMatch(/মোট দেনা/);
  });
});
