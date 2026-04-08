import { headers } from 'next/headers';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
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

  // El nom ve de user_profiles (firstName + lastName), no de users.name
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { firstName: true, lastName: true },
  });
  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`.trim()
    : (user.name ?? user.email);

  return (
    <AuthTopbarClient
      userId={user.id}
      email={user.email}
      name={displayName}
      role={user.role ?? 'user'}
    />
  );
}
