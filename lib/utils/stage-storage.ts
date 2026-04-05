/**
 * Stage Storage Manager
 *
 * Manages multiple stage data with an adapter that dispatches to either the
 * server API (NEXT_PUBLIC_STORAGE_BACKEND=server) or IndexedDB (legacy).
 *
 * Each stage has its own storage key based on stageId.
 */

import { isServerStorageEnabled } from './storage-backend';
import { createLogger } from '@/lib/logger';

const log = createLogger('StageStorage');

// Re-export types from the shared location so existing imports keep working
export type { StageStoreData, StageListItem } from '@/lib/server/storage/types';
import type { StageStoreData, StageListItem } from '@/lib/server/storage/types';

// ── Server-mode helpers ───────────────────────────────────────────────────────

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

// ── IndexedDB helpers (legacy) ────────────────────────────────────────────────

async function idbSaveStageData(stageId: string, data: StageStoreData): Promise<void> {
  const { db } = await import('./database');
  const { saveChatSessions } = await import('./chat-storage');
  const now = Date.now();

  await db.stages.put({
    id: stageId,
    name: data.stage.name || 'Untitled Stage',
    description: data.stage.description,
    createdAt: data.stage.createdAt || now,
    updatedAt: now,
    language: data.stage.language,
    style: data.stage.style,
    currentSceneId: data.currentSceneId || undefined,
    agentIds: data.stage.agentIds,
  });

  await db.scenes.where('stageId').equals(stageId).delete();

  if (data.scenes && data.scenes.length > 0) {
    await db.scenes.bulkPut(
      data.scenes.map((scene, index) => ({
        ...scene,
        stageId,
        order: scene.order ?? index,
        createdAt: scene.createdAt || now,
        updatedAt: scene.updatedAt || now,
      })),
    );
  }

  if (data.chats) {
    await saveChatSessions(stageId, data.chats);
  }
}

async function idbLoadStageData(stageId: string): Promise<StageStoreData | null> {
  const { db } = await import('./database');
  const { loadChatSessions } = await import('./chat-storage');

  const stage = await db.stages.get(stageId);
  if (!stage) return null;

  const scenes = await db.scenes.where('stageId').equals(stageId).sortBy('order');
  const chats = await loadChatSessions(stageId);

  return {
    stage,
    scenes,
    currentSceneId: stage.currentSceneId || scenes[0]?.id || null,
    chats,
  };
}

async function idbDeleteStageData(stageId: string): Promise<void> {
  const { db } = await import('./database');
  const { deleteChatSessions } = await import('./chat-storage');
  const { clearPlaybackState } = await import('./playback-storage');

  await db.stages.delete(stageId);
  await db.scenes.where('stageId').equals(stageId).delete();
  await deleteChatSessions(stageId);
  await clearPlaybackState(stageId);
}

async function idbListStages(): Promise<StageListItem[]> {
  const { db } = await import('./database');
  const stages = await db.stages.orderBy('updatedAt').reverse().toArray();

  return Promise.all(
    stages.map(async (stage) => {
      const sceneCount = await db.scenes.where('stageId').equals(stage.id).count();
      return {
        id: stage.id,
        name: stage.name,
        description: stage.description,
        sceneCount,
        createdAt: stage.createdAt,
        updatedAt: stage.updatedAt,
      };
    }),
  );
}

