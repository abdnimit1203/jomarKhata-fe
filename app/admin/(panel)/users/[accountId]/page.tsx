import { AdminUserDetail } from '@/components/admin/AdminUserDetail';

export default async function Page({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  return <AdminUserDetail accountId={decodeURIComponent(accountId)} />;
}
