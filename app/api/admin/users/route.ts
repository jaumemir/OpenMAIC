/**
 * GET  /api/admin/users — Llista usuaris (paginat)
 * POST /api/admin/users — Crea invitació i envia email ACS
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';
import { sendInvitationEmail } from '@/lib/email/acs';
import { VALID_LOCALES, defaultLocale, type Locale } from '@/lib/i18n';

// ── GET /api/admin/users ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden accedir a aquesta ruta.');
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { profile: true },
    }),
    prisma.user.count(),
  ]);

  return apiSuccess({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      status: u.status,
      createdAt: u.createdAt,
      firstName: u.profile?.firstName ?? null,
      lastName: u.profile?.lastName ?? null,
      organization: u.profile?.organization ?? null,
      department: u.profile?.department ?? null,
      jobTitle: u.profile?.jobTitle ?? null,
      city: u.profile?.city ?? null,
    })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

// ── POST /api/admin/users ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawLocale = req.cookies.get('locale')?.value;
  const locale: Locale = (VALID_LOCALES.includes(rawLocale as Locale) ? rawLocale : defaultLocale) as Locale;

  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Només els administradors poden convidar usuaris.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const { email, firstName, lastName } = body as Record<string, unknown>;

  if (!email || typeof email !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'El camp "email" és obligatori.');
  }
  if (!firstName || typeof firstName !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'El camp "firstName" és obligatori.');
  }
  if (!lastName || typeof lastName !== 'string') {
    return apiError('MISSING_REQUIRED_FIELD', 400, 'El camp "lastName" és obligatori.');
  }

  // Comprovar si ja existeix un usuari amb aquest email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return apiError('INVALID_REQUEST', 409, 'Ja existeix un usuari amb aquest correu electrònic.');
  }

  // Calcular TTL de la invitació
  const ttlHours = parseInt(process.env.INVITATION_TOKEN_TTL_HOURS ?? '24', 10);
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

  // Crear invitació a la BD
  const token = crypto.randomUUID();
  const invitation = await prisma.invitation.create({
    data: {
      email,
      firstName,
      lastName,
      token,
      expiresAt,
      invitedById: (user as { id: string }).id,
    },
  });

  // Construir URL d'acceptació
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
  const acceptUrl = `${appUrl}/accept-invite?token=${token}`;

  // Obtenir nom de l'admin per al template
  const inviterProfile = await prisma.userProfile.findUnique({
    where: { userId: (user as { id: string }).id },
  });
  const inviterName = inviterProfile
    ? `${inviterProfile.firstName} ${inviterProfile.lastName}`
    : (user as { email: string }).email;

  // Intentar enviar email ACS (si no hi ha config ACS, registra avís però no falla)
  let emailSent = false;
  try {
    await sendInvitationEmail({
      to: email,
      displayName: `${firstName} ${lastName}`,
      inviterName,
      acceptUrl,
      expiresInHours: ttlHours,
      locale,
    });
    emailSent = true;
  } catch (err) {
    console.warn('[api/admin/users] Email ACS no enviat:', err);
  }

  // Registrar auditoria
  const meta = extractRequestMeta(req);
  await auditLog({
    userId: (user as { id: string }).id,
    action: 'USER_INVITED',
    entityType: 'user',
    entityId: invitation.id,
    details: { email, firstName, lastName, emailSent },
    ...meta,
  });

  return apiSuccess(
    {
      invitation: {
        id: invitation.id,
        email: invitation.email,
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        expiresAt: invitation.expiresAt,
        acceptUrl,
        emailSent,
      },
    },
    201,
  );
}