async function idbRenameStage(stageId: string, newName: string): Promise<void> {
  const { db } = await import('./database');
  await db.stages.update(stageId, { name: newName, updatedAt: Date.now() });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save stage data (stage metadata, scenes, and chat sessions).
 */
export async function saveStageData(stageId: string, data: StageStoreData): Promise<void> {
  try {
    if (isServerStorageEnabled()) {
      await serverSaveStageData(stageId, data);
    } else {
      await idbSaveStageData(stageId, data);
    }
    log.info(`Saved stage: ${stageId}`);
  } catch (error) {
    log.error('Failed to save stage:', error);
    throw error;
  }
}

/**
 * Load stage data (stage metadata, scenes, and chat sessions).
 */
export async function loadStageData(stageId: string): Promise<StageStoreData | null> {
  try {
    const data = isServerStorageEnabled()
      ? await serverLoadStageData(stageId)
      : await idbLoadStageData(stageId);

    if (data) {
      log.info(`Loaded stage: ${stageId}, scenes: ${data.scenes.length}, chats: ${data.chats.length}`);
    } else {
      log.info(`Stage not found: ${stageId}`);
    }
    return data;
  } catch (error) {
    log.error('Failed to load stage:', error);
    return null;
  }
}

/**
 * Delete stage and all related data.
 */
export async function deleteStageData(stageId: string): Promise<void> {
  try {
    if (isServerStorageEnabled()) {
      await serverDeleteStageData(stageId);
    } else {
      await idbDeleteStageData(stageId);
    }
    log.info(`Deleted stage: ${stageId}`);
  } catch (error) {
    log.error('Failed to delete stage:', error);
    throw error;
  }
}

/**
 * List all stages.
 */
export async function listStages(): Promise<StageListItem[]> {
  try {
    return isServerStorageEnabled() ? serverListStages() : idbListStages();
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

  if (isServerStorageEnabled()) {
    // Server mode: fetch scenes from API; replace placeholders with HTTP URLs
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
            if (
              el.type === 'image' &&
              /^gen_(img|vid)_[\w-]+$/i.test(el.src)
            ) {
              // Use HTTP URL directly — no blob / createObjectURL needed
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

  // IndexedDB mode (original implementation)
  try {
    const { db } = await import('./database');
    await Promise.all(
      stageIds.map(async (stageId) => {
        const scenes = await db.scenes.where('stageId').equals(stageId).sortBy('order');
        const firstSlide = scenes.find((s) => s.content?.type === 'slide');
        if (firstSlide && firstSlide.content.type === 'slide') {
          const slide = structuredClone(firstSlide.content.canvas);

          // Resolve gen_img_* placeholders from mediaFiles
          const placeholderEls = slide.elements.filter(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (el: any) => el.type === 'image' && /^gen_(img|vid)_[\w-]+$/i.test(el.src as string),
          );
          if (placeholderEls.length > 0) {
            const mediaRecords = await db.mediaFiles.where('stageId').equals(stageId).toArray();
            const mediaMap = new Map(
              mediaRecords.map((r) => {
                const elementId = r.id.includes(':') ? r.id.split(':').slice(1).join(':') : r.id;
                return [elementId, r.blob] as const;
              }),
            );
            for (const el of placeholderEls as Array<{ src: string }>) {
              const blob = mediaMap.get(el.src);
              if (blob) {
                el.src = URL.createObjectURL(blob);
              } else {
                el.src = '';
              }
            }
          }

          result[stageId] = slide;
        }
      }),
    );
  } catch (error) {
    log.error('Failed to load thumbnails:', error);
  }
  return result;
}

/**
 * Rename a stage.
 */
export async function renameStage(stageId: string, newName: string): Promise<void> {
  try {
    if (isServerStorageEnabled()) {
      await serverRenameStage(stageId, newName);
    } else {
      await idbRenameStage(stageId, newName);
    }
    log.info(`Renamed stage ${stageId} to "${newName}"`);
  } catch (error) {
    log.error('Failed to rename stage:', error);
    throw error;
  }
}

/**
 * Check if stage exists.
 */
export async function stageExists(stageId: string): Promise<boolean> {
  try {
    if (isServerStorageEnabled()) {
      const res = await fetch(`/api/stages/${stageId}`);
      return res.ok;
    }
    const { db } = await import('./database');
    const stage = await db.stages.get(stageId);
    return !!stage;
  } catch (error) {
    log.error('Failed to check stage existence:', error);
    return false;
  }
}
