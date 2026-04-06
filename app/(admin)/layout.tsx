import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import type { ReactNode } from 'react';
import AdminNav from './admin-nav';

/**
 * Layout per al panel d'administració.
 * Comprova el rol 'admin' al costat del servidor; redirigeix si no és admin.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const hdrs = await headers();
  const session = await getSessionFromHeaders(hdrs);

  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin') {
    redirect('/');
  }

  const user = session.user as { name?: string; email?: string };
  const displayName = user.name ?? user.email ?? 'Admin';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AdminNav displayName={displayName} />
      <main className="flex-1">{children}</main>
    </div>
  );
}
