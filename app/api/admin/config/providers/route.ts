/**
 * GET /api/admin/config/providers  — Llegeix la configuració global de proveïdors
 * PUT /api/admin/config/providers  — Actualitza la configuració global de proveïdors
 *
 * Emmagatzema tot l'estat serialitzable de useSettingsStore (excepte layout/playback)
 * com un únic key 'globalConfig' a la taula AdminConfig.
 * Les API keys es xifren amb AES-256-GCM (CONFIG_ENCRYPTION_KEY).
 */
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, apiError, apiSuccess } from '@/lib/server/api-response';
import { auditLog, extractRequestMeta } from '@/lib/audit';
import { encryptProviderApiKeys, decryptProviderApiKeys } from '@/lib/server/config-crypto';
import { maskApiKeys, stripSentinelApiKeys } from '@/lib/server/admin-config-mask';
import { PROVIDERS } from '@/lib/ai/providers';
import type { ProviderId } from '@/lib/ai/providers';
import type { ProvidersConfig } from '@/lib/types/settings';

const CONFIG_KEY = 'globalConfig';

/** Tipus serialitzable de SettingsState (sense funcions ni layout/playback) */
export type SerializableSettings = {
  providersConfig?: ProvidersConfig;
  ttsModel?: string;
  ttsProviderId?: string;
  ttsVoice?: string;
  ttsSpeed?: number;
  asrProviderId?: string;
  ttsProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; modelId?: string; customModels?: unknown[]; providerOptions?: Record<string, unknown>; isServerConfigured?: boolean; serverBaseUrl?: string }>;
  asrProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; modelId?: string; customModels?: unknown[]; providerOptions?: Record<string, unknown>; isServerConfigured?: boolean; serverBaseUrl?: string }>;
  pdfProviderId?: string;
  pdfProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isServerConfigured?: boolean; serverBaseUrl?: string }>;
  imageProviderId?: string;
  imageModelId?: string;
  imageProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isServerConfigured?: boolean; serverBaseUrl?: string; customModels?: unknown[] }>;
  videoProviderId?: string;
  videoModelId?: string;
  videoProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isServerConfigured?: boolean; serverBaseUrl?: string; customModels?: unknown[] }>;
  webSearchProviderId?: string;
  webSearchProvidersConfig?: Record<string, { apiKey: string; baseUrl: string; enabled: boolean; isServerConfigured?: boolean; serverBaseUrl?: string }>;
  autoConfigApplied?: boolean;
  selectedAgentIds?: string[];
  maxTurns?: string;
  autoAgentCount?: number;
  themeId?: string;
  allowedModels?: string[] | null;
};

/**
 * Fa merge entre la config de BD i la llista actual de PROVIDERS del codi.
 * Afegeix ÚNICAMENT providers que siguin nous al codi i que no existeixin a BD.
 * Per als providers ja existents a BD, la seva llista de models és autoritativa
 * (l'admin pot afegir/eliminar models i la BD ho respecta).
 */
function mergeWithBuiltInProviders(config: SerializableSettings): SerializableSettings {
  if (!config.providersConfig) return config;

  const result = { ...config.providersConfig } as ProvidersConfig;
  for (const pid of Object.keys(PROVIDERS) as ProviderId[]) {
    if (!result[pid]) {
      // Provider completament nou al codi que no existia a BD → afegir amb defaults
      const provider = PROVIDERS[pid];
      result[pid] = {
        apiKey: '',
        baseUrl: '',
        models: provider.models,
        name: provider.name,
        type: provider.type,
        defaultBaseUrl: provider.defaultBaseUrl,
        icon: provider.icon,
        requiresApiKey: provider.requiresApiKey,
        isBuiltIn: true,
      };
    }
    // Provider ja existent a BD → no tocar res (models, API keys, etc.)
    // La llista de models guardada per l'admin és l'única font de veritat.
  }

  return { ...config, providersConfig: result };
}

