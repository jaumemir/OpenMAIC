/**
 * POST /api/invitations/accept — Accepta una invitació i crea el compte d'usuari.
 *
 * Flux:
 * 1. Valida token (existeix, no expirat, no usat)
 * 2. Crea User + UserProfile + Account (argon2id hash) en transacció
 * 3. Marca invitació com usada
 * 4. Retorna { success, user } — l'usuari fa login manualment a /login
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';
import argon2 from 'argon2';
import { v4 as uuidv4 } from 'uuid';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const { token, password, organization, department, jobTitle, city } =
    body as Record<string, unknown>;

  if (!token || typeof token !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'El token d\'invitació és obligatori.');
  }
  if (!password || typeof password !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'La contrasenya és obligatòria.');
  }
  if (password.length < 8) {
    return apiError('INVALID_REQUEST', 400, 'La contrasenya ha de tenir mínim 8 caràcters.');
  }

  // 1. Validar el token
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

  // Comprovar que no existeix ja un usuari amb aquest email
  const existingUser = await prisma.user.findUnique({ where: { email: invitation.email } });
  if (existingUser) {
    return apiError('INVALID_REQUEST', 409, 'Ja existeix un compte amb aquest correu electrònic.');
  }

  // 2. Crear User + UserProfile + Account en transacció
  const userId = uuidv4();
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await prisma.$transaction(async (tx) => {
    await tx.user.create({
      data: {
        id: userId,
        email: invitation.email,
        role: 'user',
        status: 'active',
        profile: {
          create: {
            firstName: invitation.firstName,
            lastName: invitation.lastName,
            organization: typeof organization === 'string' ? organization : null,
            department: typeof department === 'string' ? department : null,
            jobTitle: typeof jobTitle === 'string' ? jobTitle : null,
            city: typeof city === 'string' ? city : null,
          },
        },
      },
    });

    await tx.account.create({
      data: {
        id: uuidv4(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
      },
    });

    // 3. Marcar invitació com usada
    await tx.invitation.update({
      where: { id: invitation.id },
      data: { usedAt: new Date() },
    });
  });

  // 4. Auditoria d'activació
  const meta = extractRequestMeta(req);
  await auditLog({
    userId,
    action: 'USER_ACTIVATED',
    entityType: 'user',
    entityId: userId,
    details: { invitationId: invitation.id, email: invitation.email },
    ...meta,
  });

  // 5. Retornar èxit — l'usuari farà login manualment a /login
  return apiSuccess({ user: { email: invitation.email } });
}
