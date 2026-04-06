/**
 * PATCH  /api/admin/users/[userId] — Canviar rol o estat
 * DELETE /api/admin/users/[userId] — Esborrar usuari
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';

type Params = { params: Promise<{ userId: string }> };

// ── PATCH /api/admin/users/[userId] ───────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const currentUser = await requireAuth(req);
  if ('status' in currentUser && currentUser instanceof Response) return currentUser;
  if ((currentUser as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden modificar usuaris.');
  }

  const { userId } = await params;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return apiError('NOT_FOUND', 404, 'Usuari no trobat.');
  }

  // No permetre canviar el propi rol (per evitar bloquejos)
  if (userId === (currentUser as { id: string }).id) {
    return apiError('INVALID_REQUEST', 400, 'No pots modificar el teu propi rol.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const { role, status } = body as Record<string, unknown>;
  const allowedRoles = ['admin', 'user'];
  const allowedStatuses = ['active', 'pending'];

  const updates: Record<string, string> = {};
  if (role !== undefined) {
    if (typeof role !== 'string' || !allowedRoles.includes(role)) {
      return apiError('INVALID_REQUEST', 400, `Rol invàlid. Valors permesos: ${allowedRoles.join(', ')}.`);
    }
    updates.role = role;
  }
  if (status !== undefined) {
    if (typeof status !== 'string' || !allowedStatuses.includes(status)) {
      return apiError('INVALID_REQUEST', 400, `Estat invàlid. Valors permesos: ${allowedStatuses.join(', ')}.`);
    }
    updates.status = status;
  }

  if (Object.keys(updates).length === 0) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'Cal especificar "role" o "status".');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: updates,
  });

  const meta = extractRequestMeta(req);
  if (role !== undefined && role !== target.role) {
    await auditLog({
      userId: (currentUser as { id: string }).id,
      action: 'USER_ROLE_CHANGED',
      entityType: 'user',
      entityId: userId,
      details: { old: target.role, new: role },
      ...meta,
    });
  }

  return apiSuccess({ user: { id: updated.id, email: updated.email, role: updated.role, status: updated.status } });
}

// ── DELETE /api/admin/users/[userId] ──────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const currentUser = await requireAuth(req);
  if ('status' in currentUser && currentUser instanceof Response) return currentUser;
  if ((currentUser as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden esborrar usuaris.');
  }

  const { userId } = await params;

  if (userId === (currentUser as { id: string }).id) {
    return apiError('INVALID_REQUEST', 400, 'No pots esborrar el teu propi compte.');
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return apiError('NOT_FOUND', 404, 'Usuari no trobat.');
  }

  const meta = extractRequestMeta(req);
  // Registrar ABANS d'esborrar (userId → SetNull post-esborrat)
  await auditLog({
    userId: (currentUser as { id: string }).id,
    action: 'USER_DELETED',
    entityType: 'user',
    entityId: userId,
    details: { email: target.email, role: target.role },
    ...meta,
  });

  await prisma.user.delete({ where: { id: userId } });

  return apiSuccess({ deleted: true });
}
