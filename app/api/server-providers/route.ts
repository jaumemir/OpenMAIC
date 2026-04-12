export const runtime = 'nodejs';

import { type NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { createLogger } from '@/lib/logger';
import { PROVIDERS, type ProviderId } from '@/lib/ai/providers';
import { TTS_PROVIDERS } from '@/lib/audio/constants';
import type { TTSProviderId } from '@/lib/audio/types';

const log = createLogger('ServerProviders');

type ProviderEntry = { models?: string[]; baseUrl?: string };
type ProviderMap = Record<string, ProviderEntry>;

/**
 * Carrega els providers LLM del DB admin config (sense exposar les API keys).
 * Retorna providers amb apiKey configurada, i també providers amb requiresApiKey: false
 * que estiguin presents a providersConfig (p.ex. Ollama).
 */
async function getDbProviders(): Promise<ProviderMap> {
  const row = await prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } });
  if (!row) return {};

  const config = JSON.parse(row.value) as {
    providersConfig?: Record<
      string,
      { apiKey?: string; baseUrl?: string; models?: Array<{ id: string }> }
    >;
  };

  const result: ProviderMap = {};
  for (const [pid, cfg] of Object.entries(config.providersConfig ?? {})) {
    if (!cfg.apiKey && PROVIDERS[pid as ProviderId]?.requiresApiKey !== false) continue;
    const entry: ProviderEntry = {};
    if (cfg.models?.length) entry.models = cfg.models.map((m) => m.id);
    if (cfg.baseUrl) entry.baseUrl = cfg.baseUrl;
    result[pid] = entry;
  }
  return result;
}

/**
 * Aplica el filtre allowedModels a un mapa de providers.
 * - null / llista buida    → tot permès (sense filtre)
 * - ["anthropic"]          → tot anthropic
 * - ["anthropic:claude-*"] → només aquell model d'anthropic
 */
function applyAllowedModelsFilter(
  providers: ProviderMap,
  allowedModels: string[] | null,
): ProviderMap {
  if (!Array.isArray(allowedModels) || allowedModels.length === 0) return providers;

  // Construir mapa: providerId → Set de model IDs permesos (buit = tots els models)
  const allowedByProvider: Record<string, Set<string>> = {};
  for (const entry of allowedModels) {
    const colonIdx = entry.indexOf(':');
    const providerId = colonIdx >= 0 ? entry.slice(0, colonIdx) : entry;
    const modelId = colonIdx >= 0 ? entry.slice(colonIdx + 1) : undefined;
    if (!allowedByProvider[providerId]) allowedByProvider[providerId] = new Set();
    if (modelId) allowedByProvider[providerId].add(modelId);
  }

  return Object.fromEntries(
    Object.entries(providers)
      .filter(([id]) => id in allowedByProvider)
      .map(([id, info]) => {
        const specificModels = allowedByProvider[id];
        if (specificModels.size > 0) {
          const filtered = info.models?.filter((m) => specificModels.has(m));
          return [id, { ...info, models: filtered?.length ? filtered : [...specificModels] }];
        }
        return [id, info];
      }),
  );
}

/**
 * Carrega els providers TTS del DB admin config (sense exposar les API keys).
 * Retorna providers amb apiKey configurada, i providers que no requereixen API key.
 */
async function getDbTtsProviders(): Promise<ProviderMap> {
  const row = await prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } });
  if (!row) return {};

  const config = JSON.parse(row.value) as {
    ttsProvidersConfig?: Record<string, { apiKey?: string; baseUrl?: string }>;
  };

  const result: ProviderMap = {};
  for (const [pid, cfg] of Object.entries(config.ttsProvidersConfig ?? {})) {
    const provider = TTS_PROVIDERS[pid as TTSProviderId];
    if (!cfg.apiKey && provider?.requiresApiKey !== false) continue;
    const entry: ProviderEntry = {};
    if (cfg.baseUrl) entry.baseUrl = cfg.baseUrl;
    result[pid] = entry;
  }
  return result;
}

export async function GET(req: NextRequest) {
  try {
    // Providers buits per defecte; es poblen des de la BD si hi ha sessió
    let providers: ProviderMap = {};
    let tts: ProviderMap = {};

    try {
      const session = await getSession(req);
      const role = (session?.user as { role?: string } | undefined)?.role;

      if (role === 'user') {
        // Usuari no-admin: providers del DB + filtre allowedModels
        providers = await getDbProviders();

        const allowedRow = await prisma.adminConfig.findUnique({ where: { key: 'allowedModels' } });
        const allowedModels: string[] | null = allowedRow ? JSON.parse(allowedRow.value) : null;
        providers = applyAllowedModelsFilter(providers, allowedModels);

        tts = await getDbTtsProviders();
      }
      // Admin: no cal retornar res aquí — hidrata des de /api/admin/config/providers
      // Sense sessió: providers buits (el client usa defaults del codi)
    } catch {
      // Si no hi ha BD o error de sessió, retornem providers buits
    }

    return apiSuccess({
      providers,
      tts,
      asr: {},
      pdf: {},
      image: {},
      video: {},
      webSearch: {},
    });
  } catch (error) {
    log.error('Error fetching server providers:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
