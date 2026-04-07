# Disseny Tècnic — OpenMAIC

**Versió:** 1.0 · **Data:** Abril 2026  
**Stack:** Next.js 16 · React 19 · TypeScript 5 · Prisma 5 · better-auth · LangGraph

---

## 1. Arquitectura General

```
┌─────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                          │
│                                                                     │
│  ┌─────────────────────────┐   ┌─────────────────────────────────┐ │
│  │  Zustand Stores          │   │  React Components               │ │
│  │  ─ useSettingsStore      │◄──│  ─ app/page.tsx (home)          │ │
│  │  ─ useUserPrefsStore     │   │  ─ app/generation-preview       │ │
│  │  ─ useLayoutStore        │   │  ─ app/classroom/[id]           │ │
│  │  ─ useStageStore         │   │  ─ components/stage.tsx         │ │
│  │  ─ useMediaGenerationStore│  │  ─ components/roundtable/       │ │
│  └────────────┬────────────┘   └──────────────┬──────────────────┘ │
│               │                               │                    │
│  ┌────────────▼──────────────────────────────▼──────────────────┐  │
│  │  HTTP / SSE                                                   │  │
│  └────────────────────────────┬──────────────────────────────────┘  │
└───────────────────────────────│────────────────────────────────────-┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  SERVIDOR (Next.js App Router)                                      │
│                                                                     │
│  ┌────────────────────┐  ┌────────────────────┐  ┌───────────────┐ │
│  │  API Routes         │  │  Server Components  │  │  better-auth  │ │
│  │  /api/generate/*   │  │  (admin layout)     │  │  (sessions)   │ │
│  │  /api/stages/*     │  └────────────────────┘  └───────────────┘ │
│  │  /api/admin/*      │                                             │
│  │  /api/user/*       │  ┌────────────────────────────────────────┐ │
│  │  /api/chat (SSE)   │  │  Prisma ORM                            │ │
│  │  /api/auth/*       │  │  ─ SQLite (dev) / PostgreSQL (prod)    │ │
│  └────────────────────┘  └────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Filesystem Storage  /data/                                    │ │
│  │  ─ stages/{stageId}/stage.json  · scenes.json                 │ │
│  │  ─ stages/{stageId}/audio/{audioId}.mp3                       │ │
│  │  ─ stages/{stageId}/media/{elementId}.png|mp4                 │ │
│  │  ─ stages/{stageId}/outlines.json  · playback.json            │ │
│  │  ─ themes/{themeId}/manifest.json  · assets/                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│  SERVEIS EXTERNS                                                     │
│  ─ LLM: OpenAI, Anthropic, Google, Mistral, Groq, Ollama, ...       │
│  ─ TTS: OpenAI TTS, Azure Speech, ElevenLabs, MiniMax, etc.         │
│  ─ ASR: Whisper, Azure, Qwen ASR, Browser native                    │
│  ─ Imatge: DALL-E, Seedream, Grok Image, MiniMax Image, etc.        │
│  ─ Vídeo: Sora, Seedance, Kling, Veo, MiniMax Video, etc.           │
│  ─ PDF: GPT-4V, LlamaParse, etc.                                    │
│  ─ Cerca: Tavily, Google Custom Search, etc.                        │
│  ─ Email: Azure Communication Services (ACS)                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Stack Tecnològic

| Capa | Tecnologia | Versió | Notes |
|------|-----------|--------|-------|
| Framework | Next.js | 16.1 | App Router, Turbopack |
| UI | React | 19 | Server + Client Components |
| Estils | Tailwind CSS | 4 | + shadcn/ui + Radix UI |
| State | Zustand + Immer | 5 | In-memory; layout a localStorage |
| DB ORM | Prisma | 5 | SQLite (dev) / PostgreSQL (prod) |
| Auth | better-auth | latest | Argon2id, sessions 7 dies |
| LLM SDK | Vercel AI SDK | 6 | @ai-sdk/openai, anthropic, google |
| Orquestració | LangGraph | 1.1 | @langchain/langgraph |
| Tests unitaris | Vitest | 4 | |
| Tests E2E | Playwright | 1.58 | |
| TypeScript | strict mode | 5 | alias `@/*` → root |
| Package manager | pnpm | 10.28 | workspace |

---

## 3. Models de Dades

### 3.1 Esquema Prisma (complet)

```prisma
// ── Autenticació (better-auth standard tables) ──────────────────────

model User {
  id            String    @id @default(uuid())
  name          String
  email         String    @unique
  emailVerified Boolean   @default(false)
  image         String?
  role          String    @default("user")    // "admin" | "user"
  status        String    @default("pending") // "active" | "pending" | "inactive"
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  profile          UserProfile?
  sessions         Session[]
  accounts         Account[]
  verifications    Verification[]
  invitations      Invitation[]     @relation("InvitedBy")
  invitedAsUser    Invitation?      @relation("InvitedUser")
  passwordResetTokens PasswordResetToken[]
  stageOwnerships  StageOwnership[]
  classroomJobs    ClassroomJob[]
  adminConfigs     AdminConfig[]
  auditLogs        AuditLog[]
  preferences      UserPreferences?

  @@map("user")
}

model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("session")
}

model Account {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  accessToken           String?
  refreshToken          String?
  idToken               String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?   // Argon2id hash
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("account")
}

model Verification {
  id         String   @id
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  userId     String?
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@map("verification")
}

// ── Invitacions i reset de password ─────────────────────────────────

model Invitation {
  id          String    @id @default(uuid())
  email       String
  firstName   String?
  lastName    String?
  token       String    @unique
  expiresAt   DateTime
  invitedById String
  invitedUserId String? @unique
  usedAt      DateTime?
  createdAt   DateTime  @default(now())

  invitedBy   User  @relation("InvitedBy",   fields: [invitedById],   references: [id], onDelete: Cascade)
  invitedUser User? @relation("InvitedUser", fields: [invitedUserId], references: [id], onDelete: SetNull)

  @@map("invitation")
}

model PasswordResetToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("password_reset_token")
}

// ── Perfil i preferències d'usuari ───────────────────────────────────

model UserProfile {
  userId       String  @id @map("user_id")
  firstName    String? @map("first_name")
  lastName     String? @map("last_name")
  organization String?
  department   String?
  jobTitle     String? @map("job_title")
  city         String?
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_profile")
}

model UserPreferences {
  userId                  String   @id @map("user_id")
  providerId              String   @default("openai")   @map("provider_id")
  modelId                 String   @default("")          @map("model_id")
  ttsEnabled              Boolean  @default(true)        @map("tts_enabled")
  asrEnabled              Boolean  @default(true)        @map("asr_enabled")
  imageGenerationEnabled  Boolean  @default(false)       @map("image_generation_enabled")
  videoGenerationEnabled  Boolean  @default(false)       @map("video_generation_enabled")
  asrLanguage             String   @default("zh-CN")     @map("asr_language")
  agentMode               String   @default("auto")      @map("agent_mode")
  updatedAt               DateTime @updatedAt            @map("updated_at")
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("user_preferences")
}

// ── Cursos (ownership per relacionar stages amb usuaris) ─────────────

model StageOwnership {
  stageId   String   @id @map("stage_id")
  userId    String   @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("stage_ownership")
}

model ClassroomJob {
  id              String    @id
  userId          String    @map("user_id")
  status          String                          // queued | running | succeeded | failed
  step            String
  progress        Int       @default(0)
  message         String    @default("")
  inputSummary    String    @map("input_summary") // JSON: requirementPreview, language, hasPdf, ...
  scenesGenerated Int       @default(0)           @map("scenes_generated")
  totalScenes     Int?      @map("total_scenes")
  result          String?                         // JSON: classroomId, url, scenesCount
  error           String?
  createdAt       DateTime  @default(now())       @map("created_at")
  updatedAt       DateTime  @updatedAt            @map("updated_at")
  startedAt       DateTime? @map("started_at")
  completedAt     DateTime? @map("completed_at")
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("classroom_jobs")
}

// ── Configuració i auditoria ─────────────────────────────────────────

model AdminConfig {
  key           String   @id
  value         String                       // JSON xifrat AES-256-GCM
  updatedAt     DateTime @updatedAt          @map("updated_at")
  updatedById   String?  @map("updated_by_id")
  updatedBy     User?    @relation(fields: [updatedById], references: [id], onDelete: SetNull)
  @@map("admin_config")
}

model AuditLog {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")
  action     String                          // p.ex. CONFIG_UPDATED, USER_CREATED, STAGE_DELETED
  entityType String?  @map("entity_type")   // p.ex. "User", "Stage", "AdminConfig"
  entityId   String?  @map("entity_id")
  details    String?                         // JSON amb detalls addicionals
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now())        @map("created_at")
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  @@map("audit_log")
}
```

### 3.2 Tipus TypeScript Principals

#### Escena i contingut (`lib/types/stage.ts`)

```typescript
type SceneType = 'slide' | 'quiz' | 'interactive' | 'pbl'

interface Scene {
  id: string
  stageId: string
  type: SceneType
  title: string
  order: number
  content: SlideContent | QuizContent | InteractiveContent | PBLContent
  actions: Action[]
  createdAt: number
  updatedAt: number
}

interface SlideContent {
  type: 'slide'
  canvas: Slide       // { elements: SlideElement[], background }
}

interface QuizContent {
  type: 'quiz'
  questions: QuizQuestion[]
}

interface InteractiveContent {
  type: 'interactive'
  html: string        // HTML/CSS/JS complet en un string
}

interface PBLContent {
  type: 'pbl'
  projectConfig: PBLProjectConfig
}
```

#### Accions (`lib/types/action.ts`)

```typescript
type Action =
  | SpeechAction        // { type:'speech', text, audioId?, audioUrl? }
  | DiscussionAction    // { type:'discussion', topic, prompt? }
  | SpotlightAction     // { type:'spotlight', elementId, dim? }
  | LaserAction         // { type:'laser', elementId }
  | WBDrawTextAction    // { type:'wb_draw_text', text, position, style }
  | WBDrawShapeAction   // { type:'wb_draw_shape', shape, position, size, style }
  | WBDrawChartAction   // { type:'wb_draw_chart', chartType, data, position }
  | WBDrawLatexAction   // { type:'wb_draw_latex', latex, position }
  | WBDrawTableAction   // { type:'wb_draw_table', headers, rows, position }
  | WBDrawLineAction    // { type:'wb_draw_line', points, style }
  | WBEraserAction      // { type:'wb_eraser', target?: elementId }
  | WBCloseAction       // { type:'wb_close' }
  | PlayVideoAction     // { type:'play_video', elementId, autoplay? }
  // ... +15 més
```

#### Outline de generació (`lib/types/generation.ts`)

```typescript
interface SceneOutline {
  id: string
  type: SceneType
  title: string
  description: string
  keyPoints: string[]
  suggestedImageIds?: string[]    // IDs d'imatges del PDF
  mediaGenerations?: Array<{
    type: 'image' | 'video'
    elementId: string             // gen_img_xxx o gen_vid_xxx
    prompt: string
    aspectRatio?: string
    style?: string
  }>
  quizConfig?: { questionCount: number; difficulty: 1|2|3|4|5 }
  interactiveConfig?: { simulationType: string }
  pblConfig?: { projectType: string; issueCount: number }
}
```

---

## 4. Capa d'Autenticació

### 4.1 Configuració better-auth (`lib/auth/server.ts`)

```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'sqlite' | 'postgresql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    hashPassword: async (pw) => argon2.hash(pw),
    verifyPassword: async (pw, hash) => argon2.verify(hash, pw),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,    // 7 dies
    updateAge: 60 * 60 * 24,         // Renovar si > 1 dia des de l'últim ús
    cookieCache: { enabled: true, maxAge: 5 * 60 },  // Cache 5 min
  },
  // Audit log hooks via wrapper a /api/auth/[...all]/route.ts
})
```

### 4.2 Protecció de Routes

```typescript
// lib/server/api-response.ts
export async function requireAuth(req: NextRequest): Promise<UserRow | NextResponse> {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } })
  if (!user || user.status !== 'active') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }
  return user
}

// Ús a qualsevol API route:
const user = await requireAuth(req)
if (user instanceof NextResponse) return user
// user és ara UserRow verificat
```

### 4.3 Protecció Admin (Server Component)

```typescript
// app/(admin)/layout.tsx
export default async function AdminLayout({ children }) {
  const session = await auth.api.getSession({ headers: headers() })
  const user = session?.user as { role?: string } | undefined
  if (!user || user.role !== 'admin') {
    redirect('/login?error=forbidden')
  }
  return <AdminNav>{children}</AdminNav>
}
```

### 4.4 Middleware Edge (`proxy.ts`)

```typescript
// Comprova presència de cookie (ràpid, Edge-compatible)
// NO valida la sessió completament (Node.js no disponible a Edge)
export function middleware(req: NextRequest) {
  const sessionCookie = req.cookies.get('better-auth.session_token')
  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
}
```

---

## 5. Pipeline de Generació

### 5.1 Stage 1: Generació d'Outlines (`outline-generator.ts`)

```
UserRequirements
  + PDF text/images (opcional)
  + Web search context (opcional)
  + Agent personas
  + Theme instructions
        │
        ▼
  buildPrompt('REQUIREMENTS_TO_OUTLINES', variables)
        │
        ▼
  callLLM(systemPrompt, userPrompt, pdfImages?)
        │
        ▼
  parseJSON → SceneOutline[]
        │
        ▼
  enrichOutlines(outlines, stageId, language)
        │
        ▼
  SceneOutline[] — streamed via SSE al client
```

**Variables del prompt `REQUIREMENTS_TO_OUTLINES`:**
- `{{requirement}}` — Requisit de l'usuari
- `{{language}}` — Idioma de generació
- `{{pdfContent}}` — Text del PDF (si n'hi ha)
- `{{availableImages}}` — Llista d'IDs d'imatges del PDF
- `{{researchContext}}` — Resultats de cerca web
- `{{themeInstructions}}` — Instruccions del tema visual
- `{{agentContext}}` — Nom i rol dels agents
- `{{userProfile}}` — Nickname i bio de l'usuari

### 5.2 Stage 2a: Generació de Contingut (`scene-generator.ts`)

Diferent prompt per a cada tipus d'escena:

| Tipus | Template | Output |
|-------|----------|--------|
| `slide` | `OUTLINE_TO_SLIDE_CONTENT` | `SlideContent { canvas: Slide }` |
| `quiz` | `OUTLINE_TO_QUIZ_CONTENT` | `QuizContent { questions: QuizQuestion[] }` |
| `interactive` | `OUTLINE_TO_INTERACTIVE_HTML` | `InteractiveContent { html: string }` |
| `pbl` | `OUTLINE_TO_PBL_CONTENT` | `PBLContent { projectConfig }` |

**Variables comunes:**
- `{{outline}}` — L'outline de l'escena
- `{{allOutlines}}` — Context de totes les escenes
- `{{themePrimary}}`, `{{themeSecondary}}` — Colors principals
- `{{themeInstructions}}` — Directrius visuals
- `{{agentContext}}` — Context dels agents
- `{{previousScenesSummary}}` — Resum de les escenes anteriors (per coherència)

### 5.3 Stage 2b: Generació d'Accions (`scene-generator.ts`)

```
SceneOutline + SceneContent + AgentContexts
        │
        ▼
  buildPrompt('CONTENT_TO_ACTIONS', variables)
        │
        ▼
  callLLM → JSON array d'accions
        │
        ▼
  parseActions(rawActions) → Action[]
        │
        ▼
  enrichActions(actions):
    - Assigna audioIds únics (tts_xxx) per a accions speech
    - Assigna IDs per a elements de pissarra
    - Valida i filtra accions malformades
        │
        ▼
  Action[] — guardades al Scene
```

### 5.4 Generació de Media en Paral·lel

Mentre s'executen els Stages 1 i 2, `media-orchestrator.ts` genera imatges i vídeos per als `mediaGenerations` declarats als outlines:

```
SceneOutline[].mediaGenerations
        │
        ▼
  useMediaGenerationStore.enqueueTasks(stageId, requests)
        │
        ▼
  Per cada request (serialitzat per evitar rate limits):
    POST /api/generate/image o /api/generate/video
        │
        ▼
  Fetch blob del URL resultant (via /api/proxy-media si cal)
        │
        ▼
  POST /api/stages/${stageId}/media (upload base64 → servidor)
        │
        ▼
  useMediaGenerationStore.markDone(elementId, '/api/stages/.../media/...')
```

Els elements amb src `gen_img_xxx` o `gen_vid_xxx` a les diapositives es resolen automàticament quan el media generation task passa a `done`.

---

## 6. Orquestració Multi-Agent (LangGraph)

### 6.1 Estat del Graf

```typescript
interface OrchestratorState {
  // Input (immutable)
  messages: CoreMessage[]              // Historial de conversa
  availableAgentIds: string[]          // Agents participants
  maxTurns: number                     // Límit de torns (default: 4)
  languageModel: LanguageModel         // Model LLM instanciat
  discussionContext?: {
    topic: string
    systemPrompt?: string
  }
  triggerAgentId?: string              // Agent que inicia

  // Mutable (actualitzat pels nodes)
  currentAgentId: string | null
  turnCount: number
  agentResponses: AgentTurnSummary[]
  whiteboardLedger: WhiteboardActionRecord[]
  shouldEnd: boolean
}
```

### 6.2 Topologia del Graf

```typescript
const graph = new StateGraph(OrchestratorState)
  .addNode('director', directorNode)
  .addNode('agent_generate', agentGenerateNode)
  .addEdge(START, 'director')
  .addConditionalEdges('director', (state) =>
    state.shouldEnd ? END : 'agent_generate'
  )
  .addEdge('agent_generate', 'director')
  .compile()
```

### 6.3 Node Director (`director`)

Lògica per decidir quin agent parla:

```typescript
// Fast-paths (sense LLM):
if (turnCount === 0 && triggerAgentId) → triggerAgentId
if (turnCount === 0 && !triggerAgentId) → availableAgentIds[0]
if (availableAgentIds.length === 1 && turnCount === maxTurns) → shouldEnd = true

// LLM-based (multi-agent, torns > 0):
callLLM(directorPrompt, summaries) → { nextAgentId | 'end_discussion' }
```

### 6.4 Node Agent Generate (`agent_generate`)

Cada agent té accés a eines (tools) via Vercel AI SDK:

```typescript
const tools = {
  speak: tool({ description: 'Speak to the audience', ... }),
  draw_text: tool({ description: 'Write on whiteboard', ... }),
  draw_chart: tool({ description: 'Draw a chart on whiteboard', ... }),
  draw_latex: tool({ description: 'Write LaTeX equation', ... }),
  draw_shape: tool({ description: 'Draw a shape', ... }),
  ask_user: tool({ description: 'Ask the user a question', ... }),
  end_discussion: tool({ description: 'End the discussion', ... }),
}

// L'agent crida les eines i les accions es streamen via SSE
streamText(languageModel, {
  system: agentSystemPrompt,
  messages: [...historyWithSummaries],
  tools,
  onChunk: (chunk) => writer.write(encodeSSEEvent(chunk)),
})
```

### 6.5 Streaming via SSE (`/api/chat`)

```typescript
// app/api/chat/route.ts
const encoder = new TextEncoder()
const stream = new ReadableStream({
  start: async (controller) => {
    const writer = {
      write: (data: string) => controller.enqueue(encoder.encode(`data: ${data}\n\n`))
    }
    await runDirectorGraph(config, writer)
    controller.close()
  }
})
return new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })
```

---

## 7. Stores Zustand

### 7.1 useSettingsStore (`lib/store/settings.ts`)

Store de configuració global. S'hidrata des de l'API al login (admins) o des de `/api/server-providers` (usuaris normals). **No persisteix a localStorage.**

```typescript
interface SettingsState {
  // LLM Providers
  providersConfig: Record<ProviderId, ProviderSettings>

  // PDF
  pdfProviderId: PDFProviderId
  pdfProvidersConfig: Record<PDFProviderId, PDFProviderConfig>

  // TTS
  ttsProviderId: TTSProviderId
  ttsVoice: string
  ttsSpeed: number
  ttsProvidersConfig: Record<TTSProviderId, TTSProviderConfig>

  // ASR
  asrProviderId: ASRProviderId
  asrProvidersConfig: Record<ASRProviderId, ASRProviderConfig>

  // Imatge
  imageProviderId: ImageProviderId
  imageModelId: string
  imageProvidersConfig: Record<ImageProviderId, ImageProviderConfig>

  // Vídeo
  videoProviderId: VideoProviderId
  videoModelId: string
  videoProvidersConfig: Record<VideoProviderId, VideoProviderConfig>

  // Cerca web
  webSearchProviderId: WebSearchProviderId
  webSearchProvidersConfig: Record<WebSearchProviderId, WebSearchProviderConfig>

  // Agents
  selectedAgentIds: string[]
  autoAgentCount: number
  maxTurns: number

  // Restriccions (de l'admin)
  allowedModels: string[] | null

  // Actions
  hydrate(config: Partial<SettingsState>): void
  fetchServerProviders(): Promise<void>
  setProviderConfig(pid: ProviderId, config: Partial<ProviderSettings>): void
  setProvidersConfig(config: Record<ProviderId, ProviderSettings>): void
  setTTSProvider(id: TTSProviderId): void
  // ... +20 setters
}
```

**Flux de hidratació (admin):**
```typescript
// app/page.tsx
useEffect(() => {
  if (!session?.user) return
  if (user.role === 'admin') {
    fetch('/api/admin/config/providers')
      .then(r => r.json())
      .then(d => useSettingsStore.getState().hydrate(d.config))
  } else {
    useSettingsStore.getState().fetchServerProviders()
  }
}, [session?.user?.id])
```

**Auto-save (admin):**
```typescript
// Dins de setProviderConfig, etc. (debounced 500ms):
debouncedSave = debounce(() => {
  const state = useSettingsStore.getState()
  fetch('/api/admin/config/providers', {
    method: 'PUT',
    body: JSON.stringify(serializeSettingsState(state)),
  })
}, 500)
```

### 7.2 useUserPrefsStore (`lib/store/user-prefs.ts`)

Preferències per usuari. S'hidrata des de `/api/user/preferences` al login. Cada setter fa `PUT /api/user/preferences` en background. **No persisteix a localStorage.**

```typescript
interface UserPrefsState {
  userId: string | null
  providerId: ProviderId
  modelId: string
  ttsEnabled: boolean
  asrEnabled: boolean
  imageGenerationEnabled: boolean
  videoGenerationEnabled: boolean
  asrLanguage: string
  agentMode: 'auto' | 'preset'

  hydrate(prefs: Partial<UserPrefsState>): void
  setModel(providerId: ProviderId, modelId: string): void
  setTTSEnabled(enabled: boolean): void
  // ... setters que fan auto-save a BD
}
```

### 7.3 useLayoutStore (`lib/store/layout.ts`)

Estat efímer de la UI. Persistit a `localStorage` ('layout-storage'). No va a la BD.

```typescript
interface LayoutState {
  sidebarCollapsed: boolean
  chatAreaCollapsed: boolean
  chatAreaWidth: number      // px
  ttsMuted: boolean
  ttsVolume: number          // 0–1
  autoPlayLecture: boolean
  playbackSpeed: 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2
  // setters...
}
```

### 7.4 useStageStore (`lib/store/stage.ts`)

Contingut del curs actiu en memòria + sincronitzat amb el servidor.

```typescript
interface StageStoreState {
  stage: Stage | null
  scenes: Scene[]
  currentSceneId: string | null
  chatSessions: ChatSession[]

  // Generació en curs
  outlines: SceneOutline[]
  generatingOutlines: SceneOutline[]
  failedOutlines: { outlineId: string; error: string }[]

  // Persistència
  saveToStorage(): Promise<void>   // PUT /api/stages/[id]
  loadFromStorage(stageId: string): Promise<void>  // GET /api/stages/[id]
}
```

### 7.5 useMediaGenerationStore (`lib/store/media-generation.ts`)

Seguiment de l'estat de generació de cada element d'imatge o vídeo.

```typescript
interface MediaTask {
  elementId: string
  type: 'image' | 'video'
  status: 'pending' | 'generating' | 'done' | 'failed'
  prompt: string
  params: { aspectRatio?, style?, duration? }
  objectUrl?: string    // URL del servidor: /api/stages/[id]/media/[elementId]
  poster?: string       // Per vídeos: URL del poster frame
  error?: string
  errorCode?: string    // Estructurat: 'CONTENT_SENSITIVE', 'QUOTA_EXCEEDED', ...
  retryCount: number
  stageId: string
}
```

---

## 8. Storage Architecture

### 8.1 Servidor — Fitxers de Cursos

Tots els cursos es guarden al filesystem del servidor:

```
/data/
  stages/
    {stageId}/
      stage.json          ← Stage metadata + scenes + chats (StageStoreData)
      outlines.json       ← SceneOutline[] per resume-on-refresh
      playback.json       ← PlaybackSnapshot per restore en recàrrega
      audio/
        {audioId}.mp3     ← Clips TTS generats
      media/
        {elementId}.png   ← Imatges generades
        {elementId}.mp4   ← Vídeos generats
        {elementId}.poster.jpg  ← Poster frame per vídeos
  themes/
    {themeId}/
      manifest.json
      assets/
```

### 8.2 API Routes de Storage

| Route | Mètode | Descripció |
|-------|--------|-----------|
| `/api/stages` | GET | Llista stages de l'usuari (des de `StageOwnership`) |
| `/api/stages/[id]` | GET | Llegeix `stage.json` |
| `/api/stages/[id]` | PUT | Escriu `stage.json` |
| `/api/stages/[id]` | DELETE | Elimina directori `stages/[id]/` + `StageOwnership` |
| `/api/stages/[id]` | PATCH | Renombra (actualitza `stage.json` + `stage_ownership`) |
| `/api/stages/[id]/outlines` | GET | Llegeix `outlines.json` |
| `/api/stages/[id]/outlines` | PUT | Escriu `outlines.json` |
| `/api/stages/[id]/playback` | GET | Llegeix `playback.json` |
| `/api/stages/[id]/playback` | PUT | Escriu `playback.json` |
| `/api/stages/[id]/playback` | DELETE | Elimina `playback.json` |
| `/api/stages/[id]/audio` | POST | Desa base64 → `audio/{audioId}.mp3` |
| `/api/stages/[id]/audio/[audioId]` | GET | Serveix fitxer d'àudio |
| `/api/stages/[id]/media` | GET | Llista metadata dels media d'un stage |
| `/api/stages/[id]/media` | POST | Desa base64 → `media/{elementId}` |
| `/api/stages/[id]/media/[elementId]` | GET | Serveix media |
| `/api/stages/[id]/media/[elementId]` | DELETE | Elimina fitxer de media |
| `/api/stages/[id]/media/[elementId]/poster` | GET | Serveix poster |

### 8.3 Propietat dels Stages

Quan es crea un nou stage, es registra a la taula `StageOwnership`:

```typescript
// lib/server/classroom-job-runner.ts (o generation-preview)
await prisma.stageOwnership.create({
  data: { stageId, userId }
})
```

`GET /api/stages` filtra per `userId` via JOIN amb `StageOwnership`. Admins veuen tots els cursos via `/api/admin/stages`.

---

## 9. Xifrat de Configuració Admin

### 9.1 `config-crypto.ts`

```typescript
// Algoritme: AES-256-GCM
// Clau: CONFIG_ENCRYPTION_KEY env var (64 hex chars = 32 bytes)
// Format: "iv:authTag:ciphertext" (tot en hex)

export function encrypt(plaintext: string): string
export function decrypt(ciphertext: string): string

// Xifra/desxifra recursivament el camp .apiKey de cada proveïdor
export function encryptApiKeys(config: ProvidersConfig): ProvidersConfig
export function decryptApiKeys(config: ProvidersConfig): ProvidersConfig
```

### 9.2 Flux de configuració admin

```
PUT /api/admin/config/providers
  body: { providersConfig, ttsProvidersConfig, ... }
      │
      ▼
  encryptApiKeys(config)        ← Xifra totes les API keys
      │
      ▼
  AdminConfig.upsert({
    key: 'globalConfig',
    value: JSON.stringify(encrypted)
  })
      │
      ▼
  auditLog('CONFIG_UPDATED', { keys: [...] })

GET /api/admin/config/providers
      │
      ▼
  AdminConfig.findUnique({ key: 'globalConfig' })
      │
      ▼
  decryptApiKeys(JSON.parse(config.value))
      │
      ▼
  mergeWithBuiltInProviders(dbConfig)  ← Afegeix proveïdors nous del codi
      │
      ▼
  Return config (desxifrat) al client
```

---

## 10. Sistema de Proveïdors LLM

### 10.1 Registre de Proveïdors (`lib/ai/providers.ts`)

Més de 20 proveïdors registrats:

| ProviderId | Nom | Tipus |
|------------|-----|-------|
| `openai` | OpenAI | chat |
| `anthropic` | Anthropic | chat |
| `google` | Google Gemini | chat |
| `mistral` | Mistral AI | chat |
| `groq` | Groq | chat |
| `deepseek` | DeepSeek | chat |
| `qwen` | Alibaba Qwen | chat |
| `glm` | Zhipu GLM | chat |
| `doubao` | ByteDance Doubao | chat |
| `moonshot` | Moonshot AI | chat |
| `minimax` | MiniMax | chat |
| `ollama` | Ollama (local) | chat |
| `azure-openai` | Azure OpenAI | chat |
| `custom-*` | Custom (usuari) | chat |

Cada proveïdor té:
```typescript
interface ProviderDefinition {
  id: ProviderId
  name: string
  type: 'chat' | 'completion'
  defaultBaseUrl?: string
  icon?: string
  requiresApiKey: boolean
  models: ModelInfo[]
}

interface ModelInfo {
  id: string
  name: string
  capabilities: {
    streaming: boolean
    tools: boolean
    vision: boolean
    thinking?: ThinkingCapability  // 'native' | 'extended' | null
  }
  contextWindow?: number
}
```

### 10.2 Unified LLM Interface (`lib/ai/llm.ts`)

```typescript
// Crida LLM unificada (retorna el text complet)
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  images?: string[],           // base64 o URLs per a visió
  thinking?: ThinkingConfig    // { enabled?, budgetTokens? }
): Promise<string>

// Streaming LLM (per a SSE)
export async function streamLLM(
  systemPrompt: string,
  userPrompt: string,
  options: StreamOptions,
): Promise<ReadableStream>
```

**Thinking adapter per proveïdor:**
- OpenAI: `{ reasoningEffort: 'low'|'medium'|'high' }`
- Anthropic: `{ thinking: { type: 'enabled', budgetTokens: N } }`
- Google: `{ thinkingConfig: { thinkingBudget: N } }`

---

## 11. Sistema de Temes

### 11.1 Estructura de Fitxers

```
lib/themes/sistema/           ← Built-in (versionat)
  manifest.json
  instructions.md             ← Instruccions per al LLM
  
data/themes/gencat/           ← Custom demo (versionat amb git add -f)
  manifest.json
  instructions.md
  assets/
    logo.svg
    
data/themes/{custom}/         ← Custom de l'admin (no versionat)
  manifest.json
  ...
```

### 11.2 ThemeManifest

```typescript
interface ThemeManifest {
  id: string
  name: string
  description: string
  locked: boolean     // No editable per l'usuari (admin only)
  builtIn: boolean
  colors: {
    primary: string
    primaryForeground: string
    secondary: string
    secondaryForeground: string
    background: string
    foreground: string
    muted: string
    accent: string
    card: string
    border: string
  }
  fonts: {
    heading: string
    body: string
  }
  instructions: string   // Text Markdown amb directrius per al LLM
  assets: {
    logo?: string        // Path relatiu a assets/
    banner?: string
  }
}
```

### 11.3 Injecció en el Pipeline

```typescript
// lib/generation/theme-instructions.ts
const [manifest, instructions] = await Promise.all([
  resolveThemeManifest(themeId),
  resolveThemeInstructions(themeId),
])

// Injectat com a variables al prompt:
variables['themeInstructions'] = instructions
variables['themePrimary'] = manifest.colors.primary
variables['themeSecondary'] = manifest.colors.secondary

// Per a contingut HTML interactiu:
const css = await resolveThemeCSS(themeId)
htmlContent = `<style>${css}</style>\n${htmlContent}`
```

---

## 12. Auditoria

### 12.1 `auditLog` helper (`lib/audit.ts`)

```typescript
type AuditAction =
  | 'USER_LOGIN' | 'USER_LOGOUT'
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'USER_STATUS_CHANGED'
  | 'PASSWORD_RESET_REQUESTED' | 'PASSWORD_RESET_COMPLETED'
  | 'INVITATION_CREATED' | 'INVITATION_ACCEPTED'
  | 'CONFIG_UPDATED'
  | 'STAGE_CREATED' | 'STAGE_DELETED' | 'COURSE_DELETED'

export async function auditLog(
  action: AuditAction,
  options: {
    userId?: string
    entityType?: string
    entityId?: string
    details?: Record<string, unknown>
    req?: NextRequest      // Per capturar IP i User-Agent
  }
): Promise<void>
```

### 12.2 Integració en routes

```typescript
// Exemple: canvi de rol d'usuari
await prisma.user.update({ where: { id: userId }, data: { role: newRole } })
await auditLog('USER_UPDATED', {
  userId: adminUser.id,
  entityType: 'User',
  entityId: userId,
  details: { field: 'role', from: currentRole, to: newRole },
  req,
})
```

---

## 13. Jobs Asíncrons (`ClassroomJob`)

Per a generació de cursos via API externa (sense navegador obert):

```
POST /api/generate-classroom
  body: { requirement, language, ... }
      │
      ▼
  createClassroomGenerationJob(jobId, input, userId)
  → ClassroomJob { status: 'queued' }
      │
      ▼
  after(() => runClassroomGenerationJob(jobId, body, baseUrl, userId))
      │                    ↑ Next.js after() = executa un cop la response s'ha enviat
      ▼
  Return 202 { jobId, pollUrl }

GET /api/generate-classroom/[jobId]
      │
      ▼
  readClassroomGenerationJob(jobId)
  → { status, progress, step, message, result? }
      │
      └─ Si status === 'succeeded': { result: { classroomId, url } }
```

`markStaleIfNeeded()`: Si un job porta >30 min en `running` (procés reiniciat), es marca com a `failed`.

---

## 14. Internacionalització

```
lib/i18n/
  common.ts      ← Traduccions comunes (bottons, labels, errors)
  generation.ts  ← Missatges del procés de generació
  stage.ts       ← Playback i sala de classe
  chat.ts        ← Discussió multi-agent
  settings.ts    ← Panell de configuració
```

Estructura de cada fitxer:
```typescript
export const translations = {
  'zh-CN': {
    'settings.providers': '模型提供商',
    // ...
  },
  'en-US': {
    'settings.providers': 'Providers',
    // ...
  },
  'ca': {
    'settings.providers': 'Proveïdors',
    // ...
  },
}
```

Ús client: `useI18n()` hook → `t('key')`. Ús server: `translate(locale, 'key')`.

---

## 15. Exportació de Cursos

### 15.1 PPTX (PowerPoint)

`lib/export/pptx/` usa el fork customitzat `packages/pptxgenjs`.

Per cada escena de tipus `slide`:
- Crea un Slide PPT
- Mapeja cada `SlideElement` al seu equivalent PPT
- LaTeX → MathML → OMML via `packages/mathml2omml`

### 15.2 SCORM

`lib/export/scorm/asset-collector.ts` + `lib/export/scorm/builder.ts`:
- Recull tots els media del stage
- Construeix estructura SCORM 1.2 / 2004
- Genera `imsmanifest.xml`
- Empaqueta com a ZIP

---

## 16. Variables d'Entorn Completes

```bash
# ── Obligatòries ──────────────────────────────────
BETTER_AUTH_SECRET=          # min 32 chars aleatòris
BETTER_AUTH_URL=http://localhost:3000

CONFIG_ENCRYPTION_KEY=       # 64 hex chars (openssl rand -hex 32)

# ── Base de dades ─────────────────────────────────
# Dev: SQLite automàtic a prisma/dev.db
# Prod: obligatori
DATABASE_URL=postgresql://user:pass@host:5432/openmaic

# ── LLM (almenys un) ─────────────────────────────
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...

# ── Email (per invitacions) ───────────────────────
ACS_CONNECTION_STRING=endpoint=https://...
ACS_SENDER_ADDRESS=noreply@openmaic.example.com

# ── Model per defecte ─────────────────────────────
DEFAULT_MODEL=google:gemini-2.5-flash-preview

# ── TTS / ASR (opcionals si els configura l'admin) ─
AZURE_SPEECH_KEY=
AZURE_SPEECH_REGION=westeurope
ELEVENLABS_API_KEY=
OPENAI_TTS_API_KEY=          # Pot ser el mateix que OPENAI_API_KEY

# ── Media (opcionals) ─────────────────────────────
SEEDREAM_API_KEY=             # Imatges
KLING_API_KEY=                # Vídeos
TAVILY_API_KEY=               # Cerca web

# ── PDF (opcionals) ───────────────────────────────
LLAMAPARSE_API_KEY=

# ── Logging ───────────────────────────────────────
LOG_LEVEL=info                # debug | info | warn | error
LOG_FORMAT=pretty             # pretty | json
```
