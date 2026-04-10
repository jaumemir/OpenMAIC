# API Key Security — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar les API keys del trànsit de xarxa del browser i corregir el bug que impedeix als usuaris `user` generar cursos.

**Architecture:** Es crea un resolver async que llegeix claus xifrades directament des de la BD com a fallback final. L'endpoint admin retorna un sentinel `"__STORED__"` en lloc de claus reals; el PUT preserva la clau existent si rep el sentinel. La UI mostra placeholder localitzat quan la clau ja està guardada.

**Tech Stack:** TypeScript, Prisma 5, Next.js 16 App Router, Vitest, React 19, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-04-10-api-key-security-design.md`

---

## Fitxers implicats

| Fitxer | Acció |
|--------|-------|
| `lib/server/db-provider-config.ts` | Crear — `resolveApiKeyFromDb` |
| `tests/server/db-provider-config.test.ts` | Crear — tests unitaris |
| `lib/server/resolve-model.ts` | Modificar — `resolveModel`/`resolveModelFromHeaders` → async |
| `lib/server/admin-config-mask.ts` | Crear — `maskApiKeys`, `stripSentinelApiKeys` (funcions pures) |
| `tests/server/admin-config-mask.test.ts` | Crear — tests unitaris |
| `app/api/admin/config/providers/route.ts` | Modificar — GET mask, PUT strip sentinel |
| `app/api/generate/scene-outlines-stream/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/generate/scene-actions/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/web-search/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/pbl/chat/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/quiz-grade/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/generate/agent-profiles/route.ts` | Modificar — `await resolveModelFromHeaders` |
| `app/api/chat/route.ts` | Modificar — `await resolveModel` |
| `lib/utils/model-config.ts` | Modificar — tractar `"__STORED__"` com a clau buida |
| `lib/i18n/settings.ts` | Modificar — afegir `apiKeyStored` als 3 idiomes |
| `components/settings/provider-config-panel.tsx` | Modificar — UI sentinel |

---

## Task 1: Crear `lib/server/db-provider-config.ts`

**Files:**
- Create: `lib/server/db-provider-config.ts`
- Create: `tests/server/db-provider-config.test.ts`

- [ ] **Step 1.1: Escriure el test que falla**

Crea `tests/server/db-provider-config.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminConfig: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock config-crypto: decrypt returns the value as-is (no encryption key in test env)
vi.mock('@/lib/server/config-crypto', () => ({
  decrypt: (v: string) => v,
}));

describe('resolveApiKeyFromDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when no globalConfig row exists', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue(null);

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });

  it('returns decrypted apiKey for a provider in providersConfig', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        providersConfig: {
          anthropic: { apiKey: 'sk-ant-stored', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('sk-ant-stored');
  });

  it('returns empty string when provider exists but apiKey is empty', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        providersConfig: {
          anthropic: { apiKey: '', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });

  it('returns empty string when provider is not in the config', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({ providersConfig: {} }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('openai')).toBe('');
  });

  it('resolves key from a non-default configSection (ttsProvidersConfig)', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        ttsProvidersConfig: {
          'openai-tts': { apiKey: 'sk-tts-key', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('openai-tts', 'ttsProvidersConfig')).toBe('sk-tts-key');
  });

  it('returns empty string and does not throw when prisma throws', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockRejectedValue(new Error('DB error'));

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });
});
```

- [ ] **Step 1.2: Executar el test per verificar que falla**

```bash
pnpm test -- tests/server/db-provider-config.test.ts --reporter=verbose
```

Esperat: error `Cannot find module '@/lib/server/db-provider-config'`

- [ ] **Step 1.3: Implementar `lib/server/db-provider-config.ts`**

```typescript
/**
 * DB-backed provider key resolution.
 *
 * Reads API keys directly from AdminConfig (Prisma) as a server-side fallback.
 * Used when the client does not supply a key (user role, or admin with masked key).
 * Never exposes keys to the client.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/server/config-crypto';

export type DbConfigSection =
  | 'providersConfig'
  | 'ttsProvidersConfig'
  | 'asrProvidersConfig'
  | 'pdfProvidersConfig'
  | 'imageProvidersConfig'
  | 'videoProvidersConfig'
  | 'webSearchProvidersConfig';

/**
 * Returns the decrypted API key for a provider stored in AdminConfig.
 * Returns '' when the key does not exist or on any error.
 *
 * @param providerId   Provider identifier (e.g. 'anthropic', 'openai')
 * @param configSection  Which sub-config object to look in (default: 'providersConfig')
 */
