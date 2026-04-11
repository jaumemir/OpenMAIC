/**
 * GET /api/admin/config        — Llegeix configuració global
 * PUT /api/admin/config        — Actualitza configuració global
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Accés restringit a administradors.');
  }

  const configs = await prisma.adminConfig.findMany();
  const result: Record<string, unknown> = {};
  for (const c of configs) {
    try {
      result[c.key] = JSON.parse(c.value);
    } catch {
      result[c.key] = c.value;
    }
  }

  return apiSuccess({ config: result });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Accés restringit a administradors.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const updates = body as Record<string, unknown>;
  const allowedKeys = ['allowedModels'];
  const invalidKeys = Object.keys(updates).filter((k) => !allowedKeys.includes(k));
  if (invalidKeys.length > 0) {
    return apiError(
      'INVALID_REQUEST',
      400,
      `Claus de configuració no permeses: ${invalidKeys.join(', ')}.`,
    );
  }

  const meta = extractRequestMeta(req);
  const userId = (user as { id: string }).id;

  for (const [key, value] of Object.entries(updates)) {
    const existing = await prisma.adminConfig.findUnique({ where: { key } });
    const oldValue = existing ? JSON.parse(existing.value) : undefined;

    await prisma.adminConfig.upsert({
      where: { key },
      update: { value: JSON.stringify(value), updatedById: userId },
      create: { key, value: JSON.stringify(value), updatedById: userId },
    });

    await auditLog({
      userId,
      action: 'CONFIG_CHANGED',
      entityType: 'config',
      entityId: key,
      details: { old: oldValue, new: value },
      ...meta,
    });
  }

  return apiSuccess({ updated: Object.keys(updates) });
}
