import { NextRequest, NextResponse } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';

function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

type Params = Promise<{ stageId: string }>;

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const snapshot = await getStorageBackend().loadPlayback(stageId);
    if (!snapshot) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error('[GET /api/stages/[stageId]/playback]', err);
    return NextResponse.json({ error: 'Failed to load playback' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const snapshot = await req.json();
    await getStorageBackend().savePlayback(stageId, snapshot);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/stages/[stageId]/playback]', err);
    return NextResponse.json({ error: 'Failed to save playback' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    await getStorageBackend().clearPlayback(stageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/stages/[stageId]/playback]', err);
    return NextResponse.json({ error: 'Failed to clear playback' }, { status: 500 });
  }
}
