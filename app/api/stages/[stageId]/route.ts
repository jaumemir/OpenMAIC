export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getStorageBackend } from '@/lib/server/storage';
import { requireAuth, requireOwnership, apiError } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

type Params = { params: Promise<{ stageId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { stageId } = await params;
  if (!isValidId(stageId)) return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');

  const ownershipError = await requireOwnership(user.id, user.role, stageId);
  if (ownershipError) return ownershipError;

  try {
    const data = await getStorageBackend().loadStage(stageId);
    if (!data) return apiError('NOT_FOUND', 404, 'Stage no trobat.');
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/stages/[stageId]]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error carregant stage.');
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { stageId } = await params;
  if (!isValidId(stageId)) return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');

  // PUT té semàntica "crear o substituir": sempre registra l'ownership si no existeix.
  // Admins poden modificar stages d'altres usuaris (no reben 403), però els seus
  // propis stages també queden registrats per aparèixer a la pantalla principal.
  const existing = await prisma.stageOwnership.findUnique({ where: { stageId } });
  if (existing && existing.userId !== user.id && user.role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'No tens permisos per accedir a aquest recurs.');
  }
  if (!existing) {
    await prisma.stageOwnership.create({ data: { stageId, userId: user.id } });
  }

  try {
    const data = await req.json();
    await getStorageBackend().saveStage(stageId, data);

    const meta = extractRequestMeta(req);
    await auditLog({
      userId: user.id,
      action: 'COURSE_SAVED',
      entityType: 'course',
      entityId: stageId,
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/stages/[stageId]]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error desant stage.');
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { stageId } = await params;
  if (!isValidId(stageId)) return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');

  const ownershipError = await requireOwnership(user.id, user.role, stageId);
  if (ownershipError) return ownershipError;

  try {
    await getStorageBackend().deleteStage(stageId);

    // Eliminar propietat de la BD (deleteMany no llança si no existia)
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
    console.error('[DELETE /api/stages/[stageId]]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error esborrant stage.');
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { stageId } = await params;
  if (!isValidId(stageId)) return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');

  const ownershipError = await requireOwnership(user.id, user.role, stageId);
  if (ownershipError) return ownershipError;

  try {
    const { name } = await req.json();
    if (typeof name !== 'string' || !name.trim()) {
      return apiError('INVALID_REQUEST', 400, 'Nom invàlid.');
    }
    await getStorageBackend().renameStage(stageId, name.trim());

    const meta = extractRequestMeta(req);
    await auditLog({
      userId: user.id,
      action: 'COURSE_RENAMED',
      entityType: 'course',
      entityId: stageId,
      details: { newName: name.trim() },
      ...meta,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/stages/[stageId]]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error reanomenant stage.');
  }
}
