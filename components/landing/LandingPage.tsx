import Link from 'next/link';
import { ArrowRight, Check, Download, Smartphone, WifiOff, Languages, ShieldCheck } from 'lucide-react';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { FeatureIcon, type FeatureTone } from '@/components/ui/FeatureIcon';
import { WelcomeIllustration } from '@/components/onboarding/WelcomeIllustration';
import { StandaloneRedirect } from './StandaloneRedirect';
import { DEVELOPER, SITE_DESCRIPTION, siteUrl } from '@/lib/seo';

/** schema.org SoftwareApplication with the developer as author (Google rich results). */
function jsonLd(): string {
  const author = { '@type': 'Person', name: DEVELOPER.name, ...(DEVELOPER.url ? { url: DEVELOPER.url } : {}) };
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'জমারখাতা (Jomarkhata)',
    alternateName: 'Jomarkhata',
    url: siteUrl().toString(),
    description: SITE_DESCRIPTION,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Android, iOS, Web',
    inLanguage: 'bn',
    image: new URL('/og-image.jpg', siteUrl()).toString(),
    author,
    creator: author,
  };
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Public landing page (L1). Bengali only. Every claim here must be true today:
 * no cloud backup, sync, encryption, prices, user counts or testimonials until they exist.
 */

const TRUST = [
  { icon: WifiOff, text: 'ইন্টারনেট ছাড়াই চলে' },
  { icon: Smartphone, text: 'হিসাব আপনার ফোনেই থাকে' },
  { icon: Languages, text: 'সম্পূর্ণ বাংলায়' },
  { icon: Download, text: 'ফোনে অ্যাপের মতো ইনস্টল' },
];

const FEATURES: Array<{ icon: AppIconName; tone: FeatureTone; title: string; text: string }> = [
  { icon: 'sale', tone: 'green', title: 'বিক্রির হিসাব', text: 'দ্রুত বিক্রি বা পণ্য ধরে বিক্রি, ক্যাশ বা বাকিতে।' },
  { icon: 'purchase', tone: 'blue', title: 'কেনার হিসাব', text: 'মহাজনের কাছ থেকে কেনা, স্টক নিজে থেকেই বাড়ে।' },
  { icon: 'book-due', tone: 'orange', title: 'পাওনা-দেনা', text: 'কার কাছে কত পাওনা, কার কত দেনা — এক নজরে।' },
  { icon: 'expense', tone: 'red', title: 'খরচের হিসাব', text: 'ভাড়া, বিল, বেতন — খাত ধরে খরচ লিখুন।' },
  { icon: 'cashbox', tone: 'gold', title: 'ক্যাশ বক্স', text: 'ক্যাশ, বিকাশ, নগদ, ব্যাংক — আলাদা আলাদা ব্যালেন্স।' },
  { icon: 'stock', tone: 'indigo', title: 'স্টক', text: 'কোন মাল কত আছে, কম পড়লে সতর্কতা।' },
  { icon: 'reports', tone: 'sky', title: 'রিপোর্ট', text: 'দিন ও মাসের বিক্রি, খরচ আর লাভ-ক্ষতি।' },
  { icon: 'party-list', tone: 'purple', title: 'কাস্টমার ও মহাজন', text: 'প্রত্যেকের আলাদা খাতা, পুরো লেনদেনের ইতিহাস।' },
];

const STEPS = [
  { title: 'অ্যাপ খুলুন', text: 'ফোনের ব্রাউজারে খুলে “ইনস্টল” চাপুন।' },
  { title: 'দোকানের তথ্য দিন', text: 'দোকানের নাম আর শুরুর ক্যাশ লিখুন।' },
  { title: 'প্রথম বিক্রি লিখুন', text: 'দুই ট্যাপে বিক্রি, বাকি বা খরচ লিখুন।' },
];

const FAQ = [
  {
    q: 'ইন্টারনেট লাগবে কি?',
    a: 'প্রথমবার খুলতে ইন্টারনেট লাগে। এরপর বেচা-কেনা, বাকি, খরচ সব ইন্টারনেট ছাড়াই লেখা যায়।',
  },
  {
    q: 'আমার হিসাব কোথায় থাকে?',
    a: 'এখন আপনার হিসাব শুধু আপনার ফোনেই সংরক্ষিত থাকে। ক্লাউড ব্যাকআপ এখনও চালু হয়নি, চালু হলে জানানো হবে।',
  },
  {
    q: 'ফোন হারালে বা অ্যাপ মুছে ফেললে?',
    a: 'এখন ফোনের ডেটা হারালে হিসাবও হারাবে। তাই সেটিংস থেকে নিয়মিত ব্যাকআপ ফাইল রেখে দিন।',
  },
  {
    q: 'দাম কত?',
    a: 'এটি এখন পরীক্ষামূলক সংস্করণ। দামের তথ্য চূড়ান্ত হলে এখানে জানানো হবে।',
  },
  {
    q: 'কোন ফোনে চলে?',
    a: 'Android-এ Chrome দিয়ে সবচেয়ে ভালো চলে। iPhone-এ Safari দিয়েও হোম স্ক্রিনে যোগ করা যায়।',
  },
];

