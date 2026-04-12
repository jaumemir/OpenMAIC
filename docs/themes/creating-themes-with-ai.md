# Creating OpenMAIC Themes with AI

> **Audience:** This document is written so that an AI assistant (Claude, Copilot, Gemini, or similar) can create a complete, working OpenMAIC theme from scratch — whether the starting point is a screenshot, a brand guidelines PDF, or a PPTX template file.
>
> If you are a **human developer** reading this to understand themes, start with [`theme-layout-design.md`](./theme-layout-design.md) first.

---

## What a Theme Does

An OpenMAIC theme has two distinct responsibilities that must be kept strictly separate:

### 1. Header and footer (the system's job)

Defined in `theme.json → layout`. The system **always** injects these programmatically into every generated slide. The LLM never sees or touches them.

- Logo placement
- Brand color band
- Slide title (from the outline)
- Course title and page number in the footer

### 2. Body content (the LLM's job)

Guided by `theme.json → modelInstructions`. The LLM generates text boxes, shapes, images, and charts inside the **content zone** (the space between header and footer). The `modelInstructions` field tells the LLM exactly which fonts, colors, and hierarchy to use.

**Critical rule:** `modelInstructions` must NEVER mention header or footer. The system already handles them, and if the LLM tries to generate them as well, duplicates appear.

---

## File Structure

A theme lives in `data/themes/{id}/` (or `lib/themes/{id}/` for built-in themes):

```
data/themes/{id}/
├── theme.json        ← manifest: identity, colors, layout, LLM instructions
├── styles.css        ← CSS variables for interactive HTML / SCORM export
└── assets/
    └── logo.svg      ← brand logo (SVG preferred, PNG accepted)
```

The canvas coordinate system is **1000 × 562.5 px** (16:9). All `x`, `y`, `width`, `height` values in the layout use this coordinate space.

---

## Step-by-Step Process

### Step 1 — Extract the brand identity

From a screenshot, brand guide, or PPTX file, identify:

| Property | What to look for |
|---|---|
| **Primary color** | Main brand color (header background, headings, buttons) |
| **Secondary color** | Supporting color (hover states, secondary headings) |
| **Accent color** | Call-to-action color (often a contrasting red, orange, or green) |
| **Background** | Slide background (almost always `#ffffff`) |
| **Text color** | Body copy color (usually a dark grey, e.g. `#333333`) |
| **Color palette** | 6 colors for charts and decorative elements |
| **Font family** | Heading and body fonts. Prefer system fonts (Aptos, Calibri, Arial) over web fonts |
| **Logo** | Vector SVG file; extract or recreate at ≥ 200px wide |

### Step 2 — Measure the header and footer

Look at the PPTX slide or screenshot. Estimate the height of the header band and footer band as a proportion of the total slide height, then scale to the 562.5px canvas:

```
header_height_px = (header_height_proportion) × 562.5
footer_height_px = (footer_height_proportion) × 562.5
```

**If working from a PPTX file** — PPTX uses English Metric Units (EMU):
- Standard widescreen slide: 12,192,000 EMU wide × 6,858,000 EMU tall
- To convert to OpenMAIC canvas coordinates:
  ```
  x_canvas = (emu_x / 12_192_000) × 1000
  y_canvas = (emu_y / 6_858_000)  × 562.5
  ```
- Logo position, width, height can be read from the PPTX XML (`<p:sp>` / `<p:pic>` elements)

**Typical proportions:**
- Minimal header: 40–50px (7–9% of height)
- Standard header with logo + title: 55–70px (10–12%)
- Tall header with tagline: 80–100px (14–18%)
- Footer: 28–40px (5–7%)

### Step 3 — Design the layout items

Map each visual element in the header/footer to a layout item type:

| Visual element | Layout item type |
|---|---|
| Brand logo | `logo` |
| Colored band / separator line | `rect` |
| Slide title, subtitle | `text` with `{{slideTitle}}` |
| Institution name / course name | `text` with `{{courseTitle}}` |
| Page number | `pageNumber` |
| Decorative shape | `rect` |

**Layout coordinate rules:**
- Header items: `y` is measured from the **top of the canvas** (y=0 is top of header)
- Footer items: `y` is measured from the **top of the footer band** (not from canvas top — the system adds the offset automatically)
- Leave 5–8px internal padding between items and zone edges for visual breathing room

### Step 4 — Write `modelInstructions`

This is the most important creative step. The instructions must be **prescriptive, not suggestive**. The LLM will follow exact specifications much more reliably than vague guidance.

