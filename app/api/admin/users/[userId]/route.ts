/**
 * PATCH  /api/admin/users/[userId] — Canviar rol, estat o camps de perfil
 * DELETE /api/admin/users/[userId] — Esborrar usuari
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';
import { createLogger } from '@/lib/logger';

const log = createLogger('AdminUsers API');

type Params = { params: Promise<{ userId: string }> };

const ALLOWED_ROLES = ['admin', 'user'];
const ALLOWED_STATUSES = ['active', 'pending', 'inactive'];
const PROFILE_FIELDS = ['firstName', 'lastName', 'organization', 'department', 'jobTitle', 'city'] as const;

// ── PATCH /api/admin/users/[userId] ───────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const currentUser = await requireAuth(req);
  if ('status' in currentUser && currentUser instanceof Response) return currentUser;
  if ((currentUser as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden modificar usuaris.');
  }

  const { userId } = await params;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!target) {
    return apiError('NOT_FOUND', 404, 'Usuari no trobat.');
  }

  if (userId === (currentUser as { id: string }).id) {
    return apiError('INVALID_REQUEST', 400, 'No pots modificar el teu propi compte des del panell.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const payload = body as Record<string, unknown>;
  const { role, status } = payload;
  const meta = extractRequestMeta(req);

  // ── Canvis de rol/estat ──────────────────────────────────────────────────
  const userUpdates: Record<string, string> = {};
  if (role !== undefined) {
    if (typeof role !== 'string' || !ALLOWED_ROLES.includes(role)) {
      return apiError('INVALID_REQUEST', 400, `Rol invàlid. Permesos: ${ALLOWED_ROLES.join(', ')}.`);
    }
    userUpdates.role = role;
  }
  if (status !== undefined) {
    if (typeof status !== 'string' || !ALLOWED_STATUSES.includes(status)) {
      return apiError('INVALID_REQUEST', 400, `Estat invàlid. Permesos: ${ALLOWED_STATUSES.join(', ')}.`);
    }
    userUpdates.status = status;
  }

  // ── Camps de perfil editables ────────────────────────────────────────────
  const profileUpdates: Record<string, string | null> = {};
  for (const field of PROFILE_FIELDS) {
    if (field in payload) {
      const val = payload[field];
      profileUpdates[field] = typeof val === 'string' ? val : null;
    }
  }

  const hasUserChanges = Object.keys(userUpdates).length > 0;
  const hasProfileChanges = Object.keys(profileUpdates).length > 0;

  if (!hasUserChanges && !hasProfileChanges) {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'Cap camp a actualitzar.');
  }

  // ── Aplicar canvis ───────────────────────────────────────────────────────
  const [updated] = await Promise.all([
    hasUserChanges ? prisma.user.update({ where: { id: userId }, data: userUpdates }) : Promise.resolve(target),
    hasProfileChanges
      ? prisma.userProfile.upsert({
          where: { userId },
          update: profileUpdates,
          create: {
            userId,
            firstName: (profileUpdates.firstName ?? target.profile?.firstName) || '',
            lastName: (profileUpdates.lastName ?? target.profile?.lastName) || '',
            ...profileUpdates,
          },
        })
      : Promise.resolve(null),
  ]);

  // Invalida sessions si l'usuari queda inactiu
  if (status === 'inactive') {
    await prisma.session.deleteMany({ where: { userId } }).catch((err) => {
      log.error(`No s'han pogut invalidar les sessions de l'usuari ${userId}:`, err);
    });
  }

  // ── Auditoria ────────────────────────────────────────────────────────────
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
  if (status !== undefined && status !== target.status) {
    await auditLog({
      userId: (currentUser as { id: string }).id,
      action: status === 'inactive' ? 'USER_DISABLED' : 'USER_ENABLED',
      entityType: 'user',
      entityId: userId,
      details: { old: target.status, new: status },
      ...meta,
    });
  }
  if (hasProfileChanges) {
    await auditLog({
      userId: (currentUser as { id: string }).id,
      action: 'USER_PROFILE_UPDATED',
      entityType: 'user',
      entityId: userId,
      details: { changes: profileUpdates },
      ...meta,
    });
  }

  // Recarregar perfil per retornar dades actualitzades
  const finalProfile = await prisma.userProfile.findUnique({ where: { userId } });

  return apiSuccess({
    user: {
      id: (updated as typeof target).id,
      email: (updated as typeof target).email,
      role: (updated as typeof target).role,
      status: (updated as typeof target).status,
      firstName: finalProfile?.firstName ?? null,
      lastName: finalProfile?.lastName ?? null,
      organization: finalProfile?.organization ?? null,
      department: finalProfile?.department ?? null,
      jobTitle: finalProfile?.jobTitle ?? null,
      city: finalProfile?.city ?? null,
    },
  });
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
