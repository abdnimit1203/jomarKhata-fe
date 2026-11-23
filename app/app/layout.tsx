import type { Metadata } from 'next';
import { JomarkhataProvider } from '@/context/JomarkhataContext';

export const metadata: Metadata = {
  title: 'জমারখাতা — অ্যাপ',
};

/** The bookkeeping app lives under /app. Only this subtree opens the local database. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <JomarkhataProvider>{children}</JomarkhataProvider>;
}
