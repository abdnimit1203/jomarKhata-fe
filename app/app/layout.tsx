import type { Metadata } from 'next';
import { JomarkhataProvider } from '@/context/JomarkhataContext';

export const metadata: Metadata = {
  title: 'অ্যাপ',
  // The app shows a shop's private khata: keep it out of search results.
  robots: { index: false, follow: false },
};

/** The bookkeeping app lives under /app. Only this subtree opens the local database. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <JomarkhataProvider>{children}</JomarkhataProvider>;
}