/** Desxifra totes les API keys d'una SerializableSettings */
function decryptAllApiKeys(config: SerializableSettings): SerializableSettings {
  return {
    ...config,
    providersConfig: config.providersConfig
      ? decryptProviderApiKeys(config.providersConfig)
      : config.providersConfig,
    ttsProvidersConfig: config.ttsProvidersConfig
      ? decryptProviderApiKeys(config.ttsProvidersConfig)
      : config.ttsProvidersConfig,
    asrProvidersConfig: config.asrProvidersConfig
      ? decryptProviderApiKeys(config.asrProvidersConfig)
      : config.asrProvidersConfig,
    pdfProvidersConfig: config.pdfProvidersConfig
      ? decryptProviderApiKeys(config.pdfProvidersConfig)
      : config.pdfProvidersConfig,
    imageProvidersConfig: config.imageProvidersConfig
      ? decryptProviderApiKeys(config.imageProvidersConfig)
      : config.imageProvidersConfig,
    videoProvidersConfig: config.videoProvidersConfig
      ? decryptProviderApiKeys(config.videoProvidersConfig)
      : config.videoProvidersConfig,
    webSearchProvidersConfig: config.webSearchProvidersConfig
      ? decryptProviderApiKeys(config.webSearchProvidersConfig)
      : config.webSearchProvidersConfig,
  };
}

/** Xifra totes les API keys d'una SerializableSettings */
function encryptAllApiKeys(config: SerializableSettings): SerializableSettings {
  return {
    ...config,
    providersConfig: config.providersConfig
      ? encryptProviderApiKeys(config.providersConfig)
      : config.providersConfig,
    ttsProvidersConfig: config.ttsProvidersConfig
      ? encryptProviderApiKeys(config.ttsProvidersConfig)
      : config.ttsProvidersConfig,
    asrProvidersConfig: config.asrProvidersConfig
      ? encryptProviderApiKeys(config.asrProvidersConfig)
      : config.asrProvidersConfig,
    pdfProvidersConfig: config.pdfProvidersConfig
      ? encryptProviderApiKeys(config.pdfProvidersConfig)
      : config.pdfProvidersConfig,
    imageProvidersConfig: config.imageProvidersConfig
      ? encryptProviderApiKeys(config.imageProvidersConfig)
      : config.imageProvidersConfig,
    videoProvidersConfig: config.videoProvidersConfig
      ? encryptProviderApiKeys(config.videoProvidersConfig)
      : config.videoProvidersConfig,
    webSearchProvidersConfig: config.webSearchProvidersConfig
      ? encryptProviderApiKeys(config.webSearchProvidersConfig)
      : config.webSearchProvidersConfig,
  };
}

export async function GET(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Accés restringit a administradors.');
  }

  const row = await prisma.adminConfig.findUnique({ where: { key: CONFIG_KEY } });

  let config: SerializableSettings = {};
  if (row) {
    try {
      config = JSON.parse(row.value) as SerializableSettings;
    } catch {
      config = {};
    }
    config = decryptAllApiKeys(config);
  }

  // Sempre fusionar amb els providers del codi per reflectir models nous
  config = mergeWithBuiltInProviders(config);

  // Afegir allowedModels des del seu propi key (retrocompat)
  if (config.allowedModels === undefined) {
    const allowedRow = await prisma.adminConfig.findUnique({ where: { key: 'allowedModels' } });
    if (allowedRow) {
      try {
        config.allowedModels = JSON.parse(allowedRow.value) as string[] | null;
      } catch {
        config.allowedModels = null;
      }
    }
  }

  return apiSuccess({ config: maskApiKeys(config), exists: !!row });
}

