# CLAUDE.md — OpenMAIC

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
```

**Mai fer** `npm install` ni `yarn` — el projecte usa **pnpm 10** amb workspace.

---

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 4, shadcn/ui, Radix UI |
| State | Zustand 5 + Immer (localStorage persist) |
| Storage browser | Dexie 4 (IndexedDB) |
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
  → Storage (IndexedDB o filesystem)
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

---

## Directoris clau

```
app/
  api/                    # Rutes API (Next.js App Router)
    generate/             # scene-outlines-stream, scene-content
    chat/                 # Multi-agent SSE
    themes/               # CRUD themes
    generate-classroom/   # Job async (submit + poll)
  classroom/[id]/         # Playback
  generation-preview/     # Preview en temps real

lib/
  ai/
    providers.ts          # Registre de 20+ providers LLM
    llm.ts                # callLLM / streamLLM unificats + thinking adapter
  generation/
    outline-generator.ts  # Stage 1
    scene-generator.ts    # Stage 2 (1,300 línies)
    generation-pipeline.ts
    prompts/templates/    # Plantilles de prompt (Markdown amb {{variables}})
    theme-instructions.ts # resolveThemeManifest / resolveThemeInstructions / resolveThemeCSS
    theme-utils.ts        # themeToSlideTheme
  orchestration/
    director-graph.ts     # StateGraph LangGraph
  store/
    settings.ts           # Zustand store principal (1,365 línies)
  types/
    generation.ts         # UserRequirements, SceneOutline, PdfImage, ImageMapping
    slides.ts             # TextElement, ImageElement, ShapeElement, etc.
    stage.ts              # Scene, SlideContent, QuizContent, InteractiveContent, PBLContent
    action.ts             # Tots els tipus d'acció (discriminated union)
    provider.ts           # ModelInfo, ThinkingConfig, ThinkingCapability
    theme.ts              # ThemeManifest, ThemeListItem
    settings.ts           # SettingsState, SettingsSection
  server/
    scene-content-generation.ts  # Pont API → pipeline
    theme-storage.ts             # Filesystem backend per a themes
    resolve-model.ts
  themes/
    index.ts              # getBuiltInThemes()
    sistema/              # Theme built-in (versionat)

data/themes/              # Themes custom (servidor, .gitignore excepte gencat)
  gencat/                 # Theme Generalitat Catalunya (versionat com a demo)

components/
  slide-renderer/         # Editor canvas-based
  scene-renderers/        # slide, quiz, interactive, pbl
  generation/             # Toolbar, theme-popover
  settings/               # Settings panel + seccions
  whiteboard/             # SVG whiteboard

packages/
  pptxgenjs/              # Fork customitzat de pptxgenjs
  mathml2omml/            # MathML → Office Math XML

tests/                    # Vitest (*.test.ts)
e2e/                      # Playwright
```

---

## Fitxers de configuració importants

| Fitxer | Propòsit |
|--------|---------|
| `.env.local` | API keys i config (no versionat) |
| `.env.example` | Plantilla completa de variables |
| `next.config.ts` | Build standalone, límit proxy 200MB |
| `tsconfig.json` | Strict, alias `@/*` |
| `vitest.config.ts` | Unit tests, alias `@/*` |
| `components.json` | Config shadcn/ui |

---

## Variables d'entorn crítiques

```bash
# LLM (un o més)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# Storage (default: IndexedDB al browser)
NEXT_PUBLIC_STORAGE_BACKEND=server  # activa filesystem server-side

# Model per defecte (servidor)
DEFAULT_MODEL=google:gemini-2.5-flash-preview

# Logging
LOG_LEVEL=info
LOG_FORMAT=pretty  # o 'json'
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

### Zustand + Immer

```typescript
export const useSettingsStore = create<SettingsState>()(
  persist(immer((set, get) => ({ ... })), { name: 'settings' })
)
```

Tots els stores usen el patró `immer` dins de `persist`.

### Logger

```typescript
import { createLogger } from '@/lib/logger';
const log = createLogger('NomComponent');
log.info('...'); log.warn('...'); log.error('...');
```

Nivells: `debug < info < warn < error`. Control via `LOG_LEVEL` env var.

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

6. **Server vs. Browser storage:** Per defecte, tot s'emmagatzema a IndexedDB del navegador. Activar `NEXT_PUBLIC_STORAGE_BACKEND=server` per a persistència servidor (necessari per a classrooms generats via API).
