/**
 * GET /api/invitations/verify?token=xxx
 * Verifica si un token d'invitació és vàlid (sense consumir-lo).
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/server/api-response';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'El paràmetre "token" és obligatori.');
  }

  const invitation = await prisma.invitation.findUnique({ where: { token } });

  if (!invitation) {
    return apiError('INVALID_REQUEST', 404, 'Token d\'invitació no vàlid.');
  }
  if (invitation.usedAt !== null) {
    return apiError('INVALID_REQUEST', 410, 'Aquest token d\'invitació ja ha estat usat.');
  }
  if (invitation.expiresAt < new Date()) {
    return apiError('INVALID_REQUEST', 410, 'El token d\'invitació ha caducat.');
  }

  return apiSuccess({
    invitation: {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      expiresAt: invitation.expiresAt,
    },
  });
}
