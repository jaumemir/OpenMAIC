# Theme Layout System — Design Reference

> **Target audience:** Developers building the future OpenMAIC Theme Editor UI, or maintainers extending the layout injection pipeline. For instructions on how to **create a new theme** using an AI assistant, see [`creating-themes-with-ai.md`](./creating-themes-with-ai.md).

---

## Overview

The `layout` field in `ThemeManifest` lets a theme define **fixed header and footer zones** that are injected programmatically into every generated slide. This guarantees visual consistency across all slides — regardless of what the LLM generates.

**Key property:** The layout injection happens _after_ LLM slide generation and _before_ persisting. All three renderers (web canvas, PPTX export, SCORM export) read `slide.elements[]` directly, so they receive the injected elements transparently with no renderer-specific code.

**Responsibility split:**

| What the system controls | What the LLM controls |
|---|---|
| Header band (logo, title, background) | Slide body content (text, shapes, images) |
| Footer band (course title, page number) | Colours and typography within the content zone |
| Removing overlapping LLM elements | Following content zone boundaries |

---

## Data Types

### `ThemeLayout`

```typescript
interface ThemeLayout {
  header?: ThemeLayoutZone;  // optional
  footer?: ThemeLayoutZone;  // optional
}
```

Added as an optional field to `ThemeManifest`:

```typescript
interface ThemeManifest {
  // ... all existing fields ...
  layout?: ThemeLayout;  // undefined = no zones, original behaviour unchanged
}
```

**Retrocompatibility:** Themes without a `layout` field continue to work exactly as before.

---

### `ThemeLayoutZone`

```typescript
interface ThemeLayoutZone {
  height: number;       // px — measured from the edge (header: from top; footer: from bottom)
  background?: string;  // optional fill color for the entire zone band
  items: ThemeLayoutItem[];
}
```

The `height` determines:
- The **y-range excluded from LLM generation**: `0 → header.height` and `(canvasH - footer.height) → canvasH`
- The **y-offset** for footer items: `footerTop = canvasHeight - footer.height`

---

### `ThemeLayoutItem` (discriminated union)

Four item types, discriminated by the `type` field:

#### `rect` — filled rectangle

```typescript
{
  type: 'rect';
  x: number;
  y: number;
  width?: number;    // default: canvas width (1000px)
  height?: number;   // default: zone height
  fill: string;      // hex or rgba color
}
```

Use case: background band, separator line (height 1-2px), decorative block.

---

#### `logo` — theme asset image

```typescript
{
  type: 'logo';
  asset: string;     // Key in ThemeManifest.assets (e.g. "logo")
  x: number;
  y?: number;        // default: vertically centered in zone
  width: number;     // required
  height?: number;   // default: zoneHeight - 10px
}
```

**Important — `asset` is a key in `ThemeManifest.assets`, NOT a filename.**

Resolution path at generation time:
```
item.asset ("logo")
  → manifest.assets["logo"] ("assets/logo.svg")
  → strip "assets/" prefix → "logo.svg"
  → getThemeAssetPath(themeId, "logo.svg")
  → data/themes/{themeId}/assets/logo.svg
  → base64 data URI (embedded in slide element)
```

**Why this indirection?**
Using the `assets` record key (not the raw filename) enables a future Theme Editor to:
1. Enumerate available assets via `Object.keys(manifest.assets)`
2. Show an asset picker dropdown populated from the assets record
3. Decouple layout item references from internal file paths

---

#### `text` — label with variable substitution

```typescript
{
  type: 'text';
  content: string;   // template string, supports {{variables}}
  x?: number;        // default: 16
  y?: number;        // default: 0 (use small positive value, e.g. 6, for vertical breathing room)
  width?: number;    // default: canvasWidth - x - 16 (set explicitly to avoid overlap with pageNumber)
  size?: number;     // font size px, default: 11
  color?: string;    // hex, default: '#333333'
  font?: string;     // font family, default: 'Aptos, Calibri, sans-serif'
  weight?: string;   // '400' | '600' | '700', default: '400'
  align?: 'left' | 'center' | 'right';  // default: 'left'
}
```

