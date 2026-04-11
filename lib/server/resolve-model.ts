/**
 * Shared model resolution utilities for API routes.
 *
 * Extracts the repeated parseModelString → resolveApiKey → resolveBaseUrl →
 * resolveProxy → getModel boilerplate into a single call.
 *
 * Key resolution order:
 *   1. Client-provided key (header or body) — if not empty and not '__STORED__'
 *   2. YAML/env via resolveApiKey
 *   3. AdminConfig DB via resolveApiKeyFromDb
 */

import type { NextRequest } from 'next/server';
import { getModel, parseModelString, type ModelWithInfo } from '@/lib/ai/providers';
import { resolveApiKey, resolveBaseUrl, resolveProxy } from '@/lib/server/provider-config';
import { resolveApiKeyFromDb, resolveBaseUrlFromDb } from '@/lib/server/db-provider-config';

export interface ResolvedModel extends ModelWithInfo {
  /** Original model string (e.g. "openai/gpt-4o-mini") */
  modelString: string;
  /** Effective API key after server-side fallback resolution */
  apiKey: string;
}

/**
 * Resolve a language model fully server-side.
 * Resolution order: YAML/env → AdminConfig DB.
 * The client only provides the model identifier — never keys or base URLs.
 */
export async function resolveModel(params: {
  modelString?: string;
  providerType?: string;
  requiresApiKey?: boolean;
}): Promise<ResolvedModel> {
  const modelString = params.modelString || process.env.DEFAULT_MODEL || 'gpt-4o-mini';
  const { providerId, modelId } = parseModelString(modelString);

  // API key: YAML/env → DB
  let apiKey = resolveApiKey(providerId);
  if (!apiKey) {
    apiKey = await resolveApiKeyFromDb(providerId);
  }

  // Base URL: YAML/env → DB
  let baseUrl = resolveBaseUrl(providerId);
  if (!baseUrl) {
    baseUrl = await resolveBaseUrlFromDb(providerId);
  }

  const proxy = resolveProxy(providerId);
  const { model, modelInfo } = getModel({
    providerId,
    modelId,
    apiKey,
    baseUrl,
    proxy,
    providerType: params.providerType as 'openai' | 'anthropic' | 'google' | undefined,
    requiresApiKey: params.requiresApiKey,
  });

  return { model, modelInfo, modelString, apiKey };
}

/**
 * Resolve a language model from standard request headers.
 *
 * Reads: x-model, x-provider-type, x-requires-api-key
 */
export async function resolveModelFromHeaders(req: NextRequest): Promise<ResolvedModel> {
  return resolveModel({
    modelString: req.headers.get('x-model') || undefined,
    providerType: req.headers.get('x-provider-type') || undefined,
    requiresApiKey: req.headers.get('x-requires-api-key') === 'true' ? true : undefined,
  });
}
