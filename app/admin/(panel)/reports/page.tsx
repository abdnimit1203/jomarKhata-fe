import { Suspense } from 'react';
import { AdminReports } from '@/components/admin/AdminReports';

/** Suspense: the list reads ?id= (Telegram "View report" button) from the URL. */
export default function Page() {
  return (
    <Suspense>
      <AdminReports />
    </Suspense>
  );
}
