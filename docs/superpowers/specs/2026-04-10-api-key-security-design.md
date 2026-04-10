# Disseny: Seguretat de claus API i resolució server-side

**Data:** 2026-04-10  
**Branca destí:** tmp/jaume  
**Estat:** Aprovat

---

## Problema

Dos problemes connectats:

1. **Bug: usuaris `user` no poden generar cursos** — Les rutes de generació (`/api/generate/scene-outlines-stream`, `/api/web-search`, etc.) usen `resolveModelFromHeaders` per obtenir el model i la clau API. Per als usuaris `user`, `fetchServerProviders()` retorna providers sense `apiKey` (disseny correcte), de manera que el client envia `x-api-key: ''`. `resolveApiKey` busca la clau a YAML/env però no a la BD (AdminConfig), retorna `''` i l'SDK LLM llança `"API key required for provider: anthropic"`.

2. **Seguretat: claus API visibles a la xarxa** — `GET /api/admin/config/providers` retorna les claus desxifrades en el cos JSON → s'emmagatzemen a `useSettingsStore` → es reenvien en cada petició de generació via `x-api-key`. Les claus viatgen per la xarxa innecessàriament; un cop a BD no haurien de sortir mai del servidor.

---

## Solució: Enfocament B — Claus sempre al servidor

Les claus API resideixen **exclusivament** al servidor (BD + env vars). El browser mai les rep ni les envia.

### Principis

- El servidor resol la clau des de BD quan el client no n'envia cap.
- El client envia `x-api-key` **buit** per a providers server-configured; el servidor fa la resolució.
- L'endpoint admin retorna un sentinel `"__STORED__"` en lloc de la clau real.
- La UI distingeix "clau guardada (no visible)" de "cap clau" sense revelar el valor.

---

## Arquitectura

### Part 1: Resolució server-side de claus des de BD

**Fitxer nou:** `lib/server/db-provider-config.ts`

```typescript
// Retorna la clau API desxifrada des de AdminConfig per al provider donat.
// configSection: 'providersConfig' | 'ttsProvidersConfig' | 'imageProvidersConfig' | etc.
// Retorna '' si no existeix o si hi ha error.
export async function resolveApiKeyFromDb(
  providerId: string,
  configSection: string = 'providersConfig',
): Promise<string>
```

Implementació:
1. `prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } })`
2. JSON.parse + accés al `configSection[providerId].apiKey`
3. `decryptValue(encryptedKey)` si el valor és en format `"iv:authTag:ciphertext"`
4. Retorna `''` en cas d'error (per no trencar la cadena de resolució)

**Canvis a `lib/server/resolve-model.ts`:**

`resolveModel` i `resolveModelFromHeaders` passen a ser `async`. Ordre de resolució de la clau:

1. Header `x-api-key` (si no és `''` ni `"__STORED__"`)
2. YAML/env via `resolveApiKey(providerId, clientKey)` existent
3. BD via `resolveApiKeyFromDb(providerId)` ← nou fallback final

```typescript
export async function resolveModel(params: { ... }): Promise<ResolvedModel>
export async function resolveModelFromHeaders(req: NextRequest): Promise<ResolvedModel>
```

**Rutes afectades** (totes ja eren `async`, afegir `await`):
- `app/api/generate/scene-outlines-stream/route.ts`
- `app/api/generate/scene-actions/route.ts`
- `app/api/web-search/route.ts`
- `app/api/pbl/chat/route.ts`
- `app/api/quiz-grade/route.ts`
- `app/api/generate/agent-profiles/route.ts`
- `app/api/chat/route.ts`

---

### Part 2: Mascarar claus a l'endpoint admin

**Sentinel:** `"__STORED__"` — indica "hi ha una clau guardada, no modificar".

**`GET /api/admin/config/providers`:**

Després de desxifrar, aplicar `maskApiKeys(config)` que substitueix totes les `apiKey !== ''` per `"__STORED__"` en tots els sub-objectes de providers (`providersConfig`, `ttsProvidersConfig`, `asrProvidersConfig`, `pdfProvidersConfig`, `imageProvidersConfig`, `videoProvidersConfig`, `webSearchProvidersConfig`).

```typescript
function maskApiKeys(config: SerializableSettings): SerializableSettings
// Recorre tots els configSections i substitueix apiKey !== '' per "__STORED__"
```

**`PUT /api/admin/config/providers`:**

Al fer el deep merge, aplicar `stripSentinelKeys(incoming, existing)` que, per a cada provider, si `incoming[id].apiKey === "__STORED__"`, substitueix el valor entrant pel valor existent a BD (és a dir, no sobreescriu).

```typescript
function stripSentinelKeys(
  incoming: Record<string, { apiKey?: string; [k: string]: unknown }>,
  existing: Record<string, { apiKey?: string; [k: string]: unknown }>,
): Record<string, { apiKey?: string; [k: string]: unknown }>
// Si incoming[id].apiKey === "__STORED__" → usa existing[id].apiKey (ja desxifrat,
// perquè el PUT decrypta currentConfig abans del merge)
```

