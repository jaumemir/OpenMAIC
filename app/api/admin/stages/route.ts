export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, apiError } from '@/lib/server/api-response';
import { getStorageBackend } from '@/lib/server/storage';
import { prisma } from '@/lib/prisma';
import { auditLog, extractRequestMeta } from '@/lib/audit';

/**
 * GET /api/admin/stages
 * Retorna tots els stages del sistema amb informació del propietari.
 * Només accessible per administradors.
 */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden accedir a aquesta ruta.');
  }

  try {
    const backend = getStorageBackend();

    // Obtenir tots els stages (sense filtre de userId)
    const allStages = await backend.listStages();

    if (allStages.length === 0) {
      return NextResponse.json({ stages: [] });
    }

    // Obtenir propietaris de tots els stages en un sol query
    const ownerships = await prisma.stageOwnership.findMany({
      where: { stageId: { in: allStages.map((s) => s.id) } },
      include: {
        user: {
          select: { id: true, email: true },
        },
      },
    });

    const ownerByStageId = new Map(
      ownerships.map((o) => [o.stageId, { userId: o.userId, email: o.user.email }]),
    );

    const stages = allStages.map((stage) => ({
      ...stage,
      owner: ownerByStageId.get(stage.id) ?? null,
    }));

    return NextResponse.json({ stages });
  } catch (err) {
    console.error('[GET /api/admin/stages]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error llistant stages.');
  }
}

/**
 * DELETE /api/admin/stages?stageId=xxx
 * Esborra un stage qualsevol (d'admin o d'un altre usuari).
 * Només accessible per administradors.
 */
export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden accedir a aquesta ruta.');
  }

  const stageId = req.nextUrl.searchParams.get('stageId');
  if (!stageId || !/^[a-zA-Z0-9_-]{1,64}$/.test(stageId)) {
    return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');
  }

  try {
    const backend = getStorageBackend();
    await backend.deleteStage(stageId);

    // Eliminar propietat de la BD
    await prisma.stageOwnership.deleteMany({ where: { stageId } });

    const meta = extractRequestMeta(req);
    await auditLog({
      userId: user.id,
      action: 'COURSE_DELETED',
      entityType: 'course',
      entityId: stageId,
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/admin/stages]', err);
    return apiError('INTERNAL_ERROR', 500, "Error esborrant el stage.");
  }
}