export async function PUT(req: NextRequest) {
  const user = await requireAuth(req);
  if ('status' in user && user instanceof Response) return user;
  if ((user as { role: string }).role !== 'admin') {
    return apiError('FORBIDDEN', 403, 'Accés restringit a administradors.');
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Cos de la petició invàlid.');
  }

  const updates = body as SerializableSettings;
  const meta = extractRequestMeta(req);
  const userId = (user as { id: string }).id;

  // Llegir config actual de BD per fer merge (no sobreescriure tot)
  const existing = await prisma.adminConfig.findUnique({ where: { key: CONFIG_KEY } });
  let currentConfig: SerializableSettings = {};
  if (existing) {
    try {
      currentConfig = JSON.parse(existing.value) as SerializableSettings;
    } catch {
      currentConfig = {};
    }
    // Desxifrar l'actual per poder fer deep merge
    currentConfig = decryptAllApiKeys(currentConfig);
  }

  // Merge: els updates sobreescriuen, però configs de proveïdors es fan en deep merge per proveïdor.
  // stripSentinelApiKeys preserva la clau existent quan el client envia '__STORED__'.
  const merged: SerializableSettings = {
    ...currentConfig,
    ...updates,
    providersConfig: updates.providersConfig
      ? ({
          ...currentConfig.providersConfig,
          ...stripSentinelApiKeys(
            updates.providersConfig as Record<string, { apiKey?: string }>,
            currentConfig.providersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['providersConfig'])
      : currentConfig.providersConfig,
    ttsProvidersConfig: updates.ttsProvidersConfig
      ? ({
          ...currentConfig.ttsProvidersConfig,
          ...stripSentinelApiKeys(
            updates.ttsProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.ttsProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['ttsProvidersConfig'])
      : currentConfig.ttsProvidersConfig,
    asrProvidersConfig: updates.asrProvidersConfig
      ? ({
          ...currentConfig.asrProvidersConfig,
          ...stripSentinelApiKeys(
            updates.asrProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.asrProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['asrProvidersConfig'])
      : currentConfig.asrProvidersConfig,
    pdfProvidersConfig: updates.pdfProvidersConfig
      ? ({
          ...currentConfig.pdfProvidersConfig,
          ...stripSentinelApiKeys(
            updates.pdfProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.pdfProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['pdfProvidersConfig'])
      : currentConfig.pdfProvidersConfig,
    imageProvidersConfig: updates.imageProvidersConfig
      ? ({
          ...currentConfig.imageProvidersConfig,
          ...stripSentinelApiKeys(
            updates.imageProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.imageProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['imageProvidersConfig'])
      : currentConfig.imageProvidersConfig,
    videoProvidersConfig: updates.videoProvidersConfig
      ? ({
          ...currentConfig.videoProvidersConfig,
          ...stripSentinelApiKeys(
            updates.videoProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.videoProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['videoProvidersConfig'])
      : currentConfig.videoProvidersConfig,
    webSearchProvidersConfig: updates.webSearchProvidersConfig
      ? ({
          ...currentConfig.webSearchProvidersConfig,
          ...stripSentinelApiKeys(
            updates.webSearchProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.webSearchProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        } as SerializableSettings['webSearchProvidersConfig'])
      : currentConfig.webSearchProvidersConfig,
  };

  // Xifrar API keys abans de guardar
  const toStore = encryptAllApiKeys(merged);

  await prisma.adminConfig.upsert({
    where: { key: CONFIG_KEY },
    update: { value: JSON.stringify(toStore), updatedById: userId },
    create: { key: CONFIG_KEY, value: JSON.stringify(toStore), updatedById: userId },
  });

  // Si hi ha allowedModels als updates, guardar-ho també al key legacy
  if ('allowedModels' in updates) {
    await prisma.adminConfig.upsert({
      where: { key: 'allowedModels' },
      update: { value: JSON.stringify(updates.allowedModels), updatedById: userId },
      create: { key: 'allowedModels', value: JSON.stringify(updates.allowedModels), updatedById: userId },
    });
  }

  await auditLog({
    userId,
    action: 'CONFIG_CHANGED',
    entityType: 'config',
    entityId: CONFIG_KEY,
    details: { updatedKeys: Object.keys(updates) },
    ...meta,
  });

  return apiSuccess({ updated: true });
}
