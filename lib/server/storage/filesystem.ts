/**
 * FilesystemBackend — server-side storage backed by the local filesystem.
 *
 * Intended for local / Docker development only.
 * All stage data lives under:  data/stages/{stageId}/
 *
 * Production will use AzureBlobBackend (same StorageBackend interface).
 */

import { promises as fs } from 'fs';
import path from 'path';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';
import type {
  StorageBackend,
  StageStoreData,
  StageListItem,
  StageListOptions,
  PlaybackSnapshot,
  MediaMeta,
} from './types';
import type { SceneOutline } from '@/lib/types/generation';
import { prisma } from '@/lib/prisma';

export const STAGES_DIR = path.join(process.cwd(), 'data', 'stages');

// ── Path helpers ─────────────────────────────────────────────────────────────

function stageDir(stageId: string): string {
  return path.join(STAGES_DIR, stageId);
}

function stagePath(stageId: string): string {
  return path.join(stageDir(stageId), 'stage.json');
}

function playbackPath(stageId: string): string {
  return path.join(stageDir(stageId), 'playback.json');
}

function outlinesPath(stageId: string): string {
  return path.join(stageDir(stageId), 'outlines.json');
}

function audioDir(stageId: string): string {
  return path.join(stageDir(stageId), 'audio');
}

function mediaDir(stageId: string): string {
  return path.join(stageDir(stageId), 'media');
}

// ── Low-level helpers ────────────────────────────────────────────────────────

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

async function writeBinaryAtomic(filePath: string, buffer: Buffer): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, filePath);
}

// ── FilesystemBackend ────────────────────────────────────────────────────────

export class FilesystemBackend implements StorageBackend {
  // ── Stage CRUD ──────────────────────────────────────────────────────────────

