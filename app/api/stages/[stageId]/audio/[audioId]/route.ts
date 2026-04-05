import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { FilesystemBackend } from '@/lib/server/storage/filesystem';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
};

type Params = Promise<{ stageId: string; audioId: string }>;

/**
 * GET /api/stages/[stageId]/audio/[audioId]
 * Serves the audio file with the correct Content-Type.
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { stageId, audioId } = await params;
  if (!isValidId(stageId) || !isValidId(audioId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const backend = new FilesystemBackend();
    const resolved = await backend.resolveAudioPath(stageId, audioId);
    if (!resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const buffer = await fs.readFile(resolved.filePath);
    const mimeType = AUDIO_MIME[resolved.format] ?? 'audio/mpeg';

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[GET /api/stages/[stageId]/audio/[audioId]]', err);
    return NextResponse.json({ error: 'Failed to serve audio' }, { status: 500 });
  }
}
