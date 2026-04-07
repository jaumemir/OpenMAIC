/**
 * User Preferences Store
 *
 * Preferències per-usuari: model seleccionat + activació de funcionalitats.
 * Namespaced per userId → cada usuari té les seves preferències independents.
 *
 * La configuració de proveïdors (API keys, models disponibles) roman
 * al store global `useSettingsStore` (configurada per l'admin, aplica a tots).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

  // Setters
  setModel: (providerId: ProviderId, modelId: string) => void;
  setTTSEnabled: (enabled: boolean) => void;
  setASREnabled: (enabled: boolean) => void;
  setImageGenerationEnabled: (enabled: boolean) => void;
  setVideoGenerationEnabled: (enabled: boolean) => void;
  setASRLanguage: (language: string) => void;
  setAgentMode: (mode: 'preset' | 'auto') => void;
}

// ── Storage namespaced per userId ─────────────────────────────────────────────

let _currentUserId: string | null = null;

/**
 * Invoca aquesta funció quan la sessió canvia (login/logout).
 * Recarrega el store de preferències amb la clau de l'usuari.
 */
export function setUserPrefsUserId(userId: string | null) {
  _currentUserId = userId;
  if (typeof window !== 'undefined') {
    useUserPrefsStore.persist.rehydrate();
  }
}

const userScopedLocalStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    if (!_currentUserId) return localStorage.getItem(name);
    const scopedKey = `${name}__${_currentUserId}`;
    // Migració transparent: si la clau per usuari no existeix, llegeix la legacy
    return localStorage.getItem(scopedKey) ?? localStorage.getItem(name);
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === 'undefined') return;
    const key = _currentUserId ? `${name}__${_currentUserId}` : name;
    localStorage.setItem(key, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined') return;
    const key = _currentUserId ? `${name}__${_currentUserId}` : name;
    localStorage.removeItem(key);
  },
};

// ── Store ─────────────────────────────────────────────────────────────────────

export const useUserPrefsStore = create<UserPrefsState>()(
  persist(
    (set) => ({
      providerId: 'openai' as ProviderId,
      modelId: '',
      ttsEnabled: true,
      asrEnabled: true,
      imageGenerationEnabled: false,
      videoGenerationEnabled: false,
      asrLanguage: 'zh-CN',
      agentMode: 'auto' as const,

      setModel: (providerId, modelId) => set({ providerId, modelId }),
      setTTSEnabled: (enabled) => set({ ttsEnabled: enabled }),
      setASREnabled: (enabled) => set({ asrEnabled: enabled }),
      setImageGenerationEnabled: (enabled) => set({ imageGenerationEnabled: enabled }),
      setVideoGenerationEnabled: (enabled) => set({ videoGenerationEnabled: enabled }),
      setASRLanguage: (language) => set({ asrLanguage: language }),
      setAgentMode: (mode) => set({ agentMode: mode }),
    }),
    {
      name: 'user-prefs-storage',
      storage: createJSONStorage(() => userScopedLocalStorage),
      version: 1,
      // Migració: en la primera càrrega intenta heretar valors del settings-storage antic
      migrate: (persistedState: unknown, _version: number) => {
        const state = (persistedState ?? {}) as Partial<UserPrefsState>;
        if (!state.providerId && typeof window !== 'undefined') {
          try {
            const old = localStorage.getItem('settings-storage');
            if (old) {
              const s = (JSON.parse(old) as { state?: Partial<UserPrefsState> })?.state ?? {};
              if (s.providerId) state.providerId = s.providerId;
              if (s.modelId !== undefined) state.modelId = s.modelId;
              if (s.ttsEnabled !== undefined) state.ttsEnabled = s.ttsEnabled;
              if (s.asrEnabled !== undefined) state.asrEnabled = s.asrEnabled;
              if (s.imageGenerationEnabled !== undefined)
                state.imageGenerationEnabled = s.imageGenerationEnabled;
              if (s.videoGenerationEnabled !== undefined)
                state.videoGenerationEnabled = s.videoGenerationEnabled;
              if (s.asrLanguage) state.asrLanguage = s.asrLanguage;
              if (s.agentMode) state.agentMode = s.agentMode;
            }
          } catch {
            /* ignorar errors de parsing */
          }
        }
        return state as UserPrefsState;
      },
    },
  ),
);