**Supported template variables in `content`:**

| Variable | Value | Truncation |
|----------|-------|------------|
| `{{courseTitle}}` | LLM-generated short course title | Truncated at **70** chars + `…` |
| `{{slideTitle}}` | LLM-generated slide title from the outline | Truncated at **80** chars + `…` |
| `{{slideNumber}}` | Current slide number (1-based) | — |
| `{{totalSlides}}` | Total slide count | — |

Unknown variables render as empty string.

**Width tip:** If the zone also contains a `pageNumber` element at the right, set `width` explicitly on the text element to leave room. For example, with `pageNumber` at x=916 and width 60, a text element starting at x=16 should use `width: 880` to avoid visual overlap.

---

#### `pageNumber` — formatted page counter

```typescript
{
  type: 'pageNumber';
  format?: 'n' | 'n/total';  // default: 'n'
  x?: number;                // default: canvasWidth - 50
  y?: number;                // default: 0 (use small positive value, e.g. 6)
  size?: number;             // default: 10
  color?: string;            // default: '#999999'
}
```

The element is rendered as a right-aligned text element with fixed width 60px.

---

## Content Zone Calculation

The content zone is the y-range available for LLM-generated content:

```typescript
function getContentZone(layout, canvasHeight = 562.5) {
  const top = layout?.header?.height ?? 0;
  const bottom = canvasHeight - (layout?.footer?.height ?? 0);
  return { top, bottom, height: bottom - top };
}
```

### Content Zone Gap (8px)

When a theme layout is active, `scene-generator.ts` adds an **8px gap** to the boundaries passed to the LLM prompt:

```typescript
const CONTENT_ZONE_GAP = themeManifest?.layout ? 8 : 0;
const promptContentTop    = contentZone.top    + CONTENT_ZONE_GAP;  // e.g. 62 + 8 = 70
const promptContentBottom = contentZone.bottom - CONTENT_ZONE_GAP;  // e.g. 526.5 - 8 = 518.5
```

This breathing room prevents LLM-generated elements from being placed flush against the header or footer bands. The gap only affects the prompt variables (`contentTop` / `contentBottom`) — the spatial filter in `applyThemeLayout()` still uses the raw zone height as its boundary.

**Example — gencat theme (current v2.2.0):**
- Header height: 62px — Content zone starts at y = 62
- Footer height: 36px — Content zone ends at y = 526.5
- **Prompt boundaries communicated to LLM:** y = 70 → 518.5px
- Available height for LLM content: 489.5px (after subtracting both 8px gaps)

---

## Element Injection Order

`applyThemeLayout()` produces elements in this order:
```
[headerBackground?, ...headerItems, footerBackground?, ...footerItems, ...filteredLLMElements]
```

Because slide renderers draw elements in array order (later = higher z-index), the layout zone elements are drawn **under** the LLM content. This is intentional: if an LLM element somehow escapes into a zone (filtering is best-effort), the zone background covers it.

---

## Spatial Filtering

LLM elements that overlap reserved zones are removed:

```typescript
// Header overlap: element top strictly inside header zone
if (headerH > 0 && elTop < headerH) → removed

// Footer overlap: element bottom exceeds footer top boundary
if (footerH > 0 && elBottom > footerTop) → removed
```

Note: `PPTLineElement` omits `height` (it uses `start`/`end` coordinates). Line elements are only filtered by their `top` coordinate.

---

## `LayoutContext` and the `resolveAsset` Callback

```typescript
interface LayoutContext {
  courseTitle?: string;   // LLM-generated short course name
  slideTitle?: string;    // Current slide title from the outline
  slideNumber?: number;   // 1-based slide index
  totalSlides?: number;   // Total number of slides in the course
  canvasWidth?: number;   // default 1000
  canvasHeight?: number;  // default 562.5
  resolveAsset?: (assetKey: string) => string;  // asset key → data URI or URL
}
```

