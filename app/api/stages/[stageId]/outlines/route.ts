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
    const outlines = await getStorageBackend().loadOutlines(stageId);
    return NextResponse.json({ outlines: outlines ?? [] });
  } catch (err) {
    console.error('[GET /api/stages/[stageId]/outlines]', err);
    return NextResponse.json({ error: 'Failed to load outlines' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const { outlines } = await req.json();
    await getStorageBackend().saveOutlines(stageId, outlines);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/stages/[stageId]/outlines]', err);
    return NextResponse.json({ error: 'Failed to save outlines' }, { status: 500 });
  }
}
