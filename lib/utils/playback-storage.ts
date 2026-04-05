/**
 * Playback Storage - Persist playback engine state.
 *
 * In server mode (NEXT_PUBLIC_STORAGE_BACKEND=server):
 *   State is stored via the server API at /api/stages/[stageId]/playback.
 *
 * In IndexedDB mode (legacy):
 *   State is stored in the playbackState table.
 */

import { isServerStorageEnabled } from './storage-backend';

// Re-export type from the shared location so existing imports keep working
export type { PlaybackSnapshot } from '@/lib/server/storage/types';
import type { PlaybackSnapshot } from '@/lib/server/storage/types';

/**
 * Save playback state for a stage.
 */
export async function savePlaybackState(
  stageId: string,
  snapshot: PlaybackSnapshot,
): Promise<void> {
  if (isServerStorageEnabled()) {
    await fetch(`/api/stages/${stageId}/playback`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    });
    return;
  }

  const { db } = await import('./database');
  await db.playbackState.put({
    stageId,
    sceneIndex: snapshot.sceneIndex,
    actionIndex: snapshot.actionIndex,
    consumedDiscussions: snapshot.consumedDiscussions,
    sceneId: snapshot.sceneId,
    updatedAt: Date.now(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Load playback state for a stage.
 */
export async function loadPlaybackState(stageId: string): Promise<PlaybackSnapshot | null> {
  if (isServerStorageEnabled()) {
    const res = await fetch(`/api/stages/${stageId}/playback`);
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return res.json();
  }

  const { db } = await import('./database');
  const record = await db.playbackState.get(stageId);
  if (!record) return null;

  return {
    sceneIndex: record.sceneIndex,
    actionIndex: record.actionIndex,
    consumedDiscussions: record.consumedDiscussions,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sceneId: (record as any).sceneId as string | undefined,
  };
}

/**
 * Clear playback state for a stage.
 */
export async function clearPlaybackState(stageId: string): Promise<void> {
  if (isServerStorageEnabled()) {
    await fetch(`/api/stages/${stageId}/playback`, { method: 'DELETE' });
    return;
  }

  const { db } = await import('./database');
  await db.playbackState.delete(stageId);
}
