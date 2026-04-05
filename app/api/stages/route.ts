import { NextResponse } from 'next/server';
import { getStorageBackend } from '@/lib/server/storage';

export async function GET() {
  try {
    const backend = getStorageBackend();
    const stages = await backend.listStages();
    return NextResponse.json(stages);
  } catch (err) {
    console.error('[GET /api/stages]', err);
    return NextResponse.json({ error: 'Failed to list stages' }, { status: 500 });
  }
}
