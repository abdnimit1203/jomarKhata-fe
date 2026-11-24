import { notFound } from 'next/navigation';

/** /admin itself shows nothing; the entry is /admin/login. */
export default function AdminRoot() {
  notFound();
}