export async function resolveApiKeyFromDb(
  providerId: string,
  configSection: DbConfigSection = 'providersConfig',
): Promise<string> {
  try {
    const row = await prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } });
    if (!row) return '';

    const config = JSON.parse(row.value) as Record<
      string,
      Record<string, { apiKey?: string }> | undefined
    >;
    const section = config[configSection];
    if (!section) return '';

    const entry = section[providerId];
    if (!entry?.apiKey) return '';

    return decrypt(entry.apiKey);
  } catch {
    return '';
  }
}
```

- [ ] **Step 1.4: Executar el test per verificar que passa**

```bash
pnpm test -- tests/server/db-provider-config.test.ts --reporter=verbose
```

Esperat: tots els tests en PASS

- [ ] **Step 1.5: Commit**

```bash
git add lib/server/db-provider-config.ts tests/server/db-provider-config.test.ts
git commit -m "feat(server): add resolveApiKeyFromDb — DB-backed key resolution fallback"
```

---

## Task 2: Fer `resolveModel` i `resolveModelFromHeaders` async

**Files:**
- Modify: `lib/server/resolve-model.ts`

- [ ] **Step 2.1: Actualitzar `lib/server/resolve-model.ts`**

Substitueix el contingut complet del fitxer:

```typescript
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
  const clientKey =
    params.apiKey && params.apiKey !== SENTINEL ? params.apiKey : undefined;

  let apiKey: string;
  if (clientBaseUrl) {
    // Custom base URL: client key required (user-provided provider)
    apiKey = clientKey || '';
  } else {
    // Standard provider: resolve from client → YAML/env → DB
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
```

- [ ] **Step 2.2: Verificar que els tests existents continuen passant**

```bash
pnpm test -- tests/server/ --reporter=verbose
```

Esperat: tots els tests de `tests/server/` en PASS (els tests de `provider-config.test.ts` no depenen de `resolve-model.ts`)

- [ ] **Step 2.3: Commit**

```bash
git add lib/server/resolve-model.ts
git commit -m "feat(server): make resolveModel async with DB fallback for API key resolution"
```

---

## Task 3: Afegir `await` a les 7 rutes que criden `resolveModel`/`resolveModelFromHeaders`

**Files:**
- Modify: `app/api/generate/scene-outlines-stream/route.ts` (línia ~106)
- Modify: `app/api/generate/scene-actions/route.ts` (línia ~83)
- Modify: `app/api/web-search/route.ts` (línia ~56)
- Modify: `app/api/pbl/chat/route.ts` (línia ~39)
- Modify: `app/api/quiz-grade/route.ts` (línia ~42)
- Modify: `app/api/generate/agent-profiles/route.ts` (línia ~69)
- Modify: `app/api/chat/route.ts` (línia ~66)

- [ ] **Step 3.1: `scene-outlines-stream/route.ts`**

Cerca la línia:
```typescript
const { model: languageModel, modelInfo, modelString } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model: languageModel, modelInfo, modelString } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.2: `scene-actions/route.ts`**

Cerca:
```typescript
const { model: languageModel, modelInfo, modelString } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model: languageModel, modelInfo, modelString } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.3: `web-search/route.ts`**

Cerca:
```typescript
const { model: languageModel } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model: languageModel } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.4: `pbl/chat/route.ts`**

