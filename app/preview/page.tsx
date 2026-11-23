import { notFound } from 'next/navigation';
import { ClaimFlowPreview, LogoutGuardPreview, OtpPreview } from '@/components/preview/AccountDesigns';

/**
 * Development-only design previews for backend-phase account flows (S10).
 * Production builds return 404, so shopkeepers never see a fake OTP or login state.
 */
export default function PreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto max-w-md space-y-5 bg-canvas px-5 py-8">
      <h1 className="text-xl font-extrabold text-ink">অ্যাকাউন্ট ফ্লো — ডিজাইন প্রিভিউ</h1>
      <OtpPreview />
      <LogoutGuardPreview />
      <ClaimFlowPreview />
    </main>
  );
}
