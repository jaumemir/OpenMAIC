import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { FilesystemBackend } from '@/lib/server/storage/filesystem';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

function isValidElementId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,128}$/.test(id);
}

type Params = Promise<{ stageId: string; elementId: string }>;

/**
 * GET /api/stages/[stageId]/media/[elementId]/poster
 * Serves the video poster image (JPEG).
 */
export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { stageId, elementId } = await params;
  if (!isValidId(stageId) || !isValidElementId(elementId)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const backend = new FilesystemBackend();
    const resolved = await backend.resolveMediaPath(stageId, elementId, true);
    if (!resolved) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const buffer = await fs.readFile(resolved.filePath);
    return new Response(buffer, {
      headers: {
        'Content-Type': resolved.mimeType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    console.error('[GET /api/stages/[stageId]/media/[elementId]/poster]', err);
    return NextResponse.json({ error: 'Failed to serve poster' }, { status: 500 });
  }
}
