/**
 * User Preferences Store
 *
 * Preferències per-usuari: model seleccionat + activació de funcionalitats.
 * La font de veritat és la BD (UserPreferences via /api/user/preferences).
 * Zustand actua com a cache en memòria per a la sessió actual — sense persist.
 *
 * Flux:
 *   Login → GET /api/user/preferences → hydrate()
 *   Canvi  → setter → auto-save a BD (debounced, fire-and-forget)
 */

import { create } from 'zustand';
import type { ProviderId } from '@/lib/ai/providers';

export interface UserPrefsState {
  // Model LLM seleccionat (per-usuari)
  providerId: ProviderId;
  modelId: string;

  // Activació de funcionalitats (per-usuari)
  ttsEnabled: boolean;
  asrEnabled: boolean;
  imageGenerationEnabled: boolean;
  videoGenerationEnabled: boolean;

  // Idioma ASR (per-usuari)
  asrLanguage: string;

  // Mode d'agents (per-usuari)
  agentMode: 'preset' | 'auto';

  // Avatar i bio (per-usuari)
  avatar: string;
  bio: string;

  // Setters (auto-desen a BD en background)
  setModel: (providerId: ProviderId, modelId: string) => void;
  setTTSEnabled: (enabled: boolean) => void;
  setASREnabled: (enabled: boolean) => void;
  setImageGenerationEnabled: (enabled: boolean) => void;
  setVideoGenerationEnabled: (enabled: boolean) => void;
  setASRLanguage: (language: string) => void;
  setAgentMode: (mode: 'preset' | 'auto') => void;
  setAvatar: (avatar: string) => void;
  setBio: (bio: string) => void;

  /**
   * Hidrata el store amb dades rebudes del servidor (GET /api/user/preferences).
   * Crida-la al login i al canvi d'usuari.
   */
  hydrate: (prefs: Partial<UserPrefsState>) => void;
}

// ── Debounced save ────────────────────────────────────────────────────────────

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave(data: Partial<UserPrefsState>) {
  if (typeof window === 'undefined') return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    _saveTimer = null;
    fetch('/api/user/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {
      // Silenciar errors de xarxa — les prefs es tornaran a desar al proper canvi
    });
  }, 600);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserPrefsStore = create<UserPrefsState>()((set) => ({
  providerId: 'openai' as ProviderId,
  modelId: '',
  ttsEnabled: true,
  asrEnabled: true,
  imageGenerationEnabled: false,
  videoGenerationEnabled: false,
  asrLanguage: 'zh-CN',
  agentMode: 'auto' as const,
  avatar: '/avatars/user.png',
  bio: '',

  setModel: (providerId, modelId) => {
    set({ providerId, modelId });
    scheduleSave({ providerId, modelId });
  },
  setTTSEnabled: (ttsEnabled) => {
    set({ ttsEnabled });
    scheduleSave({ ttsEnabled });
  },
  setASREnabled: (asrEnabled) => {
    set({ asrEnabled });
    scheduleSave({ asrEnabled });
  },
  setImageGenerationEnabled: (imageGenerationEnabled) => {
    set({ imageGenerationEnabled });
    scheduleSave({ imageGenerationEnabled });
  },
  setVideoGenerationEnabled: (videoGenerationEnabled) => {
    set({ videoGenerationEnabled });
    scheduleSave({ videoGenerationEnabled });
  },
  setASRLanguage: (asrLanguage) => {
    set({ asrLanguage });
    scheduleSave({ asrLanguage });
  },
  setAgentMode: (agentMode) => {
    set({ agentMode });
    scheduleSave({ agentMode });
  },
  setAvatar: (avatar) => {
    set({ avatar });
    scheduleSave({ avatar });
  },
  setBio: (bio) => {
    set({ bio });
    scheduleSave({ bio });
  },

  hydrate: (prefs) => {
    const {
      providerId, modelId, ttsEnabled, asrEnabled,
      imageGenerationEnabled, videoGenerationEnabled,
      asrLanguage, agentMode, avatar, bio,
    } = prefs;
    set({
      ...(providerId !== undefined && { providerId }),
      ...(modelId !== undefined && { modelId }),
      ...(ttsEnabled !== undefined && { ttsEnabled }),
      ...(asrEnabled !== undefined && { asrEnabled }),
      ...(imageGenerationEnabled !== undefined && { imageGenerationEnabled }),
      ...(videoGenerationEnabled !== undefined && { videoGenerationEnabled }),
      ...(asrLanguage !== undefined && { asrLanguage }),
      ...(agentMode !== undefined && { agentMode }),
      ...(avatar !== undefined && { avatar }),
      ...(bio !== undefined && { bio }),
    });
  },
}));
