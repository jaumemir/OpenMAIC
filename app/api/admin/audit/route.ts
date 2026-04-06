/**
 * GET /api/admin/audit — Log d'auditoria filtrable i paginat.
 *
 * Query params:
 *   userId   — filtrar per usuari
 *   action   — filtrar per acció (p.ex. COURSE_GENERATED)
 *   from     — data inici ISO 8601
 *   to       — data fi ISO 8601
 *   page     — pàgina (default: 1)
 *   limit    — registres per pàgina (default: 50, max: 200)
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { fromDbJson } from '@/lib/db-compat';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Accés restringit a administradors.');
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId') ?? undefined;
  const action = searchParams.get('action') ?? undefined;
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...(userId ? { userId } : {}),
    ...(action ? { action } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          include: { profile: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return apiSuccess({
    logs: logs.map((l) => ({
      id: l.id,
      action: l.action,
      entityType: l.entityType,
      entityId: l.entityId,
      details: fromDbJson(l.details),
      ipAddress: l.ipAddress,
      createdAt: l.createdAt,
      user: l.user
        ? {
            id: l.user.id,
            email: l.user.email,
            firstName: l.user.profile?.firstName ?? null,
            lastName: l.user.profile?.lastName ?? null,
          }
        : null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
