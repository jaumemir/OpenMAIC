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
    // Admins veuen tots els stages; usuaris només els seus
    const stages =
      user.role === 'admin'
        ? await backend.listStages()
        : await backend.listStages({ userId: user.id });

    return NextResponse.json(stages);
  } catch (err) {
    console.error('[GET /api/stages]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error llistant stages.');
  }
}
