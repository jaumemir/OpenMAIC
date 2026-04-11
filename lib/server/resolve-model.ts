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
import { resolveApiKeyFromDb } from '@/lib/server/db-provider-config';
import { validateUrlForSSRF } from '@/lib/server/ssrf-guard';

export interface ResolvedModel extends ModelWithInfo {
  /** Original model string (e.g. "openai/gpt-4o-mini") */
  modelString: string;
  /** Effective API key after server-side fallback resolution */
  apiKey: string;
}

const SENTINEL = '__STORED__';

/**
 * Resolve a language model from explicit parameters.
 *
 * Use this when model config comes from the request body.
 */
export async function resolveModel(params: {
  modelString?: string;
  apiKey?: string;
  baseUrl?: string;
  providerType?: string;
  requiresApiKey?: boolean;
}): Promise<ResolvedModel> {
  const modelString = params.modelString || process.env.DEFAULT_MODEL || 'gpt-4o-mini';
  const { providerId, modelId } = parseModelString(modelString);

  const clientBaseUrl = params.baseUrl || undefined;
  if (clientBaseUrl && process.env.NODE_ENV === 'production') {
    const ssrfError = validateUrlForSSRF(clientBaseUrl);
    if (ssrfError) {
      throw new Error(ssrfError);
    }
  }

  // Normalize client key: treat sentinel and empty string the same (no client key)
  const clientKey = params.apiKey && params.apiKey !== SENTINEL ? params.apiKey : undefined;

  // Resolve API key: client → YAML/env → DB (always, even if clientBaseUrl is set).
  // The clientBaseUrl shortcut is only taken when the client also provides a real key,
  // which means it's a user-configured custom provider. If only the URL is provided
  // (e.g. server-configured provider with a custom baseUrl but key in DB), fall through
  // to the standard resolution path.
  let apiKey: string;
  if (clientBaseUrl && clientKey) {
    // User provided both URL and key explicitly → fully custom provider
    apiKey = clientKey;
  } else {
    // Standard resolution: client key → YAML/env → DB
    apiKey = resolveApiKey(providerId, clientKey);
    if (!apiKey) {
      apiKey = await resolveApiKeyFromDb(providerId);
    }
  }

  const baseUrl = clientBaseUrl ? clientBaseUrl : resolveBaseUrl(providerId, params.baseUrl);
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
 * Reads: x-model, x-api-key, x-base-url, x-provider-type, x-requires-api-key
 */
export async function resolveModelFromHeaders(req: NextRequest): Promise<ResolvedModel> {
  return resolveModel({
    modelString: req.headers.get('x-model') || undefined,
    apiKey: req.headers.get('x-api-key') || undefined,
    baseUrl: req.headers.get('x-base-url') || undefined,
    providerType: req.headers.get('x-provider-type') || undefined,
    requiresApiKey: req.headers.get('x-requires-api-key') === 'true' ? true : undefined,
  });
}