**Structure your instructions in sections:**

```
TIPOGRAFIA OBLIGATÒRIA (body — el header i footer els gestiona el sistema automàticament):
- NO generis cap element de [zone name]: [element] apareix automàticament.
- [Role 1]: [FontName] [weight]px, [size]px, color [#hex]
- [Role 2]: [FontName] [weight]px, [size]px, color [#hex]
...

COLORS: ÚNICAMENT de la paleta corporativa: [list hex codes].
[Rules about backgrounds, opacities, gradients]

CONTINGUT: [Tone and style rules for the generated text]

RESTRICCIONS: [What NOT to generate — logos, emblems, zone content]
```

**Key rules to include:**
1. **Explicitly forbid generating header/footer elements.** Say "No generis cap element de títol: el títol apareix automàticament al header."
2. **Name the exact font.** Don't say "use a professional font" — say "usa Aptos Regular 400, 15px, color #333333."
3. **List the exact color palette.** Say "ÚNICAMENT de la paleta: [#006699, #003366, ...]."
4. **Forbid gradients and off-palette colors.** LLMs tend to invent colors.
5. **Define background rules.** "Fons de cards/boxes: versió clara (≤15% opacitat)." Prevents dark backgrounds obscuring content.
6. **Define tone.** Institutional? Friendly? Technical? This shapes the text content.

### Step 5 — Write `styles.css`

Used for interactive HTML slides and SCORM export. Always use CSS variables for colors and fonts:

```css
:root {
  --theme-primary: {primary};
  --theme-secondary: {secondary};
  --theme-background: {background};
  --theme-text: {text};
  --theme-accent: {accent};
  --theme-font-family: '{FontName}', '{Fallback1}', '{Fallback2}', sans-serif;
  --theme-heading-weight: 700;
  --theme-body-weight: 400;
}

body {
  font-family: var(--theme-font-family);
  color: var(--theme-text);
  background: var(--theme-background);
}

h1, h2, h3, h4 {
  color: var(--theme-primary);
  font-weight: var(--theme-heading-weight);
}
```

**Font choice for CSS:** Use the same fallback chain as in `theme.json → typography.fontFamily`. No `@import` needed for system fonts (Aptos, Calibri, Arial, Georgia, etc.).

---

## Complete Example: gencat Theme

The gencat theme implements the **Sistema de Disseny de la Generalitat de Catalunya** (Government of Catalonia design system). It demonstrates all layout features.

