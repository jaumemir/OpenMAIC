'use client';

import { createLogger } from '@/lib/logger';
import { useSettingsStore } from '@/lib/store/settings';
import { isServerStorageEnabled } from '@/lib/utils/storage-backend';

const log = createLogger('TTSStorage');

/**
 * Generate TTS audio for the given text and persist it.
 *
 * In server mode: uploads the audio to the server API and returns the serving URL.
 * In IndexedDB mode: stores the blob in IndexedDB and returns undefined.
 *
 * @param audioId  Unique identifier for this audio clip (e.g. `tts_${action.id}`)
 * @param text     Text to synthesise
 * @param signal   Optional AbortSignal
 * @returns        Server URL when in server mode, undefined in IndexedDB mode
 */
export async function generateAndStoreTTS(
  audioId: string,
  text: string,
  signal?: AbortSignal,
): Promise<string | undefined> {
  const settings = useSettingsStore.getState();
  if (settings.ttsProviderId === 'browser-native-tts') return undefined;

  const ttsProviderConfig = settings.ttsProvidersConfig?.[settings.ttsProviderId];
  const response = await fetch('/api/generate/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      audioId,
      ttsProviderId: settings.ttsProviderId,
      ttsModelId: ttsProviderConfig?.modelId,
      ttsVoice: settings.ttsVoice,
      ttsSpeed: settings.ttsSpeed,
      ttsApiKey: ttsProviderConfig?.apiKey || undefined,
      ttsBaseUrl: ttsProviderConfig?.baseUrl || undefined,
    }),
    signal,
  });

  const data = await response
    .json()
    .catch(() => ({ success: false, error: response.statusText || 'Invalid TTS response' }));
  if (!response.ok || !data.success || !data.base64 || !data.format) {
    const err = new Error(
      data.details || data.error || `TTS request failed: HTTP ${response.status}`,
    );
    log.warn('TTS failed for', audioId, ':', err);
    throw err;
  }

  if (isServerStorageEnabled()) {
    // Resolve stageId from the stage store (safe in client context)
    const stageId = (await import('@/lib/store/stage')).useStageStore.getState().stage?.id;
    if (!stageId) {
      log.warn('Cannot store TTS server-side: no active stage');
      return undefined;
    }

    const res = await fetch(`/api/stages/${stageId}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioId, base64: data.base64, format: data.format }),
    });
    if (!res.ok) {
      log.warn('Failed to upload TTS to server, audio will not be persisted');
      return undefined;
    }
    const result = await res.json();
    return result.url as string;
  }

  // IndexedDB mode
  const binary = atob(data.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: `audio/${data.format}` });
  const { db } = await import('@/lib/utils/database');
  await db.audioFiles.put({
    id: audioId,
    blob,
    format: data.format,
    createdAt: Date.now(),
  });
  return undefined;
}
