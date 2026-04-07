export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';
import { requireAuth, apiError } from '@/lib/server/api-response';
import { NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  try {
    const backend = getStorageBackend();
    // Tothom (incl. admin) veu només els seus propis stages a la pantalla principal.
    // L'admin veu els de tots els usuaris al panell d'administració (/admin/courses).
    const stages = await backend.listStages({ userId: user.id });

    return NextResponse.json(stages);
  } catch (err) {
    console.error('[GET /api/stages]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error llistant stages.');
  }
}
