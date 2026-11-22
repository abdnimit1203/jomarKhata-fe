import type { Metadata, Viewport } from 'next';
import {
  Hind_Siliguri,
  Plus_Jakarta_Sans,
  Noto_Sans_Bengali,
  Anek_Bangla,
  Baloo_Da_2,
  Tiro_Bangla,
  Noto_Serif_Bengali,
} from 'next/font/google';
import { JomarkhataProvider } from '@/context/JomarkhataContext';
import FontSwitcher from '@/components/FontSwitcher';
import './globals.css';

// Candidate Bangla fonts for the dev FontSwitcher (preload off so they only download when picked).
const notoSansBengali = Noto_Sans_Bengali({ subsets: ['bengali', 'latin'], variable: '--font-noto-sans-bengali', display: 'swap', preload: false });
const anekBangla = Anek_Bangla({ subsets: ['bengali', 'latin'], variable: '--font-anek-bangla', display: 'swap', preload: false });
const balooDa2 = Baloo_Da_2({ subsets: ['bengali', 'latin'], variable: '--font-baloo-da-2', display: 'swap', preload: false });
const tiroBangla = Tiro_Bangla({ subsets: ['bengali', 'latin'], weight: '400', variable: '--font-tiro-bangla', display: 'swap', preload: false });
const notoSerifBengali = Noto_Serif_Bengali({ subsets: ['bengali', 'latin'], variable: '--font-noto-serif-bengali', display: 'swap', preload: false });
const candidateFonts = [notoSansBengali, anekBangla, balooDa2, tiroBangla, notoSerifBengali]
  .map((f) => f.variable)
  .join(' ');

const hindSiliguri = Hind_Siliguri({
  subsets: ['bengali', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-hind-siliguri',
  display: 'swap',
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plus-jakarta',
  display: 'swap',
});

export const metadata: Metadata = {
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
  themeColor: '#0D7A56',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bn" className={`${hindSiliguri.variable} ${plusJakarta.variable} ${candidateFonts}`}>
      <body className="antialiased" suppressHydrationWarning>
        <JomarkhataProvider>{children}</JomarkhataProvider>
        {process.env.NODE_ENV === 'development' && <FontSwitcher />}
      </body>
    </html>
  );
}
