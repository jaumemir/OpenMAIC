// Re-export type from the shared location so existing imports keep working
export type { PlaybackSnapshot } from '@/lib/server/storage/types';
import type { PlaybackSnapshot } from '@/lib/server/storage/types';

export async function savePlaybackState(
  stageId: string,
  snapshot: PlaybackSnapshot,
): Promise<void> {
  await fetch(`/api/stages/${stageId}/playback`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
}

export async function loadPlaybackState(stageId: string): Promise<PlaybackSnapshot | null> {
  const res = await fetch(`/api/stages/${stageId}/playback`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export async function clearPlaybackState(stageId: string): Promise<void> {
  await fetch(`/api/stages/${stageId}/playback`, { method: 'DELETE' });
}
