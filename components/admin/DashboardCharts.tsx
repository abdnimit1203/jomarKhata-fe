'use client';

/**
 * Admin dashboard charts (ApexCharts). Loaded only in the browser and only on the admin dashboard,
 * so the shop app never downloads it. Colours follow the app's tile palette.
 */
import dynamic from 'next/dynamic';
import React from 'react';
import { useAdminLang, useTr } from './i18n';

const Chart = dynamic(() => import('react-apexcharts'), { ssr: false, loading: () => <div className="h-64" /> });

const MONTHS_BN = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BN_DIGITS = (s: string) => s.replace(/\d/g, (c) => '০১২৩৪৫৬৭৮৯'[Number(c)]);

/** Colours come from the design tokens (app/globals.css), read at runtime for ApexCharts. */
const token = (name: string) =>
  typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim();

interface Props {
  s: {
    trial: number;
    paid: number;
    expired: number;
    signupsByDay: { day: string; users: number }[];
    revenueByMonth: { month: string; taka: number; orders: number }[];
  };
}

export function DashboardCharts({ s }: Props) {
  const tr = useTr();
  const lang = useAdminLang();
  const n = (x: number | string) => (lang === 'en' ? String(x) : BN_DIGITS(String(x)));
  const dayLabel = (d: string) => n(`${d.slice(8, 10)}/${d.slice(5, 7)}`);
  const monthLabel = (m: string) => (lang === 'en' ? MONTHS_EN : MONTHS_BN)[Number(m.slice(5, 7)) - 1];
  const font = { fontFamily: 'inherit' };
  const BLUE = token('--color-tile-indigo-fg');
  const GREEN = token('--color-tile-green-fg');
  const SKY = token('--color-tile-sky-fg');
  const RED = token('--color-tile-red-fg');
  const GRID = token('--color-border');
  const INK = token('--color-ink');
  const card = 'rounded-2xl bg-white p-4 shadow-card';

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <section className={`${card} xl:col-span-2`}>
        <h2 className="mb-1 text-sm font-bold text-tile-indigo-fg">{tr('নতুন ইউজার (গত ৩০ দিন)')}</h2>
        <Chart
          type="area"
          height={250}
          series={[{ name: tr('নতুন ইউজার'), data: s.signupsByDay.map((d) => d.users) }]}
          options={{
            chart: { toolbar: { show: false }, zoom: { enabled: false }, ...font },
            colors: [BLUE],
            dataLabels: { enabled: false },
            stroke: { curve: 'smooth', width: 3 },
            fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
            xaxis: { categories: s.signupsByDay.map((d) => dayLabel(d.day)), tickAmount: 10, labels: { rotate: 0 } },
            yaxis: { min: 0, forceNiceScale: true, labels: { formatter: (v: number) => n(Math.round(v)) } },
            grid: { borderColor: GRID, strokeDashArray: 4 },
            tooltip: { y: { formatter: (v: number) => n(v) } },
          }}
        />
      </section>

      <section className={card}>
        <h2 className="mb-1 text-sm font-bold text-tile-sky-fg">{tr('সাবস্ক্রিপশনের অবস্থা')}</h2>
        <Chart
          type="donut"
          height={250}
          series={[s.trial, s.paid, s.expired]}
          options={{
            chart: font,
            labels: [tr('ট্রায়াল'), tr('পেইড'), tr('মেয়াদ শেষ')],
            colors: [SKY, GREEN, RED],
            legend: { position: 'bottom' },
            dataLabels: { formatter: (v: number) => n(`${Math.round(v)}%`) },
            plotOptions: { pie: { donut: { size: '62%' } } },
            tooltip: { y: { formatter: (v: number) => n(v) } },
          }}
        />
      </section>

      <section className={`${card} xl:col-span-3`}>
        <h2 className="mb-1 text-sm font-bold text-tile-green-fg">{tr('আয় (গত ৬ মাস)')}</h2>
        <Chart
          type="bar"
          height={260}
          series={[{ name: tr('আয় (টাকা)'), data: s.revenueByMonth.map((m) => m.taka) }]}
          options={{
            chart: { toolbar: { show: false }, ...font },
            colors: [GREEN],
            plotOptions: { bar: { borderRadius: 6, columnWidth: '45%' } },
            dataLabels: { enabled: true, formatter: (v: number) => (v ? n(`৳${v}`) : ''), style: { colors: [INK] }, offsetY: -18 },
            xaxis: { categories: s.revenueByMonth.map((m) => monthLabel(m.month)) },
            yaxis: { min: 0, labels: { formatter: (v: number) => n(`৳${Math.round(v)}`) } },
            grid: { borderColor: GRID, strokeDashArray: 4 },
            tooltip: { y: { formatter: (v: number) => n(`৳${v}`) } },
          }}
        />
      </section>
    </div>
  );
}
