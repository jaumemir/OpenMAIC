/**
 * audit.ts — Helper central per registrar accions a AuditLog.
 *
 * Totes les accions que provoquen canvi d'estat han de cridar `auditLog()`.
 * Els registres sobreviuen a l'esborrat d'usuaris (userId → SetNull).
 */

import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@/lib/prisma';

// ── Tipus d'acció auditables ───────────────────────────────────────────────

export type AuditAction =
  // Cursos / stages
  | 'COURSE_GENERATED'
  | 'COURSE_DELETED'
  | 'COURSE_RENAMED'
  | 'COURSE_SAVED'
  | 'VOICE_REGENERATED'
  | 'GENERATION_JOB_FAILED'
  // Sessions
  | 'USER_LOGIN'
  | 'USER_LOGOUT'
  // Gestió d'usuaris (admin)
  | 'USER_INVITED'
  | 'USER_ACTIVATED'
  | 'USER_DELETED'
  | 'USER_ROLE_CHANGED'
  | 'USER_DISABLED'
  | 'USER_ENABLED'
  | 'USER_PROFILE_UPDATED'
  // Configuració (admin)
  | 'CONFIG_CHANGED';

// ── Paràmetres del log ─────────────────────────────────────────────────────

export interface AuditLogParams {
  /** null = acció de sistema (p.ex. job completat sense sessió activa) */
  userId?: string | null;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  /** Informació addicional (canvis old/new, resum d'input, etc.) */
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

// ── Funció principal ───────────────────────────────────────────────────────

/**
 * Registra una entrada al log d'auditoria.
 * Mai llança error: els errors d'escriptura es silencien per no bloquejar
 * el flux principal (la fallada de l'audit no ha d'abortar l'operació).
 */
export async function auditLog(
  params: AuditLogParams,
  db: PrismaClient = defaultPrisma,
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
      },
    });
  } catch (err) {
    // Silencia els errors d'auditoria — no han d'interrompre el flux
    console.error('[audit] Error escrivint al log:', err);
  }
}

// ── Helper per extreure IP i User-Agent d'una Request ─────────────────────

export function extractRequestMeta(req: Request): {
  ipAddress?: string;
  userAgent?: string;
} {
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    undefined;
  const userAgent = req.headers.get('user-agent') ?? undefined;
  return { ipAddress, userAgent };
}
