import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';
import { JomarkhataProvider } from '@/context/JomarkhataContext';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import './globals.css';

// Single app font (owner decision, S1): Noto Sans Bengali — the generic, Android-native Bangla family.
// Variable font, so every weight (400–800) is available without extra downloads.
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali', 'latin'],
  variable: '--font-noto-sans-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  applicationName: 'জমারখাতা',
  appleWebApp: { capable: true, title: 'জমারখাতা', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  title: 'জমারখাতা (Jomarkhata) — দোকানের সব হিসাব, এক খাতায়।',
  description:
    'দোকানের সব হিসাব, এক খাতায়। বাংলাদেশের ক্ষুদ্র ও মাঝারি ব্যবসায়ীদের জন্য সহজ ডিজিটাল হিসাবখাতা।',
  openGraph: {
    title: 'জমারখাতা (Jomarkhata)',
    description: 'দোকানের সব হিসাব, এক খাতায়।',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'জমারখাতা (Jomarkhata)',
    description: 'দোকানের সব হিসাব, এক খাতায়।',
  },
};

export const viewport: Viewport = {
  // Must be a literal colour for the browser UI; mirrors --color-primary in globals.css.
  themeColor: '#4664E0',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={notoSansBengali.variable}>
      <body className="antialiased" suppressHydrationWarning>
        <JomarkhataProvider>{children}</JomarkhataProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
