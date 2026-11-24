import type { Metadata } from 'next';

/**
 * Owner's admin panel. Online-only, never cached by the service worker, kept out of search
 * (noindex) and NOT listed in robots.txt (that would advertise the path). Real protection is the
 * server: every /admin/* API call needs a super_admin Firebase login.
 */
export const metadata: Metadata = {
  title: 'অ্যাডমিন',
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink">{children}</div>;
}
