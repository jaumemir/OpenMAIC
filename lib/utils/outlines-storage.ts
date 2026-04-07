import type { SceneOutline } from '@/lib/types/generation';

export async function saveOutlines(stageId: string, outlines: SceneOutline[]): Promise<void> {
  await fetch(`/api/stages/${stageId}/outlines`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ outlines }),
  });
}

export async function loadOutlines(stageId: string): Promise<SceneOutline[]> {
  const res = await fetch(`/api/stages/${stageId}/outlines`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.outlines ?? [];
}
