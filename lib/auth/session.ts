import type { NextRequest } from 'next/server';
import { auth } from './server';

/**
 * Obté la sessió actual des d'un NextRequest (per a API routes).
 * Retorna null si no hi ha sessió o si el token és invàlid.
 */
export async function getSession(req: NextRequest) {
  return auth.api.getSession({ headers: req.headers });
}

/**
 * Obté la sessió actual des de Headers (per a Server Components i middleware).
 */
export async function getSessionFromHeaders(headers: Headers) {
  return auth.api.getSession({ headers });
}