The `resolveAsset` callback decouples asset resolution from `applyThemeLayout()`. This design allows:

1. **Production (server-side generation):** `resolveAsset` reads the filesystem and returns a base64 data URI — embedded natively in all exporters.
2. **Future Theme Editor (browser-side preview):** `resolveAsset` can return a temporary `blob:` or `data:` URL from an uploaded file, with no filesystem access needed.
3. **Tests:** `resolveAsset` can return a fixed stub URL, making tests deterministic and filesystem-independent.

---

## Integration Points

### Where `applyThemeLayout()` is called

`lib/generation/scene-generator.ts` → `generateSlideContent()`:

1. Resolves `ThemeManifest` via `resolveThemeManifest(themeId)`
2. Calls `getContentZone()` → adds 8px gap → injects `contentTop` / `contentBottom` / `reservedZonesNote` into the prompt
3. After LLM generation + element post-processing, calls `applyThemeLayout()` with `outline.title` as `slideTitle`
4. Logo assets: `manifest.assets[item.asset]` → strip prefix → `resolveThemeAssetDataUri(themeId, bare)` → data URI

### Where `courseTitle` comes from

1. `outline-generator` prompt instructs the LLM to return `{ courseTitle, outlines }` instead of a bare array
2. `scene-outlines-stream/route.ts` extracts `courseTitle` from the streamed response, includes it in the `done` SSE event
3. `generation-preview/page.tsx` reads `courseTitle` from the `done` event, PATCHes `stage.name` via `/api/stages/{id}`, updates local `useStageStore`
4. `courseTitle` is passed down to `generateSlideContent()` via `use-scene-generator.ts` and `generation-preview/page.tsx`

### Where font family is applied to SCORM

`lib/export/scorm/use-export-scorm.ts`:
- Fetches `GET /api/themes/{stage.style}` to get the manifest
- Passes `manifest.typography.fontFamily` to `buildCourseHtml({ themeFontFamily })`
- `course-builder.ts` injects it into the `html, body { font-family: ... }` global CSS rule

---

## Adding a Layout to a Theme

Minimum example (header only):

```json
{
  "layout": {
    "header": {
      "height": 40,
      "background": "#1a1a2e",
      "items": [
        {
          "type": "logo",
          "asset": "logo",
          "x": 12,
          "width": 120
        },
        {
          "type": "text",
          "content": "My Institution",
          "x": 148,
          "size": 12,
          "color": "#ffffff",
          "weight": "600"
        }
      ]
    }
  }
}
```

Requirements:
1. The `asset` value (`"logo"`) must exist as a key in `manifest.assets`
2. The file referenced by `manifest.assets["logo"]` must exist under `data/themes/{id}/assets/`
3. The `height` value determines the exclusion zone communicated to the LLM

---

## Future Theme Editor — Considerations

When building a visual Theme Editor UI, these design choices are already in place:

| Editor Feature | Existing Support |
|---|---|
| Asset picker for logo | `Object.keys(manifest.assets)` enumerates available assets |
| Live preview of layout | `resolveAsset` callback accepts any URL (use `blob:` from file upload) |
| Add/remove layout items | `ThemeLayoutZone.items` is a plain array — append/remove freely |
| Variable list for text items | `{{courseTitle}}`, `{{slideTitle}}`, `{{slideNumber}}`, `{{totalSlides}}` |
| Content zone preview | `getContentZone(layout)` returns `{ top, bottom, height }` — overlay on canvas |
| Font picker | `typography.fontFamily` → used in SCORM CSS and slide theme |
| Color picker | `colors.primary/secondary/palette` → used in prompts as `{{themePrimary}}` / `{{themeSecondary}}` |

**Assets record convention:** `{ "logo": "assets/logo.svg", "banner": "assets/banner.png" }` — keys are human-readable identifiers shown in the picker; values are the relative paths within the theme directory.
