/**
 * Outlines Storage - Persist stage outlines for resume-on-refresh.
 *
 * In server mode (NEXT_PUBLIC_STORAGE_BACKEND=server):
 *   Outlines are stored via the server API at /api/stages/[stageId]/outlines.
 *
 * In IndexedDB mode (legacy):
 *   Outlines are stored in the stageOutlines table.
 */

import type { SceneOutline } from '@/lib/types/generation';
import { isServerStorageEnabled } from './storage-backend';

export async function saveOutlines(stageId: string, outlines: SceneOutline[]): Promise<void> {
  if (isServerStorageEnabled()) {
    await fetch(`/api/stages/${stageId}/outlines`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ outlines }),
    });
    return;
  }

  const { db } = await import('./database');
  await db.stageOutlines.put({
    stageId,
    outlines,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
}

export async function loadOutlines(stageId: string): Promise<SceneOutline[]> {
  if (isServerStorageEnabled()) {
    const res = await fetch(`/api/stages/${stageId}/outlines`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.outlines ?? [];
  }

  const { db } = await import('./database');
  const record = await db.stageOutlines.get(stageId);
  return record?.outlines ?? [];
}
