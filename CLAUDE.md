# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projecte

**OpenMAIC** (Open Multi-Agent Interactive Classroom) és una plataforma AI de codi obert que transforma temes o documents en experiències d'aula interactives. Genera slides, quizzes, simulacions HTML interactives i activitats PBL, amb agents AI que parlen (TTS), dibuixen a la pissarra i fan discussions en viu.

- Llicència: AGPL-3.0
- Demo: <https://open.maic.chat/>

---

## Comandes essencials

```bash
pnpm install          # Instala deps + builda packages/ (pptxgenjs, mathml2omml)
pnpm dev              # Servidor de dev (port 3000)
pnpm build            # Build de producció
pnpm test             # Tests unitaris (Vitest)
pnpm test:e2e         # Tests E2E (Playwright)
pnpm lint             # ESLint (flat config)
pnpm format           # Prettier --write
pnpm check            # Prettier --check
pnpm db:migrate       # Aplica migracions SQLite (dev)
pnpm db:studio        # Prisma Studio per inspeccionar la BD
pnpm tsx scripts/create-admin.ts  # Crea el primer usuari admin interactivament
```

**Mai fer** `npm install` ni `yarn` — el projecte usa **pnpm 10** amb workspace.

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| State | Zustand 5 + Immer (en memòria; layoutStore persisteix a localStorage) |
| Storage server | Filesystem `/data/` (dev) · Object store (prod) |
| DB | Prisma 5 · SQLite (dev) · PostgreSQL (prod) |
| Auth | better-auth · Argon2id · sessions httpOnly |
| LLM | Vercel AI SDK 6 (@ai-sdk/openai, anthropic, google) |
| Orquestració | LangGraph 1.1 (@langchain/langgraph) |
| Tests unitaris | Vitest 4 |
| Tests E2E | Playwright 1.58 |
| TypeScript | 5, strict mode, alias `@/*` → root |
| Package manager | pnpm 10.28 |

---

## Arquitectura

### Pipeline de generació (2 etapes)

```
Input usuari
  → Stage 1: outline-generator.ts   → SceneOutline[]   (títol, tipus, punts clau)
  → Stage 2: scene-generator.ts     → Scene[]          (elements, accions, imatges)
  → Storage (servidor: /api/stages/*)
  → classroom/[id] playback
```

**Dos camins de generació al frontend:**
- `app/generation-preview/page.tsx` — primera escena, crida directa a l'API
- `lib/hooks/use-scene-generator.ts` — escenes 2+, via hook

Ambdós camins han de rebre `stageInfo.themeId` o el theme no s'aplica.

### Sistema d'accions (28+ tipus)

Les accions són la unitat d'interacció dels agents: `speech`, `spotlight`, `laser`, `wb_draw_text`, `wb_draw_shape`, `wb_draw_chart`, `wb_draw_latex`, `wb_draw_table`, `wb_draw_line`, `wb_eraser`, `discussion`, etc.

Mateix tipus usat en playback offline i en mode live. Definits a `lib/types/action.ts`.

### Orquestració multi-agent (LangGraph)

```
START → director node → agent_generate node → director node → ... → END
```

El director decideix el torn següent (LLM decision o fast-path si és el primer torn).
Accions streamed via SSE a `app/api/chat/route.ts`.

### Autenticació

- **better-auth** gestiona sessions, login, logout, OAuth (si configurat)
- **Invitació per email**: Flux invitation-only; l'admin convida usuaris via `/api/admin/users`
- **Rols**: `admin` (configura proveïdors, veu tot) · `user` (crea cursos propis)
- **Protecció**: `requireAuth(req)` en totes les API routes; layout guard Server Component al panell admin
- **Middleware** (`proxy.ts`): Comprova presència de cookie de sessió (Edge-compatible); validació completa a `requireAuth()` (Node.js)

---

## Directoris clau

