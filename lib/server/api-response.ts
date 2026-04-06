import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export const API_ERROR_CODES = {
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  MISSING_API_KEY: 'MISSING_API_KEY',
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_URL: 'INVALID_URL',
  REDIRECT_NOT_ALLOWED: 'REDIRECT_NOT_ALLOWED',
  CONTENT_SENSITIVE: 'CONTENT_SENSITIVE',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  GENERATION_FAILED: 'GENERATION_FAILED',
  TRANSCRIPTION_FAILED: 'TRANSCRIPTION_FAILED',
  PARSE_FAILED: 'PARSE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
} as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[keyof typeof API_ERROR_CODES];

export interface ApiErrorBody {
  success: false;
  errorCode: ApiErrorCode;
  error: string;
  details?: string;
}

export function apiError(
  code: ApiErrorCode,
  status: number,
  error: string,
  details?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    {
      success: false as const,
      errorCode: code,
      error,
      ...(details ? { details } : {}),
    },
    { status },
  );
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, ...data }, { status });
}

// ── Helpers d'autenticació ─────────────────────────────────────────────────

export type AuthedUser = {
  id: string;
  email: string;
  role: string;
  status: string;
};

/**
 * Comprova que hi ha sessió activa. Retorna l'usuari o una NextResponse 401.
 * Ús: `const result = await requireAuth(req); if (result instanceof NextResponse) return result;`
 */
export async function requireAuth(
  req: NextRequest,
): Promise<AuthedUser | NextResponse> {
  const session = await getSession(req);
  if (!session) {
    return apiError('UNAUTHORIZED', 401, 'Cal autenticar-se per accedir a aquest recurs.');
  }
  return {
    id: session.user.id,
    email: session.user.email,
    role: (session.user as { role?: string }).role ?? 'user',
    status: (session.user as { status?: string }).status ?? 'pending',
  };
}

/**
 * Comprova que l'usuari és admin o és propietari del stage indicat.
 * Retorna null si té permisos, o una NextResponse 403/404 si no.
 */
export async function requireOwnership(
  userId: string,
  role: string,
  stageId: string,
): Promise<null | NextResponse> {
  if (role === 'admin') return null;

  const ownership = await prisma.stageOwnership.findUnique({
    where: { stageId },
  });

  if (!ownership) {
    return apiError('NOT_FOUND', 404, 'Stage no trobat.');
  }
  if (ownership.userId !== userId) {
    return apiError('FORBIDDEN', 403, 'No tens permisos per accedir a aquest recurs.');
  }
  return null;
}
