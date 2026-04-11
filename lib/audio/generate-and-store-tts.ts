'use client';

import { createLogger } from '@/lib/logger';
import { useSettingsStore } from '@/lib/store/settings';

const log = createLogger('TTSStorage');

/**
 * Generate TTS audio for the given text and persist it server-side.
 *
 * @param audioId  Unique identifier for this audio clip (e.g. `tts_${action.id}`)
 * @param text     Text to synthesise
 * @param signal   Optional AbortSignal
 * @returns        Server URL for the stored audio, or undefined if not persisted
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