Cerca:
```typescript
const { model } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.5: `quiz-grade/route.ts`**

Cerca:
```typescript
const { model: languageModel } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model: languageModel } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.6: `generate/agent-profiles/route.ts`**

Cerca:
```typescript
const { model: languageModel, modelString: _modelString } = resolveModelFromHeaders(req);
```
Substitueix per:
```typescript
const { model: languageModel, modelString: _modelString } = await resolveModelFromHeaders(req);
```

- [ ] **Step 3.7: `chat/route.ts`**

Cerca:
```typescript
const { model: languageModel, apiKey: resolvedApiKey } = resolveModel({
```
Substitueix per:
```typescript
const { model: languageModel, apiKey: resolvedApiKey } = await resolveModel({
```

- [ ] **Step 3.8: Verificar que el servidor arrenca sense errors TypeScript**

```bash
pnpm build 2>&1 | head -50
```

Si hi ha errors de tipus, corregir-los. Esperat: build net o els mateixos warnings pre-existents.

- [ ] **Step 3.9: Commit**

```bash
git add \
  app/api/generate/scene-outlines-stream/route.ts \
  app/api/generate/scene-actions/route.ts \
  app/api/web-search/route.ts \
  app/api/pbl/chat/route.ts \
  app/api/quiz-grade/route.ts \
  app/api/generate/agent-profiles/route.ts \
  app/api/chat/route.ts
git commit -m "fix(routes): await async resolveModel/resolveModelFromHeaders in all generation routes"
```

---

## Task 4: Crear `lib/server/admin-config-mask.ts` amb `maskApiKeys` i `stripSentinelApiKeys`

**Files:**
- Create: `lib/server/admin-config-mask.ts`
- Create: `tests/server/admin-config-mask.test.ts`

- [ ] **Step 4.1: Escriure el test que falla**

Crea `tests/server/admin-config-mask.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { maskApiKeys, stripSentinelApiKeys } from '@/lib/server/admin-config-mask';
import type { SerializableSettings } from '@/app/api/admin/config/providers/route';

const SENTINEL = '__STORED__';

// Helper per crear SerializableSettings de test sense haver de satisfer tots els camps
function cfg(partial: Record<string, { apiKey: string; [k: string]: unknown }>): SerializableSettings {
  return { providersConfig: partial as SerializableSettings['providersConfig'] };
}

describe('maskApiKeys', () => {
  it('replaces non-empty apiKeys with sentinel', () => {
    const config = cfg({
      anthropic: { apiKey: 'sk-real-key', baseUrl: '' },
      openai: { apiKey: 'sk-openai', baseUrl: '' },
    });
    const masked = maskApiKeys(config);
    expect(masked.providersConfig?.anthropic.apiKey).toBe(SENTINEL);
    expect(masked.providersConfig?.openai.apiKey).toBe(SENTINEL);
  });

  it('leaves empty apiKeys as empty string', () => {
    const config = cfg({ openai: { apiKey: '', baseUrl: '' } });
    const masked = maskApiKeys(config);
    expect(masked.providersConfig?.openai.apiKey).toBe('');
  });

  it('masks keys in ttsProvidersConfig', () => {
    const config: SerializableSettings = {
      ttsProvidersConfig: {
        'openai-tts': { apiKey: 'sk-tts', baseUrl: '', enabled: true },
      },
    };
    const masked = maskApiKeys(config);
    expect(masked.ttsProvidersConfig?.['openai-tts'].apiKey).toBe(SENTINEL);
  });

  it('does not mutate the original config', () => {
    const config = cfg({ anthropic: { apiKey: 'sk-real', baseUrl: '' } });
    maskApiKeys(config);
    expect(config.providersConfig?.anthropic.apiKey).toBe('sk-real');
  });
});

describe('stripSentinelApiKeys', () => {
  it('preserves existing key when incoming is sentinel', () => {
    const incoming = { anthropic: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-existing', baseUrl: '' } };
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('sk-existing');
  });

  it('uses new key when incoming is a real key', () => {
    const incoming = { anthropic: { apiKey: 'sk-new-key', baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-old', baseUrl: '' } };
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('sk-new-key');
  });

  it('uses empty string when incoming is empty and no existing key', () => {
    const incoming = { anthropic: { apiKey: '', baseUrl: '' } };
    const existing = {};
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('');
  });

  it('handles new provider not in existing', () => {
    const incoming = { newprovider: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = {};
    const result = stripSentinelApiKeys(incoming, existing);
    // Sentinel with no existing key → empty string
    expect(result.newprovider.apiKey).toBe('');
  });

  it('does not mutate the incoming object', () => {
    const incoming = { anthropic: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-existing', baseUrl: '' } };
    stripSentinelApiKeys(incoming, existing);
    expect(incoming.anthropic.apiKey).toBe(SENTINEL);
  });
});
```

