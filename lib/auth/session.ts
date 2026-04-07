import type { NextRequest } from 'next/server';
import { auth } from './server';
import { prisma } from '@/lib/prisma';

/**
 * Obté la sessió actual des d'un NextRequest (per a API routes).
 * Retorna null si no hi ha sessió, si el token és invàlid o si l'usuari està inactiu.
 */
export async function getSession(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) return null;
  return checkUserActive(session);
}

/**
 * Obté la sessió actual des de Headers (per a Server Components i middleware).
 */
export async function getSessionFromHeaders(headers: Headers) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user?.id) return null;
  return checkUserActive(session);
}

/** Retorna null si l'usuari té status 'inactive' (compte inhabilitat). */
async function checkUserActive<T extends { user: { id: string } }>(session: T): Promise<T | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { status: true },
    });
    if (user?.status === 'inactive') return null;
  } catch {
    // Si no podem verificar l'estat, deixem passar (fail-open per evitar bloquejos)
  }
  return session;
}