---

### Part 3: Client — headers de generació

**`lib/utils/model-config.ts` → `getCurrentModelConfig()`:**

```typescript
apiKey: providerConfig?.apiKey === '__STORED__' ? '' : (providerConfig?.apiKey || ''),
```

Resultat: quan la clau és el sentinel, s'envia `x-api-key: ''` → el servidor resol des de BD.

**`lib/hooks/use-scene-generator.ts` i `app/generation-preview/page.tsx`:**  
Cap canvi addicional necessari — ja usen `getCurrentModelConfig().apiKey`.

---

### Part 4: UI de Settings — input de clau API

**`components/settings/provider-config-panel.tsx`:**

Estat local `apiKey`:
- Si `initialApiKey === "__STORED__"` → estat inicial és `"__STORED__"`
- L'input renderitza diferent segons l'estat:
  - `"__STORED__"` → `value=""`, `placeholder={t('settings.apiKeyStored')}`, botó "Canviar" visible
  - Qualsevol altra cosa → comportament actual (input de text normal)
- En clicar "Canviar" (o focus a l'input quan és `"__STORED__"`) → estat passa a `''` per poder escriure
- En `onBlur` si el valor és `''` i l'estat inicial era `"__STORED__"` → restaurar `"__STORED__"` (l'usuari no ha canviat res)
- En guardar amb valor real → `onConfigChange(newRealKey, ...)` → `PUT` desa la clau nova

La icona "ull" s'amaga quan l'estat és `"__STORED__"` (no hi ha res a mostrar/ocultar).

**Panells de TTS, imatge, vídeo, cerca web:**  
Mateixa lògica. Revisar si tenen el seu propi input de clau o reutilitzen `provider-config-panel`. Aplicar el mateix patró on calgui.

**i18n — 3 idiomes** (`lib/i18n/settings.ts`):

| Clau | zh-CN | ca | en-US |
|------|-------|----|-------|
| `settings.apiKeyStored` | `已保存API密钥` | `Clau API emmagatzemada` | `API key stored` |

---

## Flux complet post-implementació

### Usuari `user` generant un curs

```
1. Login → fetchServerProviders() → apiKey absent al store
2. getCurrentModelConfig() → apiKey: '' (provider sense clau client)
3. Petició generació amb x-api-key: ''
4. resolveModelFromHeaders(req):
   a. Header buit → saltar
   b. YAML/env → no trobat
   c. BD (resolveApiKeyFromDb) → clau desxifrada ✓
5. Generació amb clau del servidor ✓
```

### Admin configurant una clau nova

```
1. GET /api/admin/config/providers → apiKey: "__STORED__" per a claus existents
2. UI mostra "Clau API emmagatzemada" en l'input
3. Admin clica "Canviar" → input buit, escriu nova clau
4. PUT /api/admin/config/providers → nova clau real
5. stripSentinelKeys() → desa la nova clau xifrada a BD
6. Network: clau viatja HTTPS només en aquest moment ✓
```

### Admin veient la configuració sense canviar res

```
1. GET → apiKey: "__STORED__"
2. UI mostra placeholder "Clau API emmagatzemada"
3. Admin no fa res / guarda → PUT amb "__STORED__"
4. stripSentinelKeys() → preserva clau existent a BD
5. Network: cap clau real viatja ✓
```

---

## Fitxers afectats

| Fitxer | Canvi |
|--------|-------|
| `lib/server/db-provider-config.ts` | **NOU** — `resolveApiKeyFromDb` |
| `lib/server/resolve-model.ts` | `resolveModel` + `resolveModelFromHeaders` → async + fallback BD |
| `app/api/admin/config/providers/route.ts` | `maskApiKeys` al GET, `stripSentinelKeys` al PUT |
| `lib/utils/model-config.ts` | Tractar `"__STORED__"` com a clau buida |
| `components/settings/provider-config-panel.tsx` | UI sentinel input |
| `lib/i18n/settings.ts` | Afegir `apiKeyStored` als 3 idiomes |
| 7 rutes de generació | Afegir `await` a `resolveModelFromHeaders` |

---

## Consideracions

- **Seguretat de `resolveApiKeyFromDb`**: la funció s'usa únicament en rutes server-side (Node.js runtime); mai en Edge runtime ni en components client.
- **Rendiment**: la consulta DB és cacheada implícitament per connexió de Prisma; no cal cache manual per ara.
- **Providers user-provided (no server-configured)**: si un usuari entra una clau manualment en un provider que **no** és server-configured (cas poc freqüent), la clau continuarà enviant-se via header com fins ara. `resolveApiKeyFromDb` no la trobarà i el header serà la font.
- **Scope**: no s'aplica la mateixa lògica de mascarament als endpoints de TTS/image/video/websearch (per ara); la resolució via BD al servidor sí cobreix tots els tipus gràcies al `configSection` paràmetre.