- [ ] **Step 4.2: Executar el test per verificar que falla**

```bash
pnpm test -- tests/server/admin-config-mask.test.ts --reporter=verbose
```

Esperat: error `Cannot find module '@/lib/server/admin-config-mask'`

- [ ] **Step 4.3: Implementar `lib/server/admin-config-mask.ts`**

```typescript
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
```

- [ ] **Step 4.4: Executar el test per verificar que passa**

```bash
pnpm test -- tests/server/admin-config-mask.test.ts --reporter=verbose
```

Esperat: tots els tests en PASS

- [ ] **Step 4.5: Commit**

```bash
git add lib/server/admin-config-mask.ts tests/server/admin-config-mask.test.ts
git commit -m "feat(server): add admin-config-mask helpers for API key sentinel handling"
```

---

## Task 5: Actualitzar `GET` i `PUT` de l'endpoint admin de providers

**Files:**
- Modify: `app/api/admin/config/providers/route.ts`

- [ ] **Step 5.1: Afegir imports i modificar el GET**

Al principi del fitxer, afegir l'import (just after the existing imports):

```typescript
import { maskApiKeys, stripSentinelApiKeys } from '@/lib/server/admin-config-mask';
```

Al `GET`, localitza el bloc just abans del `return apiSuccess`:
```typescript
  // Sempre fusionar amb els providers del codi per reflectir models nous
  config = mergeWithBuiltInProviders(config);

  // Afegir allowedModels des del seu propi key (retrocompat)
  // ...

  return apiSuccess({ config, exists: !!row });
```

Substitueix el `return apiSuccess(...)` per:
```typescript
  return apiSuccess({ config: maskApiKeys(config), exists: !!row });
```

- [ ] **Step 5.2: Modificar el `PUT` per aplicar `stripSentinelApiKeys` abans del merge**

Al `PUT`, localitza el bloc del merge profund (línies ~208-233 del fitxer original). Substitueix el merge de `providersConfig`, `ttsProvidersConfig`, ... `webSearchProvidersConfig` per:

