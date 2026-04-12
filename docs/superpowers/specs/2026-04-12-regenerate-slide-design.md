# Regenerate Slide — Design Spec

**Date:** 2026-04-12
**Branch:** `feat/regenerate-slide`
**Status:** Approved for implementation

---

## Context

OpenMAIC generates full courses (slides, quizzes, interactive scenes) in a two-stage pipeline. Once generated, users can already regenerate all TTS audio at once to change voices. However, there is no way to edit and regenerate an individual slide they are not satisfied with.

This feature adds a per-slide regeneration flow: the user opens an edit dialog for any slide scene, adjusts the indication (the outline prompt that drove generation), the audio narration text, and optionally the media type (image or video). The app then regenerates the slide visuals, speech actions, TTS audio, and media incrementally, showing progress in place. The original slide is kept as a backup until the user explicitly accepts the new version.

---

## Scope

- Applies only to scenes of `type: 'slide'`. Quiz, interactive, and PBL scenes are out of scope for v1.
- Single-scene regeneration only (not batch).

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `components/classroom/regenerate-slide-dialog.tsx` | Edit dialog (indication, audio text, media selector + prompt) |
| `lib/hooks/use-scene-regenerator.ts` | Client-side orchestration hook |
| `app/api/generate/scene-content-only/route.ts` | Endpoint: returns raw slide content without persisting a new scene |

### Modified files

| File | Change |
|------|--------|
| `components/stage/scene-sidebar.tsx` | Add "↺ Regen." button below active slide scene thumbnail |
| `components/stage.tsx` | Add regeneration state machine, backup management, review-mode UI, confirmation modal |

---

## State Machine

Managed in `Stage.tsx` as local state alongside `backupScene: Scene | null`.

```
idle
  → [click ↺ Regen.]              → dialog_open
      → [click Regenerar]          → regenerating
          → [all steps done]       → review
              → [Acceptar]         → idle          (backup cleared)
              → [Desfer]           → idle          (backup restored to store)
              → [Tornar a editar]  → dialog_open   (initialValues preserved)
              → [navigate away]    → modal_confirm
                  → [Sí, conservar] → idle
                  → [Descartar]     → idle          (backup restored)
```

`backupScene` is set to the current `Scene` immediately before the hook starts. It is kept in memory only — not persisted to the server — and is cleared when the user accepts, discards, or navigates away after confirmation.

---

## UI Components

### `RegenerateSlideDialog`

A shadcn `<Dialog>` with internal scroll. Opens from the sidebar button.

**Props:**
```typescript
interface RegenerateSlideDialogProps {
  open: boolean
  scene: Scene
  outline: SceneOutline
  initialValues?: RegenerateFormValues   // populated when reopening via "Tornar a editar"
  onRegenerate: (params: RegenerateParams) => void
  onClose: () => void
}
```

**Form fields — all pre-loaded on open, zero LLM calls on open:**

1. **Indicació** — `<Textarea>` pre-loaded with `outline.description` followed by `outline.keyPoints[]` (one bullet per line, prefix `• `). On submit, parsed back to `description: string` + `keyPoints: string[]`.

2. **Text àudio** — taller `<Textarea>` (min 6 rows), pre-loaded by concatenating all `SpeechAction.text` values from `scene.actions[]`, separated by `\n\n`.

3. **Media** — `<RadioGroup>`: `Cap | Imatge | Vídeo` (mutually exclusive).
   - When `Imatge` or `Vídeo` is selected: a `<Textarea>` for the prompt appears.
   - **Prompt pre-load logic:**
     - If `outline.mediaGenerations[]` has an entry matching the selected type → load that prompt (editable, original).
     - If no matching entry exists (user is switching to a new media type) → trigger a brief LLM call to auto-generate a prompt from the current indication text. Shows "✨ Generant prompt…" label; textarea becomes editable when prompt arrives. The "Regenerar" button is disabled until the auto-prompt arrives.
   - Switching back to `Cap` hides the prompt textarea.

4. **Footer:** `Cancel·lar` (ghost) · `↺ Regenerar` (primary, disabled while auto-prompt is loading).

---

### SceneSidebar — entry point

In `components/stage/scene-sidebar.tsx`, below the thumbnail of the currently active scene:

```tsx
{currentScene?.type === 'slide' && regenState === 'idle' && (
  <Button size="xs" variant="outline" onClick={() => openRegenerateDialog(currentScene.id)}>
    ↺ Regen.
  </Button>
)}
```

Hidden (not just disabled) while a regeneration is in progress to avoid accidental double-trigger.

---

### Review mode bar

When `regenState === 'review'`, a bar appears below the canvas (above `CanvasToolbar`) showing:

```
"Versió regenerada — pendent d'acceptar"
[✓ Acceptar]  [↩ Desfer]  [✏ Tornar a editar]
```

The bar disappears when the user accepts, discards, or the dialog reopens.

---

### Confirmation modal

Triggered when `regenState === 'review'` and the user clicks a different scene in the sidebar.

```
Title:   "Conservar la nova versió?"
Body:    "Slide [title] té una versió regenerada pendent d'acceptar.
          Si canvies de slide sense acceptar, la nova versió es descartarà."
Actions: [Sí, conservar]  [Descartar]
```

"Sí, conservar" accepts and navigates. "Descartar" restores backup and navigates.

---

## API Endpoint — `POST /api/generate/scene-content-only`

Thin wrapper around the existing `generateSceneContent()` function. Does **not** create or persist any scene.

