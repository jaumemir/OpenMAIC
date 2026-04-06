export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/server';
import { toNextJsHandler } from 'better-auth/next-js';
import { auditLog, extractRequestMeta } from '@/lib/audit';

const handler = toNextJsHandler(auth);

// Wrapper per auditar login i logout
async function auditedPost(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/auth/, '');
  const meta = extractRequestMeta(req);

  // Capturem sessió ABANS per al logout (la sessió s'elimina durant el handler)
  let preLogoutSession: { id?: string; userId?: string } | null = null;
  if (path === '/sign-out') {
    try {
      const session = await auth.api.getSession({ headers: req.headers });
      if (session) {
        preLogoutSession = {
          id: session.session?.id,
          userId: session.user?.id,
        };
      }
    } catch {
      // Silenciem — si falla la lectura prèvia, continuem igualment
    }
  }

  // Cridem el handler original (clona el request per preservar el body)
  const res = await handler.POST(req.clone() as NextRequest);

  // Auditoria post-request
  try {
    if (path === '/sign-in/email' && res.status >= 200 && res.status < 300) {
      // Llegim la resposta per obtenir userId (sense consumir el cos de la resposta original)
      const cloned = res.clone();
      const body = await cloned.json().catch(() => null);
      const userId = body?.user?.id;
      const sessionId = body?.session?.id;
      if (userId) {
        await auditLog({ userId, action: 'USER_LOGIN', entityType: 'session', entityId: sessionId, ...meta });
      }
    } else if (path === '/sign-out' && preLogoutSession?.userId) {
      await auditLog({
        userId: preLogoutSession.userId,
        action: 'USER_LOGOUT',
        entityType: 'session',
        entityId: preLogoutSession.id,
        ...meta,
      });
    }
  } catch (err) {
    console.error('[auth route] Error en auditoria:', err);
  }

  return res as NextResponse;
}

export async function GET(req: NextRequest) {
  return handler.GET(req);
}

export async function POST(req: NextRequest) {
  return auditedPost(req);
}