```
app/
  (admin)/              # Panell d'administrador (layout guard SSR)
    admin/
      page.tsx          # Dashboard: estadístiques + navegació
      users/            # Gestió d'usuaris (invitar, editar, desactivar)
      courses/          # Llista global de cursos amb propietari
      audit/            # Log d'auditoria
      config/           # Config global (models permesos)
  api/
    auth/               # better-auth routes + forgot/reset password
    admin/
      config/providers/ # GET/PUT config global encriptada (admin only)
      users/            # CRUD usuaris (admin only)
      audit/            # Log d'auditoria (admin only)
      stages/           # Tots els stages (admin only)
    generate/           # scene-outlines-stream, scene-content, scene-actions, tts, image, video
    chat/               # Multi-agent SSE
    stages/             # CRUD stages (owner-protected)
    themes/             # CRUD themes
    user/               # me, preferences
    generate-classroom/ # Job async (submit + poll)
    invitations/        # verify + accept token
  classroom/[id]/       # Playback
  generation-preview/   # Preview en temps real

lib/
  ai/
    providers.ts        # Registre de 20+ providers LLM
    llm.ts              # callLLM / streamLLM unificats + thinking adapter
  auth/
    server.ts           # Instància better-auth (server)
    client.ts           # useSession, signIn, signOut (client)
  audit.ts              # auditLog() helper + AuditAction union type
  generation/
    outline-generator.ts     # Stage 1
    scene-generator.ts       # Stage 2 (1,300 línies)
    generation-pipeline.ts
    prompts/templates/       # Plantilles de prompt (Markdown amb {{variables}})
    theme-instructions.ts    # resolveThemeManifest / resolveThemeInstructions / resolveThemeCSS
    theme-utils.ts           # themeToSlideTheme
  orchestration/
    director-graph.ts        # StateGraph LangGraph
  prisma.ts                  # PrismaClient singleton (patch DATABASE_URL per SQLite)
  server/
    api-response.ts          # requireAuth, apiSuccess, apiError
    config-crypto.ts         # encrypt/decrypt API keys (AES-256-GCM)
    classroom-job-store.ts   # CRUD ClassroomJob via Prisma
    scene-content-generation.ts
    theme-storage.ts
  store/
    settings.ts         # Config global admin (in-memory, hidratat des de BD)
    user-prefs.ts        # Preferències per usuari (in-memory, hidratat des de BD)
    layout.ts            # Layout efímer UI (persistit a localStorage)
    stage.ts             # Contingut del curs actiu
    media-generation.ts  # Estat de generació de media (imatges/vídeos)
  types/
    generation.ts        # UserRequirements, SceneOutline, PdfImage, ImageMapping
    slides.ts            # TextElement, ImageElement, ShapeElement, etc.
    stage.ts             # Scene, SlideContent, QuizContent, InteractiveContent, PBLContent
    action.ts            # Tots els tipus d'acció (discriminated union)
    provider.ts          # ModelInfo, ThinkingConfig, ThinkingCapability
    theme.ts             # ThemeManifest, ThemeListItem
    settings.ts          # SettingsState, SettingsSection
  utils/
    stage-storage.ts     # Crida /api/stages/* (server-only)
    outlines-storage.ts  # Crida /api/stages/[id]/outlines
    playback-storage.ts  # Crida /api/stages/[id]/playback
    chat-storage.ts      # No-ops (chats embeguts al stage JSON)
  themes/
    index.ts             # getBuiltInThemes()
    sistema/             # Theme built-in (versionat)

prisma/
  schema.dev.prisma      # SQLite (dev): User, Session, AdminConfig, AuditLog, UserPreferences, ...
  schema.prod.prisma     # PostgreSQL (prod): mateix schema, tipus adaptats
  migrations/            # Migracions SQLite aplicades

data/themes/             # Themes custom (servidor, .gitignore excepte gencat)
  gencat/                # Theme Generalitat Catalunya (versionat com a demo)

components/
  slide-renderer/        # Editor canvas-based
  scene-renderers/       # slide, quiz, interactive, pbl
  generation/            # Toolbar, theme-popover
  settings/              # Settings panel + seccions (admin-only sections protected)
  whiteboard/            # SVG whiteboard

packages/
  pptxgenjs/             # Fork customitzat de pptxgenjs
  mathml2omml/           # MathML → Office Math XML

tests/                   # Vitest (*.test.ts)
e2e/                     # Playwright
```

