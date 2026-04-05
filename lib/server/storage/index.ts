/**
 * Storage backend factory.
 *
 * Returns the appropriate StorageBackend implementation based on the runtime
 * environment. Today only FilesystemBackend exists; AzureBlobBackend will be
 * added as a Phase 2 implementation.
 */

import { FilesystemBackend } from './filesystem';
import type { StorageBackend } from './types';

let _backend: StorageBackend | null = null;

export function getStorageBackend(): StorageBackend {
  if (!_backend) {
    // Phase 2: switch on STORAGE_BACKEND env var to select AzureBlobBackend
    _backend = new FilesystemBackend();
  }
  return _backend;
}

// Re-export types so callers only need one import
export type {
  StorageBackend,
  StageStoreData,
  StageListItem,
  PlaybackSnapshot,
  MediaMeta,
} from './types';
