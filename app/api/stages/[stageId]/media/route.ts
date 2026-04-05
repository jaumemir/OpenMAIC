import { NextRequest, NextResponse } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// gen_img_* and gen_vid_* element IDs used by the media store
function isValidElementId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

type Params = Promise<{ stageId: string }>;

/**
 * GET /api/stages/[stageId]/media
 * Returns the list of media metadata records for a stage (no blobs).
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const records = await getStorageBackend().listMedia(stageId);
    return NextResponse.json(records);
  } catch (err) {
    console.error('[GET /api/stages/[stageId]/media]', err);
    return NextResponse.json({ error: 'Failed to list media' }, { status: 500 });
  }
}

/**
 * POST /api/stages/[stageId]/media
 * Body: { elementId, base64, posterBase64?, meta: { type, mimeType, size, prompt, params, error?, errorCode? } }
 * Stores the media blob (and optional poster) server-side.
 */
export async function POST(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const body = await req.json();
    const { elementId, base64, posterBase64, meta } = body;

    if (!isValidElementId(elementId) || typeof base64 !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const buffer = Buffer.from(base64, 'base64');
    const posterBuffer = posterBase64 ? Buffer.from(posterBase64, 'base64') : null;
    const backend = getStorageBackend();

    await backend.saveMedia(stageId, elementId, buffer, posterBuffer, {
      type: meta.type,
      mimeType: meta.mimeType,
      size: buffer.length,
      prompt: meta.prompt ?? '',
      params: meta.params ?? '{}',
      error: meta.error,
      errorCode: meta.errorCode,
      createdAt: meta.createdAt ?? Date.now(),
    });

    return NextResponse.json({
      ok: true,
      url: backend.getMediaUrl(stageId, elementId),
      posterUrl: posterBuffer ? backend.getPosterUrl(stageId, elementId) : undefined,
    });
  } catch (err) {
    console.error('[POST /api/stages/[stageId]/media]', err);
    return NextResponse.json({ error: 'Failed to save media' }, { status: 500 });
  }
}
