/**
 * Helpers for masking and unmasking API keys in the admin config endpoint.
 *
 * maskApiKeys   — replaces stored API keys with a sentinel before sending to the client
 * stripSentinelApiKeys — reverses the sentinel when the client saves without changing a key
 */

import type { SerializableSettings } from '@/app/api/admin/config/providers/route';

export const SENTINEL = '__STORED__';

type ProviderSection = Record<string, { apiKey?: string; [k: string]: unknown }>;

function maskSection(section: ProviderSection | undefined): ProviderSection | undefined {
  if (!section) return section;
  const result: ProviderSection = {};
  for (const [id, entry] of Object.entries(section)) {
    result[id] = { ...entry, apiKey: entry.apiKey ? SENTINEL : '' };
  }
  return result;
}

/**
 * Returns a copy of `config` where every non-empty apiKey is replaced by SENTINEL.
 * Does NOT mutate the input.
 */
export function maskApiKeys(config: SerializableSettings): SerializableSettings {
  return {
    ...config,
    providersConfig: maskSection(config.providersConfig as ProviderSection | undefined) as SerializableSettings['providersConfig'],
    ttsProvidersConfig: maskSection(config.ttsProvidersConfig as ProviderSection | undefined) as SerializableSettings['ttsProvidersConfig'],
    asrProvidersConfig: maskSection(config.asrProvidersConfig as ProviderSection | undefined) as SerializableSettings['asrProvidersConfig'],
    pdfProvidersConfig: maskSection(config.pdfProvidersConfig as ProviderSection | undefined) as SerializableSettings['pdfProvidersConfig'],
    imageProvidersConfig: maskSection(config.imageProvidersConfig as ProviderSection | undefined) as SerializableSettings['imageProvidersConfig'],
    videoProvidersConfig: maskSection(config.videoProvidersConfig as ProviderSection | undefined) as SerializableSettings['videoProvidersConfig'],
    webSearchProvidersConfig: maskSection(config.webSearchProvidersConfig as ProviderSection | undefined) as SerializableSettings['webSearchProvidersConfig'],
  };
}

/**
 * Returns a copy of `incoming` where every apiKey that equals SENTINEL is replaced
 * by the corresponding existing key (or '' if the provider is new).
 * Does NOT mutate the input.
 */
export function stripSentinelApiKeys(
  incoming: ProviderSection,
  existing: ProviderSection,
): ProviderSection {
  const result: ProviderSection = {};
  for (const [id, entry] of Object.entries(incoming)) {
    result[id] = {
      ...entry,
      apiKey: entry.apiKey === SENTINEL ? (existing[id]?.apiKey ?? '') : entry.apiKey,
    };
  }
  return result;
}
