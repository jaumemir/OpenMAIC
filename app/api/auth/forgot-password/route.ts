/**
 * POST /api/auth/forgot-password
 *
 * Sempre retorna 202 independentment de si l'email existeix o no
 * (protecció contra enumeració d'usuaris).
 *
 * Flux:
 * 1. Busca l'usuari per email
 * 2. Si no existeix o status != 'active' → retorna 202 sense fer res
 * 3. Invalida tokens anteriors actius
 * 4. Crea token UUID (1h TTL)
 * 5. Envia email ACS
 * 6. Retorna 202
 */
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPasswordResetEmail } from '@/lib/email/acs';
import { VALID_LOCALES, defaultLocale, type Locale } from '@/lib/i18n';

const TOKEN_TTL_HOURS = parseInt(process.env.PASSWORD_RESET_TOKEN_TTL_HOURS ?? '1', 10);

// Resposta genèrica idèntica per a tots els casos (anti-enumeració)
const GENERIC_RESPONSE = {
  ok: true,
  message:
    'Si el correu electrònic és vàlid, rebràs un missatge amb instruccions per canviar la contrasenya.',
};

export async function POST(req: NextRequest) {
  const rawLocale = req.cookies.get('locale')?.value;
  const locale: Locale = (VALID_LOCALES.includes(rawLocale as Locale) ? rawLocale : defaultLocale) as Locale;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
  }

  const email =
    typeof (body as Record<string, unknown>).email === 'string'
      ? ((body as Record<string, unknown>).email as string).trim().toLowerCase()
      : null;

  if (!email) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
  }

  // Operació en background — el client no espera que acabi
  (async () => {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
        include: { profile: true },
      });

      // Anti-enumeració: si no existeix o no és actiu, no fem res
      if (!user || user.status !== 'active') {
        if (!user) {
          console.info(`[forgot-password] Email inexistent: ${email}`);
        } else {
          console.info(`[forgot-password] Usuari no actiu (status=${user.status}): ${user.id}`);
        }
        return;
      }

      // Invalidar tokens anteriors actius del mateix usuari
      await prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      // Crear nou token (UUID v4 + TTL)
      const token = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + TOKEN_TTL_HOURS * 60 * 60 * 1000);
      await prisma.passwordResetToken.create({
        data: { token, userId: user.id, expiresAt },
      });

      const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
      const resetUrl = `${appUrl}/reset-password?token=${token}`;

      // Enviar email (si no hi ha ACS configurat, log en dev)
      const firstName = user.profile?.firstName ?? '';
      try {
        await sendPasswordResetEmail({
          to: email,
          firstName,
          resetUrl,
          expiresInHours: TOKEN_TTL_HOURS,
          locale,
        });
      } catch {
        // Dev sense ACS: mostra l'URL als logs del servidor
        console.info(`[forgot-password] *** URL reset (dev, ACS no configurat): ${resetUrl} ***`);
      }
    } catch (err) {
      console.error('[forgot-password] Error intern:', err);
    }
  })();

  return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
}
