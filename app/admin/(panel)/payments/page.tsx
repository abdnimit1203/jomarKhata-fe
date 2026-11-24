import { Suspense } from 'react';
import { AdminPayments } from '@/components/admin/AdminPayments';

/** Suspense: the list reads ?q= / ?filter= from the URL. */
export default function Page() {
  return (
    <Suspense>
      <AdminPayments />
    </Suspense>
  );
}
