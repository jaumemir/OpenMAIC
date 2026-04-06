export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';
import { requireAuth, requireOwnership, apiError } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

type Params = { params: Promise<{ stageId: string }> };

/**
 * POST /api/stages/[stageId]/audio
 * Body: { audioId: string, base64: string, format: string }
 * Stores the audio blob server-side and returns the serving URL.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const user = await requireAuth(req);
  if (user instanceof NextResponse) return user;

  const { stageId } = await params;
  if (!isValidId(stageId)) return apiError('INVALID_REQUEST', 400, 'stageId invàlid.');

  const ownershipError = await requireOwnership(user.id, user.role, stageId);
  if (ownershipError) return ownershipError;

  try {
    const { audioId, base64, format } = await req.json();

    if (
      typeof audioId !== 'string' ||
      !isValidId(audioId) ||
      typeof base64 !== 'string' ||
      typeof format !== 'string' ||
      !/^[a-z0-9]+$/i.test(format)
    ) {
      return apiError('INVALID_REQUEST', 400, 'Payload invàlid.');
    }

    const buffer = Buffer.from(base64, 'base64');
    const backend = getStorageBackend();
    await backend.saveAudio(stageId, audioId, buffer, format);
    const url = backend.getAudioUrl(stageId, audioId);

    const meta = extractRequestMeta(req);
    await auditLog({
      userId: user.id,
      action: 'VOICE_REGENERATED',
      entityType: 'course',
      entityId: stageId,
      details: { audioId },
      ...meta,
    });

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[POST /api/stages/[stageId]/audio]', err);
    return apiError('INTERNAL_ERROR', 500, 'Error desant àudio.');
  }
}