**Request body:**
```typescript
{
  outline: SceneOutline
  stageId: string
  agents?: AgentInfo[]
  themeId?: string
}
// Headers: x-model, x-provider-type (resolved server-side)
```

**Response:**
```typescript
{
  success: true,
  data: {
    elements: PPTElement[],
    background?: SlideBackground
  }
}
```

Synchronous (no job-based polling needed for a single slide). Can be made job-based in a future iteration if timeout becomes an issue.

---

## Hook — `useSceneRegenerator`

**Signature:**
```typescript
interface RegenerateParams {
  outline: SceneOutline          // user-edited outline
  audioTextOverride: string      // user-edited audio text (may equal original)
  mediaType: 'none' | 'image' | 'video'
  mediaPrompt?: string
}

interface UseSceneRegeneratorReturn {
  regenerate: (params: RegenerateParams) => Promise<void>
  progress: 'idle' | 'content' | 'audio' | 'media' | 'done' | 'error'
  errorStep?: 'content' | 'audio' | 'media'
  cancel: () => void
}
```

**Pre-step — build final outline**

Before step 1, the hook sets `outline.mediaGenerations` based on `mediaType` and `mediaPrompt`:
- `'none'`  → `outline.mediaGenerations = []`
- `'image'` → `outline.mediaGenerations = [{ elementId: 'gen_img_1', type: 'image', prompt: mediaPrompt }]`
- `'video'` → `outline.mediaGenerations = [{ elementId: 'gen_vid_1', type: 'video', prompt: mediaPrompt }]`

This ensures the AI in step 1 includes (or omits) the media placeholder element in the generated slide layout.

**Incremental pipeline** — `store.updateScene()` is called after each step so the user sees progress in real time:

**Step 1 — Slide content + actions**
1. `POST /api/generate/scene-content-only` with the prepared outline → `{ elements, background }`
   The returned elements will include a `gen_img_1` / `gen_vid_1` placeholder if media was requested.
2. `POST /api/generate/scene-actions` with `outline` + content → `{ scene }` (contains new actions including spotlight, laser, speech)
3. `store.updateScene(sceneId, { content: newSlide, actions: newActions })`
   → User sees new slide immediately (no audio yet; media placeholder shows skeleton).

**Step 2 — Audio** (progress: `'audio'`)
- Split `audioTextOverride` by `\n\n` to obtain individual speech segments.
- Replace the `text` field of each `SpeechAction` in the new actions with the corresponding segment (1:1 by index). If there are more AI-generated speech actions than user segments, keep AI text for the remainder.
- For each `SpeechAction` in the new actions:
  - Call `generateAndStoreTTS(audioId, text, stageId)` (reuses `lib/audio/generate-and-store-tts.ts`).
  - `store.updateScene(sceneId, { actions: actionsWithAudio })` after each TTS call.
  → Audio becomes available incrementally.

**Step 3 — Media** (progress: `'media'`, only if `mediaType !== 'none'`)
1. `POST /api/generate/image` or `/api/generate/video` with `mediaPrompt`.
2. Fetch the result blob, `POST /api/stages/[stageId]/media` to store it (elementId: `gen_img_1` / `gen_vid_1`).
3. `useMediaGenerationStore.markDone(elementId, url)` — the SlideRenderer resolves the placeholder to the real URL at render time. No manual element injection needed; the placeholder was already placed in step 1 by the AI.
4. `store.updateScene(sceneId, { content: slideWithMedia })` to trigger re-render.

**Step 4 — Outline sync**
- Replace the matching outline in `store.outlines[]` with the user-edited outline.
- `store.setOutlines(updatedOutlines)` — persists to `/api/stages/[stageId]/outlines`.
  → Future regenerations start from the updated outline.

---

## Error Handling

| Step fails | State left in store | Recovery |
|-----------|-------------------|---------|
| Step 1 (content) | Original scene unchanged | Error banner; user can retry via dialog |
| Step 2 (audio) | New slide + actions visible, no audio | Slide shown without audio; existing "Regenerar àudio" covers retry |
| Step 3 (media) | Slide shown without media | `useMediaGenerationStore` shows error state with retry option |

On any error, `regenState` stays at `'review'` so the user can still accept the partial result, discard, or edit again.

---

## Verification

1. **Happy path (slide only, no media):** Open dialog for any slide scene, edit indication, press Regenerar. Verify: skeleton shows during generation, new slide appears, audio arrives, review bar shows, Acceptar saves, Desfer restores original.

2. **Audio text override:** Edit the audio text field before regenerating. Verify the TTS uses the edited text, not the AI-regenerated speech.

3. **Media — original had image:** Open dialog, verify prompt is pre-loaded from `outline.mediaGenerations`. Edit prompt, regenerate. Verify new image appears in slide.

4. **Media — original had none, select Vídeo:** Verify "✨ Generant prompt…" label appears, prompt arrives and is editable, Regenerar enabled after prompt arrives.

5. **Tornar a editar:** After regeneration, click "Tornar a editar". Verify dialog reopens with the values entered (not original outline values). Verify original backup is still in memory.

6. **Navigate away during review:** Click another scene in sidebar. Verify confirmation modal appears. "Sí, conservar" → keeps new version, navigates. "Descartar" → restores original, navigates.

7. **Error mid-pipeline:** Simulate a TTS failure. Verify new slide is still shown (step 1 completed), review bar allows Accept (partial) or Undo.
