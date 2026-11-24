'use client';

/** /admin/login: sign in with the super-admin email, then go to the dashboard. */
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';
import { AuthScreen } from '@/components/onboarding/AuthScreen';
import { authProvider } from '@/lib/auth-firebase';
import { checkAdmin } from './adminApi';

export function AdminLogin() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);

  // already signed in as super admin → straight to the dashboard
  useEffect(() => {
    let alive = true;
    checkAdmin()
      .then((r) => {
        if (alive && r === 'ok') router.replace('/admin/settings');
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [router]);

  return (
    <div>
      {msg && <p className="mx-auto mt-4 max-w-md rounded-2xl bg-danger-soft p-3 text-sm font-semibold text-danger">{msg}</p>}
      <AuthScreen
        onBack={() => router.push('/')}
        onSignedIn={async () => {
          const r = await checkAdmin();
          if (r === 'ok') router.replace('/admin/settings');
          else {
            setMsg('এই অ্যাকাউন্টের অ্যাডমিন অনুমতি নেই।');
            await authProvider.signOut().catch(() => {});
          }
        }}
      />
    </div>
  );
}