---

## Fitxers de configuració importants

| Fitxer | Propòsit |
|--------|---------|
| `.env.local` | API keys i config (no versionat) |
| `.env.example` | Plantilla completa de variables |
| `server-providers.yml` | Config de providers sense BD (opcional; muntat en Docker com `:ro`) |
| `next.config.ts` | Build standalone, límit proxy 200MB |
| `tsconfig.json` | Strict, alias `@/*` |
| `vitest.config.ts` | Unit tests, alias `@/*` |
| `components.json` | Config shadcn/ui |

---

## Variables d'entorn crítiques

```bash
# Auth
BETTER_AUTH_SECRET=          # Secret per signar sessions (obligatori)
BETTER_AUTH_URL=             # Base URL (p.ex. http://localhost:3000)

# Encriptació de configuració admin
CONFIG_ENCRYPTION_KEY=       # 64 hex chars = 32 bytes (AES-256-GCM)

# LLM (un o més)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# BD (dev: SQLite automàtic; prod: obligatori)
DATABASE_URL=                # postgresql://... (prod)

# Email (per invitacions i reset password)
ACS_CONNECTION_STRING=       # Azure Communication Services
ACS_SENDER_ADDRESS=

# Model per defecte (servidor)
DEFAULT_MODEL=google:gemini-2.5-flash-preview

# Logging
LOG_LEVEL=info
LOG_FORMAT=pretty            # o 'json'
```

Veure `.env.example` per la llista completa (TTS, ASR, imatge, vídeo, PDF, cerca web).

---

## Patrons importants

### Prompt templates amb variables

Les plantilles de prompt estan a `lib/generation/prompts/templates/*/system.md`.
Variables amb doble claudàtor: `{{themeInstructions}}`, `{{themePrimary}}`, `{{themeSecondary}}`.
`interpolateVariables` deixa el literal `{{placeholder}}` si el valor és `undefined` → sempre passar `''` com a fallback.

### Themes

- **Built-in:** `lib/themes/{id}/` (codi font, versionats, `builtIn: true`)
- **Custom:** `data/themes/{id}/` (servidor, majoritàriament no versionats)
- `ThemeManifest` té: `colors.primary/secondary`, `modelInstructions` (afegit al system prompt), `assets`
- Resolució: `resolveThemeManifest(themeId)` + `resolveThemeInstructions(themeId)` en paral·lel via `Promise.all`
- `{{themePrimary}}` i `{{themeSecondary}}` s'injecten als prompts de slides com a colors principals
- El CSS del theme s'injecta al HTML interactiu generat via `resolveThemeCSS(themeId)`

### Extended Thinking

`callLLM` accepta un quart paràmetre `ThinkingConfig { enabled?, budgetTokens? }`.
El mòdul `llm.ts` detecta automàticament les capacitats del model i adapta el format a cada provider (OpenAI: `reasoningEffort`, Anthropic: `thinking.type+budgetTokens`, Google: `thinkingConfig.thinkingBudget`).

### Zustand stores

Tres stores amb comportament diferent:

```typescript
// settings + user-prefs: en memòria, hidratats des del servidor al login
export const useSettingsStore = create<SettingsState>()(immer((set, get) => ({ ... })))
// → hidratar: fetch('/api/admin/config/providers') → hydrate(config)

// layout: persistit a localStorage (UI efímer, no cal BD)
export const useLayoutStore = create<LayoutState>()(
  persist(immer((set) => ({ ... })), { name: 'layout-storage' })
)
```

### Perfil d'usuari: avatar, bio i nom

El perfil visible a la GreetingBar usa **dos stores coordinats**:

- **`useUserPrefsStore`** (`lib/store/user-prefs.ts`): font de veritat, BD-backed. Inclou `avatar` i `bio` a més de les preferències de model/TTS/ASR.
- **`useUserProfileStore`** (`lib/store/user-profile.ts`): store en memòria (sense `persist`). Agrega `avatar`, `bio` i `nickname` per als consumidors UI (GreetingBar, chat, agents).

