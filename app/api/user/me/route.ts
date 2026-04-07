export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError } from '@/lib/server/api-response';

/** GET /api/user/me — retorna el perfil de l'usuari autenticat */
export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { firstName: true, lastName: true, organization: true, department: true, jobTitle: true, city: true },
  });

  if (!profile) {
    return apiError('NOT_FOUND', 404, 'Perfil no trobat.');
  }

  return NextResponse.json({ ...profile, email: user.email, role: user.role });
}