```typescript
  // Merge: els updates sobreescriuen, però configs de proveïdors es fan en deep merge per proveïdor.
  // stripSentinelApiKeys preserva la clau existent quan el client envia '__STORED__'.
  const merged: SerializableSettings = {
    ...currentConfig,
    ...updates,
    providersConfig: updates.providersConfig
      ? {
          ...currentConfig.providersConfig,
          ...stripSentinelApiKeys(
            updates.providersConfig as Record<string, { apiKey?: string }>,
            currentConfig.providersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.providersConfig,
    ttsProvidersConfig: updates.ttsProvidersConfig
      ? {
          ...currentConfig.ttsProvidersConfig,
          ...stripSentinelApiKeys(
            updates.ttsProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.ttsProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.ttsProvidersConfig,
    asrProvidersConfig: updates.asrProvidersConfig
      ? {
          ...currentConfig.asrProvidersConfig,
          ...stripSentinelApiKeys(
            updates.asrProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.asrProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.asrProvidersConfig,
    pdfProvidersConfig: updates.pdfProvidersConfig
      ? {
          ...currentConfig.pdfProvidersConfig,
          ...stripSentinelApiKeys(
            updates.pdfProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.pdfProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.pdfProvidersConfig,
    imageProvidersConfig: updates.imageProvidersConfig
      ? {
          ...currentConfig.imageProvidersConfig,
          ...stripSentinelApiKeys(
            updates.imageProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.imageProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.imageProvidersConfig,
    videoProvidersConfig: updates.videoProvidersConfig
      ? {
          ...currentConfig.videoProvidersConfig,
          ...stripSentinelApiKeys(
            updates.videoProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.videoProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.videoProvidersConfig,
    webSearchProvidersConfig: updates.webSearchProvidersConfig
      ? {
          ...currentConfig.webSearchProvidersConfig,
          ...stripSentinelApiKeys(
            updates.webSearchProvidersConfig as Record<string, { apiKey?: string }>,
            currentConfig.webSearchProvidersConfig as Record<string, { apiKey?: string }> ?? {},
          ),
        }
      : currentConfig.webSearchProvidersConfig,
  };
```

- [ ] **Step 5.3: Verificar que els tests existents continuen passant i el build és net**

```bash
pnpm test --reporter=verbose 2>&1 | tail -20
pnpm build 2>&1 | grep -E "error|Error" | head -20
```

Esperat: tests en PASS, build sense errors nous.

- [ ] **Step 5.4: Commit**

```bash
git add app/api/admin/config/providers/route.ts
git commit -m "feat(admin): mask API keys in GET response, strip sentinel in PUT merge"
```

---

## Task 6: Client — tractar sentinel com a clau buida + i18n

**Files:**
- Modify: `lib/utils/model-config.ts`
- Modify: `lib/i18n/settings.ts`

- [ ] **Step 6.1: Actualitzar `lib/utils/model-config.ts`**

Substitueix la funció `getCurrentModelConfig` per:

```typescript
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
```

- [ ] **Step 6.2: Afegir `apiKeyStored` als 3 idiomes a `lib/i18n/settings.ts`**

Al bloc `zh-CN` (prop de la línia 18), afegir just després de `apiKeyRequired`:
```typescript
    apiKeyRequired: 'API密钥不能为空',
    apiKeyStored: '已保存API密钥',
```

Al bloc `ca` (prop de la línia 641):
```typescript
    apiKeyRequired: 'La clau API no pot estar buida',
    apiKeyStored: 'Clau API emmagatzemada',
```

Al bloc `en-US` (prop de la línia 1275):
```typescript
    apiKeyRequired: 'API key cannot be empty',
    apiKeyStored: 'API key stored',
```

- [ ] **Step 6.3: Verificar que `pnpm check` (Prettier) és net**

```bash
pnpm check
```

Si falla, executar `pnpm format` i verificar de nou.

- [ ] **Step 6.4: Commit**

```bash
git add lib/utils/model-config.ts lib/i18n/settings.ts
git commit -m "feat(client): treat __STORED__ sentinel as empty key; add apiKeyStored i18n"
```

---

## Task 7: UI — `provider-config-panel.tsx` amb suport per al sentinel

**Files:**
- Modify: `components/settings/provider-config-panel.tsx`

- [ ] **Step 7.1: Afegir constant i actualitzar la lògica d'estat de l'input**

A `provider-config-panel.tsx`, just before the component function declaration, afegir:

```typescript
const SENTINEL = '__STORED__';
```

Actualitzar la funció `handleApiKeyChange` (ja existent) — cap canvi aquí. Afegir dos handlers nous just a sota de `handleApiKeyChange`:

