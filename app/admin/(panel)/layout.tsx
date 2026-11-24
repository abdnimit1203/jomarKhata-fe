import { AdminShell } from '@/components/admin/AdminShell';

/** Every admin page except /admin/login: one super-admin check + left sidebar. */
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
