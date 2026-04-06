import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import type { ReactNode } from 'react';

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

  return <>{children}</>;
}