```typescript
  // Clear sentinel on focus so user can type a new key
  const handleApiKeyFocus = () => {
    if (apiKey === SENTINEL) {
      setApiKey('');
      onConfigChange('', baseUrl, requiresApiKey);
    }
  };

  // Restore sentinel on blur if user did not type a new value
  const handleApiKeyBlur = () => {
    if (apiKey === '' && initialApiKey === SENTINEL) {
      setApiKey(SENTINEL);
      onConfigChange(SENTINEL, baseUrl, requiresApiKey);
    }
    onSave();
  };
```

- [ ] **Step 7.2: Actualitzar el renderitzat de l'input de clau API**

Substitueix el bloc de l'`<Input>` de API key (des de `<Input` fins a `/>` del primer input):

```tsx
            <Input
              name={`llm-api-key-${provider.id}`}
              type={showApiKey ? 'text' : 'password'}
              autoComplete="new-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={
                apiKey === SENTINEL
                  ? t('settings.apiKeyStored')
                  : isServerConfigured
                    ? t('settings.optionalOverride')
                    : 'sk-...'
              }
              value={apiKey === SENTINEL ? '' : apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              onFocus={handleApiKeyFocus}
              onBlur={handleApiKeyBlur}
              disabled={!requiresApiKey && !isServerConfigured}
              className="h-8 pr-8"
            />
```

- [ ] **Step 7.3: Ocultar el botó "ull" quan la clau és el sentinel**

Substitueix el bloc del botó `<button type="button" onClick={() => setShowApiKey(!showApiKey)} ...>`:

```tsx
            {apiKey !== SENTINEL && (
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                disabled={!requiresApiKey}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
```

- [ ] **Step 7.4: Actualitzar el `onBlur` de l'input (eliminar el duplicat)**

L'input ara té `onBlur={handleApiKeyBlur}` (que ja crida `onSave`). Assegura't que no hi ha un `onBlur={onSave}` separat al mateix input — ja ho hem substituït al step 7.2.

- [ ] **Step 7.5: Executar linting i format**

```bash
pnpm lint 2>&1 | grep -E "error|Error" | head -20
pnpm check
```

Si hi ha errors de linting, corregir-los. Si `pnpm check` falla, executar `pnpm format`.

- [ ] **Step 7.6: Commit**

```bash
git add components/settings/provider-config-panel.tsx
git commit -m "feat(ui): show 'API key stored' placeholder when key is masked with sentinel"
```

---

## Task 8: Verificació final

- [ ] **Step 8.1: Executar tots els tests unitaris**

```bash
pnpm test --reporter=verbose
```

Esperat: tots en PASS. Si falla algun test, corregir la causa.

- [ ] **Step 8.2: Verificar el build de producció**

```bash
pnpm build 2>&1 | tail -30
```

Esperat: build net sense errors nous.

- [ ] **Step 8.3: Smoke test manual — usuari `user`**

1. Arrancar `pnpm dev`
2. Logar-se com a usuari `user`
3. Obrir DevTools → Network
4. Iniciar generació d'un curs
5. Verificar que cap petició a `/api/generate/*` o `/api/web-search` conté `x-api-key` amb un valor real (ha d'estar buit o absent)
6. Verificar que la generació acaba amb èxit (sense error 500 "API key required")

- [ ] **Step 8.4: Smoke test manual — usuari `admin`**

1. Logar-se com a `admin`
2. Obrir Settings → Providers
3. Verificar que el camp de clau API mostra el placeholder "Clau API emmagatzemada" (o equivalent) per als providers configurats
4. Verificar que la xarxa NO mostra la clau real a la resposta de `GET /api/admin/config/providers`
5. Canviar una clau (escriure una nova) → guardar → verificar que es desa correctament
6. Recarregar → verificar que torna a mostrar "Clau API emmagatzemada"

- [ ] **Step 8.5: Commit final si hi ha canvis menors pendents**

```bash
git status
# Si hi ha canvis:
git add -p
git commit -m "fix: address review comments from API key security implementation"
```