### Visual structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [Logo 130×30] │ [separator 1px] │ Nom de la slide (slide title, white 18px)  │  ← header 62px, bg #006699
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    LLM-generated content                                     │  ← content zone y=62..526.5px
│                    (subtítols, text, taules, imatges)                        │     (prompt sees y=70..518.5)
│                                                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│ [separator line #006699 1px] Generalitat de Catalunya · {{courseTitle}}   4/10│  ← footer 36px, bg #ffffff
└──────────────────────────────────────────────────────────────────────────────┘
```

### `theme.json`

```json
{
  "id": "gencat",
  "name": "Gencat",
  "description": "Sistema de Disseny de la Generalitat de Catalunya",
  "locked": false,
  "builtIn": false,
  "version": "2.2.0",
  "typography": {
    "fontFamily": "Aptos, 'Aptos Narrow', Calibri, Arial, sans-serif",
    "headingWeight": "700",
    "bodyWeight": "400"
  },
  "colors": {
    "primary": "#cc0000",
    "secondary": "#006699",
    "background": "#ffffff",
    "text": "#333333",
    "accent": "#cc0000",
    "palette": ["#006699", "#003366", "#4d9900", "#ff6600", "#cc0000", "#666666"]
  },
  "modelInstructions": "Segueix la identitat corporativa de la Generalitat de Catalunya.\n\nTIPOGRAFIA OBLIGATÒRIA (body — el header i footer els gestiona el sistema automàticament):\n- NO generis cap element de títol: el títol apareix automàticament al header blau.\n- Subtítol/introducció: Aptos SemiBold 600, 18-20px, color #006699\n- Cos de text: Aptos Regular 400, 15-16px, color #333333\n- Captions/notes: Aptos Regular 400, 11-12px, color #555555\n- NO usis Open Sans ni cap altra font. Usa SEMPRE Aptos.\n\nCOLORS: ÚNICAMENT de la paleta corporativa: [#006699, #003366, #4d9900, #ff6600, #cc0000, #666666].\nFons de cards/boxes: versió clara (≤15% opacitat) dels colors de paleta.\nNO gradients. NO colors inventats fora de la paleta. Fons de slide sempre #ffffff.\nNo usis fons de color fort (blau intens, vermell) al body; usa blanc (#ffffff) o colors molt clars.\n\nCONTINGUT: Frases curtes i clares. Veu activa. Una idea principal per diapositiva.\nJerarquia: subtítol > cos. To institucional, formal però accessible.\n\nRESTRICCIONS: No generis logos, senyals ni símbols institucionals; s'inclouen automàticament.\nNO col·loquis cap element a les zones de header ni footer; el sistema les gestiona automàticament.",
  "assets": {
    "logo": "assets/logo.svg"
  },
  "layout": {
    "header": {
      "height": 62,
      "background": "#006699",
      "items": [
        {
          "type": "logo",
          "asset": "logo",
          "x": 14,
          "y": 7,
          "width": 130,
          "height": 30
        },
        {
          "type": "rect",
          "x": 158,
          "y": 10,
          "width": 1,
          "height": 42,
          "fill": "rgba(255,255,255,0.3)"
        },
        {
          "type": "text",
          "content": "{{slideTitle}}",
          "x": 172,
          "y": 0,
          "size": 18,
          "color": "#ffffff",
          "font": "Aptos, Calibri, sans-serif",
          "weight": "600"
        }
      ]
    },
    "footer": {
      "height": 36,
      "background": "#ffffff",
      "items": [
        {
          "type": "rect",
          "x": 0,
          "y": 0,
          "width": 1000,
          "height": 1,
          "fill": "#006699"
        },
        {
          "type": "text",
          "content": "Generalitat de Catalunya · {{courseTitle}}",
          "x": 16,
          "y": 6,
          "width": 880,
          "size": 10,
          "color": "#555555",
          "font": "Aptos, Calibri, sans-serif"
        },
        {
          "type": "pageNumber",
          "format": "n/total",
          "x": 916,
          "y": 6,
          "size": 10,
          "color": "#999999"
        }
      ]
    }
  }
}
```

### Why the gencat layout decisions

| Decision | Reasoning |
|---|---|
| Header 62px (11% of height) | Logo 30px + 7px top + 7px bottom margin + 8px for internal comfort |
| Separator rect at x=158 width=1 | Visual divider between logo and title, semi-transparent white |
| slideTitle in header, not logo-only | Each slide clearly labeled; no need for LLM to generate a title element |
| Footer 36px | Enough for 10px text with 6px top padding and room before canvas edge |
| Footer text width: 880 | Leaves room for pageNumber at x=916 (916+60=976 ≤ 1000) |
| courseTitle truncated at 70 chars | Prevents footer text overflow; "Introducció a la Intel·ligència Artificial" is 43 chars |
| pageNumber format: n/total | Users see "3/8" — immediate context of progress |
| modelInstructions bans title elements | Without this, LLM adds a duplicate title in the body zone |

---

## Minimal Theme (no layout)

For brands that don't need a fixed header/footer, or as a starting template:

```json
{
  "id": "mybrand",
  "name": "My Brand",
  "description": "Corporate theme",
  "locked": false,
  "builtIn": false,
  "version": "1.0.0",
  "typography": {
    "fontFamily": "'Brand Font', Arial, sans-serif",
    "headingWeight": "700",
    "bodyWeight": "400"
  },
  "colors": {
    "primary": "#1a4f8a",
    "secondary": "#2d7dd2",
    "background": "#ffffff",
    "text": "#222222",
    "accent": "#e8521a",
    "palette": ["#1a4f8a", "#2d7dd2", "#e8521a", "#2e8b57", "#8b1a1a", "#666666"]
  },
  "modelInstructions": "Follow My Brand visual identity.\n\nTYPOGRAPHY:\n- Headings: 'Brand Font' Bold 700, 24-28px, color #1a4f8a\n- Body: 'Brand Font' Regular 400, 14-16px, color #222222\n- Captions: 'Brand Font' Regular 400, 11px, color #555555\n\nCOLORS: Only from the corporate palette: [#1a4f8a, #2d7dd2, #e8521a, #2e8b57, #8b1a1a, #666666].\nNo gradients. No off-palette colors. Slide background: always #ffffff.\n\nCONTENT: Concise, active voice. One main idea per slide.",
  "assets": {}
}
```

No `layout` key = no header/footer injection. The LLM fills the full 562.5px canvas height.

---

## Checklist Before Submitting a Theme

Before adding a new theme to the system:

- [ ] `id` matches the directory name under `data/themes/`
- [ ] `assets` record keys match the `asset` values used in layout items
- [ ] Logo file exists at `data/themes/{id}/assets/{filename}`
- [ ] Header `height` + footer `height` < 150px (leaves at least 70% for content)
- [ ] Footer `text` width + `pageNumber` width + x-position ≤ 1000px (no overlap)
- [ ] `modelInstructions` explicitly says "do not generate header/footer elements"
- [ ] `modelInstructions` names specific fonts (not "a professional font")
- [ ] `modelInstructions` lists the exact color palette
- [ ] `styles.css` uses CSS variables for all colors and fonts
- [ ] `typography.fontFamily` uses fallback fonts in case the primary font is unavailable
- [ ] If using custom web fonts: add `fontUrl` to `typography` and `@import` to `styles.css`

---

## Common Mistakes

### Mistake 1 — LLM duplicates header content

**Symptom:** Every slide has a title both in the blue header band AND in the body below it.

**Fix:** Add to `modelInstructions`:
```
NO generis cap element de títol: el títol apareix automàticament al header.
```

### Mistake 2 — LLM uses off-brand colors

**Symptom:** Generated slides use dark blue backgrounds, invented purples, or gradients.

**Fix:** List the exact palette in `modelInstructions` and add:
```
NO gradients. NO colors invented outside the palette.
No dark or saturated backgrounds in the body; use white (#ffffff) or very light tints (≤15% opacity).
```

### Mistake 3 — Footer text overflows or gets clipped

**Symptom:** The course title text is cut off, or overlaps the page number.

**Fix:**
- Set explicit `width` on the footer text item (e.g. `"width": 880`)
- Verify: `text.x + text.width + pageNumber.width + pageNumber.x ≤ 1000`
- Increase footer `height` if text appears clipped at the canvas bottom edge (remember items need enough room: `y + fontSize + 10px padding` must be < zone height)

### Mistake 4 — Logo doesn't appear

**Symptom:** Header shows background color and title but no logo image.

**Causes to check:**
1. `assets.logo` key doesn't match `layout.header.items[0].asset` value
2. SVG file missing from `data/themes/{id}/assets/`
3. Logo item has `y` value that places it outside the zone height range

### Mistake 5 — Content touches header band

**Symptom:** Images or text boxes appear flush against the bottom edge of the header bar with no gap.

**Explanation:** The system tells the LLM to start content at `contentZone.top + 8px` (default gap). If the LLM ignores this, the spatial filter will only remove elements that actually *overlap* the header (top < headerHeight), not those that merely touch it.

**Fix:** Reinforce in `modelInstructions` with the exact starting y value:
```
Content zone starts at y = {headerHeight + 8}px. Never place elements above this line.
```

### Mistake 6 — Font specified but not available

**Symptom:** Text renders in a fallback font (Arial) instead of the brand font.

**Fix for system fonts** (Aptos, Calibri, Segoe UI): No installation needed — these come with Windows/Office.

**Fix for custom fonts:**
1. Add `"fontUrl": "https://fonts.googleapis.com/css2?family=..."` to `typography`
2. Add `@import url(...)` to `styles.css`
3. Use the exact font name in `modelInstructions` and layout item `font` fields

---

## Template for AI Prompt

When asking an AI to create a theme from a brand image or PPTX, provide:

```
Create an OpenMAIC theme for [Brand Name] following these specifications:

IDENTITY:
- Primary color: [#hex from image/brand guide]
- Secondary color: [#hex]
- Accent color: [#hex]
- Background: #ffffff
- Text: [#hex]
- Palette (6 colors for charts): [list]

TYPOGRAPHY:
- Font family: [name, fallbacks]
- Heading weight: [700 usually]
- Body weight: [400]

HEADER (from the PPTX/image):
- Height: [Xpx] — measured as [X/562.5] proportion of the slide
- Background: [#hex]
- Logo: [yes/no] — position x=[X], y=[Y], size [W]×[H]
- Title (slide title): [yes/no] — position x=[X], size=[Xpx], color=[#hex]
- Other elements: [describe separator lines, decorative shapes]

FOOTER (from the PPTX/image):
- Height: [Xpx]
- Background: [#hex or #ffffff]
- Text: course title at left, page number at right
- Separator line: [yes/no]

BRAND TONE: [formal/friendly/technical/institutional/educational]
LANGUAGE: [for the modelInstructions text — ca/en/es]

Output: A complete theme.json and styles.css following the OpenMAIC theme format.
Reference: docs/themes/creating-themes-with-ai.md for the exact JSON structure.
```
