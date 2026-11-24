import { Suspense } from 'react';
import { AdminUsers } from '@/components/admin/AdminUsers';

/** Suspense: the list reads ?q= / ?filter= from the URL. */
export default function Page() {
  return (
    <Suspense>
      <AdminUsers />
    </Suspense>
  );
}
