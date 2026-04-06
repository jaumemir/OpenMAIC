import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import AuthTopbarClient from './auth-topbar-client';

/**
 * Server Component — obté la sessió i la passa al client.
 * Renderitza la topbar d'autenticació (avatar, nom, logout, link admin).
 */
export default async function AuthTopbar() {
  const hdrs = await headers();
  const session = await getSessionFromHeaders(hdrs);

  if (!session) return null;

  const user = session.user as {
    id: string;
    email: string;
    name?: string;
    role?: string;
  };

  return (
    <AuthTopbarClient
      userId={user.id}
      email={user.email}
      name={user.name ?? user.email}
      role={user.role ?? 'user'}
    />
  );
}
