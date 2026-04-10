import { useSettingsStore } from '@/lib/store/settings';
import { useUserPrefsStore } from '@/lib/store/user-prefs';

const SENTINEL = '__STORED__';

/**
 * Get current model configuration from settings store.
 * Treats '__STORED__' apiKey as empty — the server resolves the real key from DB.
 */
export function getCurrentModelConfig() {
  const { providerId, modelId } = useUserPrefsStore.getState();
  const { providersConfig } = useSettingsStore.getState();
  const modelString = `${providerId}:${modelId}`;

  const providerConfig = providersConfig[providerId];
  const rawApiKey = providerConfig?.apiKey || '';

  return {
    providerId,
    modelId,
    modelString,
    apiKey: rawApiKey === SENTINEL ? '' : rawApiKey,
    baseUrl: providerConfig?.baseUrl || '',
    providerType: providerConfig?.type,
    requiresApiKey: providerConfig?.requiresApiKey,
    isServerConfigured: providerConfig?.isServerConfigured,
  };
}
