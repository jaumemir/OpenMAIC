/**
 * Server Storage Backend — shared types
 *
 * Defined here (not in client utils) so that both client adapters and
 * server-side implementations can import without pulling in browser-only
 * code (IndexedDB / Dexie).
 */

import type { Stage, Scene } from '@/lib/types/stage';
import type { ChatSession } from '@/lib/types/chat';
import type { SceneOutline } from '@/lib/types/generation';

// ── Course data ──────────────────────────────────────────────────────────────

export interface StageStoreData {
  stage: Stage;
  scenes: Scene[];
  currentSceneId: string | null;
  chats: ChatSession[];
}

export interface StageListItem {
  id: string;
  name: string;
  description?: string;
  sceneCount: number;
  createdAt: number;
  updatedAt: number;
}

// ── Playback state ───────────────────────────────────────────────────────────

export interface PlaybackSnapshot {
  sceneIndex: number;
  actionIndex: number;
  consumedDiscussions: string[];
  sceneId?: string;
}

// ── Media metadata (stored alongside binary blobs) ───────────────────────────

export interface MediaMeta {
  elementId: string;
  stageId: string;
  type: 'image' | 'video';
  mimeType: string;
  size: number;
  prompt: string;
  params: string; // JSON string of generation params
  error?: string;
  errorCode?: string;
  hasPoster: boolean;
  createdAt: number;
}

// ── StorageBackend interface ─────────────────────────────────────────────────

export interface StorageBackend {
  // Stage CRUD
  listStages(): Promise<StageListItem[]>;
  loadStage(stageId: string): Promise<StageStoreData | null>;
  saveStage(stageId: string, data: StageStoreData): Promise<void>;
  deleteStage(stageId: string): Promise<void>;
  renameStage(stageId: string, name: string): Promise<void>;

  // Playback state (per stage, at most one record)
  loadPlayback(stageId: string): Promise<PlaybackSnapshot | null>;
  savePlayback(stageId: string, snapshot: PlaybackSnapshot): Promise<void>;
  clearPlayback(stageId: string): Promise<void>;

  // Outlines for resume-on-refresh
  loadOutlines(stageId: string): Promise<SceneOutline[] | null>;
  saveOutlines(stageId: string, outlines: SceneOutline[]): Promise<void>;

  // Audio blobs (TTS)
  saveAudio(stageId: string, audioId: string, buffer: Buffer, format: string): Promise<void>;
  /** Returns the URL at which the audio can be fetched (for AudioPlayer and SCORM export). */
  getAudioUrl(stageId: string, audioId: string): string;

  // Media blobs (generated images / videos)
  saveMedia(
    stageId: string,
    elementId: string,
    buffer: Buffer,
    posterBuffer: Buffer | null,
    meta: Omit<MediaMeta, 'elementId' | 'stageId' | 'hasPoster'>,
  ): Promise<void>;
  listMedia(stageId: string): Promise<MediaMeta[]>;
  /** Returns the URL at which the media blob can be fetched. */
  getMediaUrl(stageId: string, elementId: string): string;
  /** Returns the URL at which the video poster can be fetched. */
  getPosterUrl(stageId: string, elementId: string): string;
  deleteMedia(stageId: string, elementId: string): Promise<void>;
}
