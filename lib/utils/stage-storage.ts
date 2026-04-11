/**
 * Stage Storage Manager
 *
 * Manages stage data via the server API.
 * Each stage has its own storage key based on stageId.
 */

import { createLogger } from '@/lib/logger';

const log = createLogger('StageStorage');

// Re-export types from the shared location so existing imports keep working
export type { StageStoreData, StageListItem } from '@/lib/server/storage/types';
import type { StageStoreData, StageListItem } from '@/lib/server/storage/types';

// ── Server API helpers ────────────────────────────────────────────────────────

async function serverSaveStageData(stageId: string, data: StageStoreData): Promise<void> {
  const res = await fetch(`/api/stages/${stageId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`saveStage failed: ${res.status}`);
}

async function serverLoadStageData(stageId: string): Promise<StageStoreData | null> {
  const res = await fetch(`/api/stages/${stageId}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`loadStage failed: ${res.status}`);
  return res.json();
}

async function serverDeleteStageData(stageId: string): Promise<void> {
  const res = await fetch(`/api/stages/${stageId}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`deleteStage failed: ${res.status}`);
}

async function serverListStages(): Promise<StageListItem[]> {
  const res = await fetch('/api/stages');
  if (!res.ok) throw new Error(`listStages failed: ${res.status}`);
  return res.json();
}

async function serverRenameStage(stageId: string, newName: string): Promise<void> {
  const res = await fetch(`/api/stages/${stageId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newName }),
  });
  if (!res.ok) throw new Error(`renameStage failed: ${res.status}`);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function saveStageData(stageId: string, data: StageStoreData): Promise<void> {
  try {
    await serverSaveStageData(stageId, data);
    log.info(`Saved stage: ${stageId}`);
  } catch (error) {
    log.error('Failed to save stage:', error);
    throw error;
  }
}

export async function loadStageData(stageId: string): Promise<StageStoreData | null> {
  try {
    const data = await serverLoadStageData(stageId);
    if (data) {
      log.info(
        `Loaded stage: ${stageId}, scenes: ${data.scenes.length}, chats: ${data.chats.length}`,
      );
    } else {
      log.info(`Stage not found: ${stageId}`);
    }
    return data;
  } catch (error) {
    log.error('Failed to load stage:', error);
    return null;
  }
}

export async function deleteStageData(stageId: string): Promise<void> {
  try {
    await serverDeleteStageData(stageId);
    log.info(`Deleted stage: ${stageId}`);
  } catch (error) {
    log.error('Failed to delete stage:', error);
    throw error;
  }
}

export async function listStages(): Promise<StageListItem[]> {
  try {
    return serverListStages();
  } catch (error) {
    log.error('Failed to list stages:', error);
    return [];
  }
}

/**
 * Get first slide scene's canvas data for each stage (for thumbnail preview).
 * Also resolves gen_img_* / gen_vid_* placeholders so thumbnails show real images.
 * Returns a map of stageId -> Slide (canvas data with resolved images).
 */
export async function getFirstSlideByStages(
  stageIds: string[],
): Promise<Record<string, import('../types/slides').Slide>> {
  const result: Record<string, import('../types/slides').Slide> = {};

  await Promise.all(
    stageIds.map(async (stageId) => {
      try {
        const data = await serverLoadStageData(stageId);
        if (!data) return;
        const scenes = [...data.scenes].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const firstSlide = scenes.find((s) => s.content?.type === 'slide');
        if (!firstSlide || firstSlide.content.type !== 'slide') return;

        const slide = structuredClone(firstSlide.content.canvas);
        for (const el of slide.elements as Array<{ type: string; src: string }>) {
          if (el.type === 'image' && /^gen_(img|vid)_[\w-]+$/i.test(el.src)) {
            el.src = `/api/stages/${stageId}/media/${el.src}`;
          }
        }
        result[stageId] = slide;
      } catch {
        // ignore per-stage errors
      }
    }),
  );

  return result;
}

export async function renameStage(stageId: string, newName: string): Promise<void> {
  try {
    await serverRenameStage(stageId, newName);
    log.info(`Renamed stage ${stageId} to "${newName}"`);
  } catch (error) {
    log.error('Failed to rename stage:', error);
    throw error;
  }
}

export async function stageExists(stageId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/stages/${stageId}`);
    return res.ok;
  } catch (error) {
    log.error('Failed to check stage existence:', error);
    return false;
  }
}