**Flux d'hidratació** (a `app/page.tsx`, `useEffect` on `sessionUser?.id`):
1. `GET /api/user/preferences` → `useUserPrefsStore.hydrate(data.preferences)`
2. `useUserProfileStore.hydrateProfile(avatar, bio)` — escriu directament al store **sense** reescriure a la BD
3. `GET /api/user/me` → `useUserProfileStore.setNickname(firstName + ' ' + lastName)` — el nom és de sols lectura a la UI

**Modificació** (acció de l'usuari):
- `useUserProfileStore.setAvatar(url)` → actualitza l'store local **i** crida `useUserPrefsStore.setAvatar(url)` → debounced save a BD
- `useUserProfileStore.setBio(text)` → ídem via `useUserPrefsStore.setBio(text)`
- `useUserProfileStore.setNickname(name)` → només en memòria (el nom ve de la sessió, no és editable a la UI)

**Avatar**: sempre des de la llista `AVATAR_OPTIONS` (`lib/store/user-profile.ts`). No hi ha pujada de fitxer.

**GreetingBar** (`app/page.tsx`): mostra el nom de sessió en mode de sols lectura; l'usuari pot escollir avatar predefinit i editar la bio.

### Providers LLM: fluxos admin vs usuari

La configuració de providers LLM ve **exclusivament de la BD** (no de `.env`).

**Admin** (rol `admin`):
- `ServerProvidersInit` crida `GET /api/admin/config/providers` → `hydrate(config)`
- Obté la config completa amb totes les API keys desxifrades i tots els providers configurats

**Usuari** (rol `user`):
- `ServerProvidersInit` crida `fetchServerProviders()` → `GET /api/server-providers`
- El servidor llegeix `globalConfig` de BD, retorna **només** providers amb `apiKey` configurada
- Aplica el filtre `allowedModels` (BD, clau `'allowedModels'`):
  - `null` / buit → tots els providers permesos
  - `["anthropic"]` → tot Anthropic permès
  - `["anthropic:claude-sonnet-4-6"]` → només aquell model d'Anthropic
- `fetchServerProviders()` esborra `apiKey: ''` per a **tots** els providers en el pas de reset, evitant que API keys de sessions d'admin sangrin a sessions d'usuari

**Visibilitat al selector de models:**
```
Provider visible si: (!requiresApiKey || apiKey || isServerConfigured) && models.length >= 1
```
- `isServerConfigured: true` → el servidor l'ha retornat (admin o user)
- `apiKey !== ''` → l'usuari l'ha entrat manualment (dins la sessió, no persista)

**IDs de model:** els IDs a `allowedModels` han de coincidir exactament amb els IDs que l'admin ha configurat a la BD (p.ex. `gpt-4o`, `claude-sonnet-4-6`). El client usa els IDs del servidor directament i complementa amb metadata built-in si existeix.

### Config admin xifrada

`lib/server/config-crypto.ts` usa AES-256-GCM per xifrar totes les API keys abans de guardar-les a `AdminConfig` (Prisma). Format: `"iv:authTag:ciphertext"` (tot en hex). La clau ve de `CONFIG_ENCRYPTION_KEY` (env var, mai al codi).

### Logger

```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('NomComponent');
log.info('...'); log.warn('...'); log.error('...');
```

Nivells: `debug < info < warn < error`. Control via `LOG_LEVEL` env var.

### Convenció variables no usades

El flat ESLint config (`eslint.config.mjs`) ignora variables amb prefix `_`:

```typescript
const [value, _setValue] = useState(0); // _setValue no genera error ESLint
function handler(_event: MouseEvent) {}  // ídem
```

---

## i18n

Idiomes: `zh-CN` (default), `en-US`, `ca` (Català).

```typescript
// Client
const { t } = useI18n();  // lib/hooks/use-i18n.tsx
t('settings.themes.title')

// Server / fora de React
import { translate } from '@/lib/i18n';
translate('ca', 'common.generate')
```

Fitxers: `lib/i18n/{common,generation,stage,chat,settings}.ts`.
Quan s'afegeix una secció nova a Settings, cal afegir traduccions als 3 idiomes.

---

## Testing

```bash
pnpm test                        # Tots els tests unitaris
pnpm test -- tests/themes/       # Directori específic
pnpm test -- --reporter=verbose  # Output detallat
```

Tests unitaris a `tests/**/*.test.ts`. Tests E2E a `e2e/`.
Els tests d'integració amb proveïdors LLM reals requereixen API keys al `.env.local`.

---

## Trampetes freqüents

1. **`themeId` no arriba a la generació:** Verificar que `stageInfo.themeId` es passa als dos camins: `generation-preview/page.tsx` (primera escena) i `use-scene-generator.ts` (escenes 2+).

2. **Variables de prompt no substituïdes:** `interpolateVariables` necessita un valor explícit (incloent `''`). `undefined` deixa el literal `{{var}}` al prompt.

3. **`data/` al .gitignore:** Fitxers a `data/themes/` requereixen `git add -f` per versionar-los.

4. **Few-shot examples als prompts creen prior fort:** Colors i fonts hardcoded als exemples JSON del prompt sobreescriuen les instruccions textuals. Substituir per `{{variables}}`.

5. **`postinstall` necessari:** `pnpm install` builda `packages/pptxgenjs` i `packages/mathml2omml`. Si falten, fer `pnpm postinstall` manualment.

6. **Storage sempre al servidor:** Tot el contingut de cursos (stages, escenes, media, TTS) es persisteix al servidor via `/api/stages/*`. En dev: filesystem `/data/`. En producció: object store + PostgreSQL. No hi ha fallback a IndexedDB.

7. **Models eliminats que reapareixen:** `mergeWithBuiltInProviders()` a `/api/admin/config/providers` és autoritativa: si un proveïdor ja existeix a BD, la seva llista de models no es toca. Afegir-ne de nous des del codi? Sí. Restaurar els eliminats? No.

8. **`requireAuth` vs middleware:** El middleware (`proxy.ts`) comprova cookie per redirigir, però no valida la sessió completament. Sempre usar `requireAuth(req)` a les API routes per obtenir l'usuari autenticat i validat.

9. **Prisma + SQLite path:** `lib/prisma.ts` fa patch de `process.env.DATABASE_URL` per resoldre la ruta relativa de SQLite correctament tant amb `prisma migrate` com des de Next.js runtime.

10. **`allowedModels` no filtra:** Verificar que el camp `allowedModels` a la BD (clau `'allowedModels'`) sigui un array JSON vàlid, no `null`. Els IDs han de coincidir exactament amb els configurats per l'admin (p.ex. `"openai:gpt-4o"`, no `"openai:GPT-4o"`). Si el camp és `null` o `[]`, tots els providers passen.

11. **Providers de l'admin visibles a usuaris sense reload:** `fetchServerProviders()` esborra `apiKey` de tots els providers en el reset. Si veus un provider que no hauria d'aparèixer, comprova que no hi hagi API keys residuals d'una sessió d'admin anterior. Un reload complet (`window.location.reload()`) sempre resol l'estat.

12. **Avatar o bio no es guarda a la BD:** Verificar que el canvi va per `useUserProfileStore.setAvatar`/`setBio` (que deleguen a `useUserPrefsStore`), no per `hydrateProfile` (que és sols per a la càrrega inicial). Si crides `hydrateProfile` des d'una acció d'usuari, el canvi es perd en recarregar.

13. **`server-providers.yml` té prioritat sobre la BD:** Si existeix aquest fitxer al root del projecte, la seva configuració de providers sobreescriu la de la BD (AdminConfig). Útil en desplegaments Docker on es vol evitar configuració via panell admin. En dev, si el fitxer existeix i no conté un provider, aquell provider no estarà disponible encara que estigui configurat a la BD.
