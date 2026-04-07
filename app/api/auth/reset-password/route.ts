/**
 * GET  /api/auth/reset-password?token=xxx — Verifica token, retorna email
 * POST /api/auth/reset-password            — Canvia la contrasenya
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { apiError } from '@/lib/server/api-response';
import argon2 from 'argon2';

// ── GET: Validar token ────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');

  if (!token) {
    return apiError('INVALID_REQUEST', 400, "Falta el paràmetre 'token'.");
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { email: true, status: true } } },
  });

  if (!record || record.usedAt !== null) {
    return apiError('INVALID_REQUEST', 404, "L'enllaç no és vàlid o ja ha estat utilitzat.");
  }
  if (record.expiresAt < new Date()) {
    return apiError('INVALID_REQUEST', 410, "L'enllaç ha caducat. Sol·licita'n un de nou.");
  }

  return NextResponse.json({ ok: true, email: record.user.email });
}

// ── POST: Canviar contrasenya ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const { token, password } = body as Record<string, unknown>;

  if (!token || typeof token !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, "El camp 'token' és obligatori.");
  }
  if (!password || typeof password !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, "El camp 'password' és obligatori.");
  }
  if (password.length < 8) {
    return apiError('INVALID_REQUEST', 400, 'La contrasenya ha de tenir mínim 8 caràcters.');
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { token },
    include: { user: { select: { id: true, status: true } } },
  });

  if (!record || record.usedAt !== null) {
    return apiError('INVALID_REQUEST', 404, "L'enllaç no és vàlid o ja ha estat utilitzat.");
  }
  if (record.expiresAt < new Date()) {
    return apiError('INVALID_REQUEST', 410, "L'enllaç ha caducat. Sol·licita'n un de nou.");
  }
  if (record.user.status !== 'active') {
    return apiError('FORBIDDEN', 403, 'Aquest compte no és actiu.');
  }

  // Hash Argon2id (idèntic als paràmetres de la resta del sistema)
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  // Actualitzar contrasenya a l'Account de better-auth i marcar token com a usat
  await prisma.$transaction([
    prisma.account.updateMany({
      where: { userId: record.userId, providerId: 'credential' },
      data: { password: passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { token },
      data: { usedAt: new Date() },
    }),
    // Invalida totes les sessions actives (força re-login)
    prisma.session.deleteMany({ where: { userId: record.userId } }),
  ]);

  return NextResponse.json({ ok: true, message: 'Contrasenya canviada correctament.' });
}
