import { NextRequest, NextResponse } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

type Params = Promise<{ stageId: string }>;

/**
 * POST /api/stages/[stageId]/audio
 * Body: { audioId: string, base64: string, format: string }
 * Stores the audio blob server-side and returns the serving URL.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const { audioId, base64, format } = await req.json();

    if (
      typeof audioId !== 'string' ||
      !isValidId(audioId) ||
      typeof base64 !== 'string' ||
      typeof format !== 'string' ||
      !/^[a-z0-9]+$/i.test(format)
    ) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const buffer = Buffer.from(base64, 'base64');
    const backend = getStorageBackend();
    await backend.saveAudio(stageId, audioId, buffer, format);
    const url = backend.getAudioUrl(stageId, audioId);

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    console.error('[POST /api/stages/[stageId]/audio]', err);
    return NextResponse.json({ error: 'Failed to save audio' }, { status: 500 });
  }
}
