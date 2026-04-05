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
    const data = await getStorageBackend().loadStage(stageId);
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    console.error('[GET /api/stages/[stageId]]', err);
    return NextResponse.json({ error: 'Failed to load stage' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const data = await req.json();
    await getStorageBackend().saveStage(stageId, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PUT /api/stages/[stageId]]', err);
    return NextResponse.json({ error: 'Failed to save stage' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    await getStorageBackend().deleteStage(stageId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/stages/[stageId]]', err);
    return NextResponse.json({ error: 'Failed to delete stage' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const { stageId } = await params;
  if (!isValidId(stageId)) return NextResponse.json({ error: 'Invalid stageId' }, { status: 400 });

  try {
    const { name } = await req.json();
    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    await getStorageBackend().renameStage(stageId, name.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/stages/[stageId]]', err);
    return NextResponse.json({ error: 'Failed to rename stage' }, { status: 500 });
  }
}