  async listStages(options?: StageListOptions): Promise<StageListItem[]> {
    try {
      await ensureDir(STAGES_DIR);

      // Si hi ha filtre per userId, obté els stageIds permesos via StageOwnership
      let allowedIds: Set<string> | null = null;
      if (options?.userId) {
        const ownerships = await prisma.stageOwnership.findMany({
          where: { userId: options.userId },
          select: { stageId: true },
        });
        allowedIds = new Set(ownerships.map((o) => o.stageId));
      }

      const entries = await fs.readdir(STAGES_DIR, { withFileTypes: true });
      const results: StageListItem[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        // Filtre per propietat: si allowedIds és non-null, el stage ha d'estar inclòs
        if (allowedIds !== null && !allowedIds.has(entry.name)) continue;
        const data = await readJson<StageStoreData>(stagePath(entry.name));
        if (!data?.stage) continue;
        results.push({
          id: data.stage.id,
          name: data.stage.name,
          description: data.stage.description,
          sceneCount: data.scenes?.length ?? 0,
          createdAt: data.stage.createdAt,
          updatedAt: data.stage.updatedAt,
        });
      }

      return results.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async loadStage(stageId: string): Promise<StageStoreData | null> {
    return readJson<StageStoreData>(stagePath(stageId));
  }

  async saveStage(stageId: string, data: StageStoreData): Promise<void> {
    await writeJsonFileAtomic(stagePath(stageId), data);
  }

  async deleteStage(stageId: string): Promise<void> {
    await fs.rm(stageDir(stageId), { recursive: true, force: true });
  }

  async renameStage(stageId: string, name: string): Promise<void> {
    const data = await readJson<StageStoreData>(stagePath(stageId));
    if (!data) throw new Error(`Stage not found: ${stageId}`);
    data.stage.name = name;
    data.stage.updatedAt = Date.now();
    await writeJsonFileAtomic(stagePath(stageId), data);
  }

  // ── Playback state ──────────────────────────────────────────────────────────

  async loadPlayback(stageId: string): Promise<PlaybackSnapshot | null> {
    return readJson<PlaybackSnapshot>(playbackPath(stageId));
  }

  async savePlayback(stageId: string, snapshot: PlaybackSnapshot): Promise<void> {
    await writeJsonFileAtomic(playbackPath(stageId), snapshot);
  }

  async clearPlayback(stageId: string): Promise<void> {
    try {
      await fs.unlink(playbackPath(stageId));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  // ── Outlines ────────────────────────────────────────────────────────────────

  async loadOutlines(stageId: string): Promise<SceneOutline[] | null> {
    const data = await readJson<{ outlines: SceneOutline[] }>(outlinesPath(stageId));
    return data?.outlines ?? null;
  }

  async saveOutlines(stageId: string, outlines: SceneOutline[]): Promise<void> {
    await writeJsonFileAtomic(outlinesPath(stageId), { outlines, updatedAt: Date.now() });
  }

  // ── Audio blobs ─────────────────────────────────────────────────────────────

  async saveAudio(stageId: string, audioId: string, buffer: Buffer, format: string): Promise<void> {
    const filePath = path.join(audioDir(stageId), `${audioId}.${format}`);
    await writeBinaryAtomic(filePath, buffer);
  }

  getAudioUrl(stageId: string, audioId: string): string {
    return `/api/stages/${stageId}/audio/${audioId}`;
  }

  // ── Media blobs ─────────────────────────────────────────────────────────────

  async saveMedia(
    stageId: string,
    elementId: string,
    buffer: Buffer,
    posterBuffer: Buffer | null,
    meta: Omit<MediaMeta, 'elementId' | 'stageId' | 'hasPoster'>,
  ): Promise<void> {
    const dir = mediaDir(stageId);
    const ext = meta.mimeType.split('/')[1] ?? 'bin';

    await writeBinaryAtomic(path.join(dir, `${elementId}.${ext}`), buffer);

    if (posterBuffer) {
      await writeBinaryAtomic(path.join(dir, `${elementId}.poster.jpg`), posterBuffer);
    }

    const fullMeta: MediaMeta = {
      ...meta,
      elementId,
      stageId,
      hasPoster: posterBuffer !== null,
    };
    await writeJsonFileAtomic(path.join(dir, `${elementId}.meta.json`), fullMeta);
  }

  async listMedia(stageId: string): Promise<MediaMeta[]> {
    try {
      const dir = mediaDir(stageId);
      const entries = await fs.readdir(dir);
      const metaFiles = entries.filter((f) => f.endsWith('.meta.json'));
      const results: MediaMeta[] = [];
      for (const f of metaFiles) {
        const data = await readJson<MediaMeta>(path.join(dir, f));
        if (data) results.push(data);
      }
      return results;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  getMediaUrl(stageId: string, elementId: string): string {
    return `/api/stages/${stageId}/media/${elementId}`;
  }

  getPosterUrl(stageId: string, elementId: string): string {
    return `/api/stages/${stageId}/media/${elementId}/poster`;
  }

  async deleteMedia(stageId: string, elementId: string): Promise<void> {
    try {
      const dir = mediaDir(stageId);
      const entries = await fs.readdir(dir);
      await Promise.all(
        entries
          .filter((f) => f.startsWith(`${elementId}.`))
          .map((f) => fs.unlink(path.join(dir, f)).catch(() => {})),
      );
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }

  // ── Serve helpers (used by GET routes) ──────────────────────────────────────

  /** Returns the absolute path to an audio file, or null if not found. */
  async resolveAudioPath(
    stageId: string,
    audioId: string,
  ): Promise<{ filePath: string; format: string } | null> {
    const dir = audioDir(stageId);
    try {
      const entries = await fs.readdir(dir);
      const match = entries.find((f) => f.startsWith(`${audioId}.`));
      if (!match) return null;
      const format = match.slice(audioId.length + 1);
      return { filePath: path.join(dir, match), format };
    } catch {
      return null;
    }
  }

  /** Returns the absolute path and mimeType for a media blob, or null if not found. */
  async resolveMediaPath(
    stageId: string,
    elementId: string,
    poster = false,
  ): Promise<{ filePath: string; mimeType: string } | null> {
    const dir = mediaDir(stageId);
    try {
      if (poster) {
        const p = path.join(dir, `${elementId}.poster.jpg`);
        try {
          await fs.access(p);
          return { filePath: p, mimeType: 'image/jpeg' };
        } catch {
          return null;
        }
      }

      const meta = await readJson<MediaMeta>(path.join(dir, `${elementId}.meta.json`));
      if (!meta) return null;
      const ext = meta.mimeType.split('/')[1] ?? 'bin';
      return { filePath: path.join(dir, `${elementId}.${ext}`), mimeType: meta.mimeType };
    } catch {
      return null;
    }
  }
}
