import { useSettingsStore } from '@/lib/store/settings';
import { useUserPrefsStore } from '@/lib/store/user-prefs';

/**
 * Get current model configuration from settings store.
 * API keys and base URLs are never included — the server resolves them from DB/env.
 */
export function getCurrentModelConfig() {
  const { providerId, modelId } = useUserPrefsStore.getState();
  const { providersConfig } = useSettingsStore.getState();
  const modelString = `${providerId}:${modelId}`;

  const providerConfig = providersConfig[providerId];

  return {
    providerId,
    modelId,
    modelString,
    providerType: providerConfig?.type,
    requiresApiKey: providerConfig?.requiresApiKey,
    isServerConfigured: providerConfig?.isServerConfigured,
  };
}
