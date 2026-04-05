/**
 * Client-side storage backend flag.
 *
 * When NEXT_PUBLIC_STORAGE_BACKEND=server, all course data is persisted via
 * the server API (filesystem in dev, Azure Blob in production).
 *
 * When unset or set to any other value, the legacy IndexedDB path is used.
 */
export function isServerStorageEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STORAGE_BACKEND === 'server';
}
