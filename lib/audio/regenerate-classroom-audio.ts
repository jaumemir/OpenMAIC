'use client';

import type { SpeechAction } from '@/lib/types/action';
import { createLogger } from '@/lib/logger';
import { useSettingsStore } from '@/lib/store/settings';
import { loadStageData, saveStageData } from '@/lib/utils/stage-storage';
import { generateAndStoreTTS } from './generate-and-store-tts';

const log = createLogger('RegenerateClassroomAudio');

export type RegenerateAudioErrorCode =
  | 'BROWSER_NATIVE_UNSUPPORTED'
  | 'TTS_NOT_CONFIGURED'
  | 'STAGE_NOT_FOUND'
  | 'NO_SPEECH_ACTIONS'
  | 'TTS_GENERATION_FAILED';

export class RegenerateAudioError extends Error {
  constructor(
    message: string,
    public readonly code: RegenerateAudioErrorCode,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RegenerateAudioError';
  }
}

export interface RegenerateClassroomAudioResult {
  speechCount: number;
  sceneCount: number;
}

function assertTTSConfigUsable() {
  const settings = useSettingsStore.getState();
  if (settings.ttsProviderId === 'browser-native-tts') {
    throw new RegenerateAudioError(
      'Browser Native TTS is not supported for classroom audio regeneration',
      'BROWSER_NATIVE_UNSUPPORTED',
    );
  }

  const providerConfig = settings.ttsProvidersConfig?.[settings.ttsProviderId];
  const hasUsableConfig = !!providerConfig?.isServerConfigured || !!providerConfig?.apiKey?.trim();
  if (!hasUsableConfig) {
    throw new RegenerateAudioError('TTS provider is not configured', 'TTS_NOT_CONFIGURED');
  }

  return settings;
}

export async function regenerateClassroomAudio(
  stageId: string,
  signal?: AbortSignal,
): Promise<RegenerateClassroomAudioResult> {
  const settings = assertTTSConfigUsable();
  const stageData = await loadStageData(stageId);
  if (!stageData) {
    throw new RegenerateAudioError('Classroom not found', 'STAGE_NOT_FOUND');
  }

  const nextData = structuredClone(stageData);
  let speechCount = 0;

  for (const scene of nextData.scenes) {
    if (!scene.actions?.length) continue;

    for (const action of scene.actions) {
      if (action.type !== 'speech' || !action.text?.trim()) continue;

      speechCount++;
      const speechAction = action as SpeechAction;
      const audioId = `tts_${speechAction.id}`;
      speechAction.audioId = audioId;
      speechAction.voice = settings.ttsVoice;
      delete speechAction.audioUrl;

      try {
        const audioUrl = await generateAndStoreTTS(audioId, speechAction.text, signal);
        if (audioUrl) speechAction.audioUrl = audioUrl;
        else delete speechAction.audioUrl;
      } catch (error) {
        throw new RegenerateAudioError(
          error instanceof Error ? error.message : 'Failed to generate TTS audio',
          'TTS_GENERATION_FAILED',
          error,
        );
      }
    }
  }

  if (speechCount === 0) {
    throw new RegenerateAudioError(
      'Classroom has no speech actions to regenerate',
      'NO_SPEECH_ACTIONS',
    );
  }

  await saveStageData(stageId, nextData);
  log.info(`Regenerated ${speechCount} speech audios for classroom ${stageId}`);

  return {
    speechCount,
    sceneCount: nextData.scenes.length,
  };
}
