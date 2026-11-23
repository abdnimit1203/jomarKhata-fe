import type { Metadata, Viewport } from 'next';
import { Noto_Sans_Bengali } from 'next/font/google';
import { ServiceWorkerRegister } from '@/components/pwa/ServiceWorkerRegister';
import { DEVELOPER, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TAGLINE, siteUrl } from '@/lib/seo';
import './globals.css';

// Single app font (owner decision, S1): Noto Sans Bengali — the generic, Android-native Bangla family.
// Variable font, so every weight (400–800) is available without extra downloads.
const notoSansBengali = Noto_Sans_Bengali({
  subsets: ['bengali', 'latin'],
  variable: '--font-noto-sans-bengali',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s | জমারখাতা` },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: 'জমারখাতা',
  authors: [{ name: DEVELOPER.name, url: DEVELOPER.url }],
  creator: DEVELOPER.name,
  publisher: DEVELOPER.name,
  category: 'business',
  alternates: { canonical: '/' },
  robots: { index: true, follow: true },
  appleWebApp: { capable: true, title: 'জমারখাতা', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    locale: 'bn_BD',
    url: '/',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'জমারখাতা — সহজ ও নির্ভরযোগ্য ডিজিটাল হিসাব' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/og-image.jpg'],
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
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