export function LandingPage() {
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <StandaloneRedirect />
      {/* Structured data for search engines (our own constants only; "<" escaped). */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd() }} />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9" />
            <span className="text-lg font-extrabold text-primary-ink">জমারখাতা</span>
          </Link>
          <nav aria-label="পেজের অংশ" className="hidden items-center gap-6 text-sm font-semibold text-ink-muted md:flex">
            <a href="#features" className="hover:text-ink">ফিচার</a>
            <a href="#how" className="hover:text-ink">কীভাবে কাজ করে</a>
            <a href="#install" className="hover:text-ink">ইনস্টল</a>
            <a href="#faq" className="hover:text-ink">প্রশ্নোত্তর</a>
          </nav>
          <Link
            href="/app"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary-gradient px-4 text-sm font-bold text-on-primary shadow-sm"
          >
            অ্যাপ খুলুন
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-secondary to-canvas">
          <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:py-16">
            <div>
              <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-primary-ink shadow-sm">
                বাংলাদেশের দোকানদারদের জন্য
              </p>
              <h1 className="mt-4 text-3xl leading-tight font-extrabold md:text-5xl md:leading-tight">
                দোকানের সব হিসাব,
                <br />
                <span className="text-primary-ink">এক খাতায়।</span>
              </h1>
              <p className="mt-4 text-base font-medium text-ink-muted md:text-lg">
                বেচা-কেনা, বাকি, খরচ আর স্টক — ইন্টারনেট ছাড়াই আপনার ফোনে সহজে রাখুন।
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/app"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full bg-primary-gradient px-6 text-base font-bold text-on-primary shadow-hero"
                >
                  এখনই শুরু করুন <ArrowRight className="h-5 w-5" />
                </Link>
                <a
                  href="#install"
                  className="inline-flex min-h-13 items-center justify-center gap-2 rounded-full border border-border-strong bg-white px-6 text-base font-bold text-ink"
                >
                  <Download className="h-5 w-5" /> ফোনে ইনস্টল করুন
                </a>
              </div>
              <ul className="mt-5 space-y-1.5 text-sm font-semibold text-ink-muted">
                {['দুই ট্যাপে বিক্রি লেখা', 'পাওনা-দেনা সবসময় পরিষ্কার', 'ক্যাশ · বিকাশ · নগদ · ব্যাংক আলাদা'].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-success" /> {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-center">
              <WelcomeIllustration className="h-auto w-full max-w-[420px]" />
            </div>
          </div>
        </section>

        {/* Trust strip */}
        <section aria-label="মূল সুবিধা" className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {TRUST.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 rounded-2xl bg-white p-3.5 shadow-card">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary-ink">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="text-sm font-bold">{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
          <h2 className="text-2xl font-extrabold md:text-3xl">দোকান চালাতে যা যা লাগে</h2>
          <p className="mt-2 text-base text-ink-muted">রঙ দেখেই চেনা যায় কোন বাটন কী কাজের।</p>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-card">
                <FeatureIcon tone={f.tone}>
                  <AppIcon name={f.icon} />
                </FeatureIcon>
                <div>
                  <h3 className="text-base font-bold">{f.title}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20 bg-white py-14">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="text-2xl font-extrabold md:text-3xl">৩ ধাপে শুরু</h2>
            <ol className="mt-6 grid gap-3 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-2xl bg-canvas p-5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-gradient text-base font-extrabold text-on-primary">
                    {['১', '২', '৩'][i]}
                  </span>
                  <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
                  <p className="mt-1 text-sm text-ink-muted">{s.text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-sm font-semibold text-ink-muted">
              কাদের জন্য: মুদি দোকান, সাধারণ খুচরা ও পাইকারি দোকান।
            </p>
          </div>
        </section>

        {/* Install */}
        <section id="install" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
          <h2 className="text-2xl font-extrabold md:text-3xl">ফোনে ইনস্টল করবেন যেভাবে</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="text-lg font-bold">Android (Chrome)</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                <li>Chrome-এ এই সাইট খুলে “অ্যাপ খুলুন” চাপুন।</li>
                <li>উপরের ⋮ মেনু থেকে “অ্যাপ ইনস্টল করুন” চাপুন।</li>
                <li>হোম স্ক্রিনের জমারখাতা আইকন থেকে খুলুন।</li>
              </ol>
            </div>
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="text-lg font-bold">iPhone (Safari)</h3>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
                <li>Safari-তে এই সাইট খুলে “অ্যাপ খুলুন” চাপুন।</li>
                <li>নিচের শেয়ার বাটন থেকে “Add to Home Screen” চাপুন।</li>
                <li>হোম স্ক্রিনের আইকন থেকে খুলুন।</li>
              </ol>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white py-14">
          <div className="mx-auto max-w-3xl px-4">
            <h2 className="text-2xl font-extrabold md:text-3xl">প্রশ্নোত্তর</h2>
            <div className="mt-6 space-y-2.5">
              {FAQ.map((f) => (
                <details key={f.q} className="group rounded-2xl bg-canvas p-4 open:shadow-card">
                  <summary className="cursor-pointer list-none text-base font-bold marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {f.q}
                      <span aria-hidden="true" className="text-primary-ink transition-transform group-open:rotate-45">
                        +
                      </span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-3xl bg-primary-gradient p-8 text-center text-on-primary shadow-hero">
            <h2 className="text-2xl font-extrabold md:text-3xl">আজ থেকেই হিসাব রাখুন সহজে</h2>
            <p className="mt-2 text-base text-on-primary">খাতা-কলমের ঝামেলা ছাড়া, ফোনেই।</p>
            <Link
              href="/app"
              className="mt-5 inline-flex min-h-13 items-center gap-2 rounded-full bg-white px-7 text-base font-bold text-primary-ink"
            >
              অ্যাপ খুলুন <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-ink-muted md:flex-row md:items-center md:justify-between">
          <p className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> আপনার হিসাব আপনার ফোনেই থাকে।
          </p>
          <p>
            © জমারখাতা · Developed by{' '}
            {DEVELOPER.url ? (
              <a href={DEVELOPER.url} target="_blank" rel="author noopener" className="font-semibold text-primary-ink hover:underline">
                {DEVELOPER.name}
              </a>
            ) : (
              <span className="font-semibold text-ink">{DEVELOPER.name}</span>
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
