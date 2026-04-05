# Themes

OpenMAIC supports visual themes that control the appearance of generated material (slides, interactive HTML) and provide style instructions to the AI model.

> The app's own UI (dark/light mode, settings panel, etc.) is not affected by themes.

---

## Built-in themes

Built-in themes ship with the application and cannot be deleted. They live in `lib/themes/` and are version-controlled.

Currently built-in:
- **Sistema** — default OpenMAIC style

---

## Custom themes

Custom themes are stored in `data/themes/{themeId}/` on the server. They can be created, imported, exported and deleted via Settings → Temes.

The starter custom theme **Gencat** (Sistema de Disseny de la Generalitat de Catalunya) ships in `data/themes/gencat/`.

---

## Theme file structure

A theme is a directory with these files:

```
data/themes/my-theme/
├── theme.json       ← required: theme manifest
├── styles.css       ← optional: CSS injected into generated content
└── assets/          ← optional: static files (logos, icons)
    ├── logo.svg
    └── icon.png
```

---

## `theme.json` reference

```json
{
  "id": "my-theme",
  "name": "My Theme",
  "description": "Short description",
  "locked": false,
  "builtIn": false,
  "version": "1.0.0",
  "typography": {
    "fontFamily": "Inter, sans-serif",
    "fontUrl": "https://fonts.googleapis.com/css2?family=Inter:wght@400;700",
    "headingWeight": "700",
    "bodyWeight": "400"
  },
  "colors": {
    "primary":    "#1a73e8",
    "secondary":  "#1557b0",
    "background": "#ffffff",
    "text":       "#202124",
    "accent":     "#ea4335",
    "palette":    ["#1a73e8","#1557b0","#ea4335","#34a853","#fbbc04","#666666"]
  },
  "modelInstructions": "Use a professional, clear tone. Prefer concise bullet points.",
  "assets": {
    "logo": "assets/logo.svg"
  }
}
```

### Field descriptions

| Field | Required | Description |
|-------|----------|-------------|
| `id` | ✅ | Unique identifier — only letters, numbers, `-` and `_`, max 64 chars |
| `name` | ✅ | Display name shown in the theme selector |
| `locked` | ✅ | `true` = cannot be deleted. Always `false` for custom themes. |
| `builtIn` | ✅ | Always `false` for custom themes (set automatically on import) |
| `version` | ✅ | Semver string, e.g. `"1.0.0"` |
| `typography.fontFamily` | ✅ | CSS font-family stack; first font is used for slide fontName |
| `typography.fontUrl` | — | Google Fonts or other CDN URL loaded in generated HTML |
| `colors.palette` | ✅ | 6-element array used for charts and graphic elements |
| `modelInstructions` | — | Text appended to the AI model's system prompt during generation |
| `assets` | — | Map of asset names to relative paths inside `assets/` |

---

## `styles.css`

The CSS file is injected into:
1. **Slide rendering** — CSS custom properties drive colors and typography
2. **Interactive HTML elements** — the full file is injected inside `<style>` in the generated HTML

Use CSS custom properties for theming:

```css
:root {
  --theme-primary: #1a73e8;
  --theme-secondary: #1557b0;
  --theme-background: #ffffff;
  --theme-text: #202124;
  --theme-font-family: 'Inter', sans-serif;
  --theme-heading-weight: 700;
  --theme-body-weight: 400;
}
```

---

## Creating a new theme from scratch

1. Create a directory: `data/themes/my-theme/`
2. Create `theme.json` following the schema above
3. Create `styles.css` with your CSS variables
4. Add any logos/icons to `assets/`
5. The API picks up the new theme dynamically — no server restart needed

> **Note:** `data/` is in `.gitignore`. Use `git add --force data/themes/my-theme/` to version-control a custom theme (as done for `gencat`).

---

## ZIP format (import/export)

Themes can be packed as a ZIP for sharing or backup:

```
theme-my-theme.zip
├── theme.json
├── styles.css
└── assets/
    ├── logo.svg
    └── icon.png
```

**Export:** Settings → Temes → Download button (⬇)  
**Import:** Settings → Temes → Upload ZIP button (⬆)

Limits: max 20 MB compressed, max 50 MB uncompressed, max 100 asset files.

---

## Using assets in model instructions

Assets are served via `/api/themes/{id}/assets/{filename}` and can be referenced in `modelInstructions` or prompt templates.

Example:
```
Include the institutional logo at the top of each slide.
Use the URL /api/themes/gencat/assets/logo.svg — do not generate a logo yourself.
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/themes` | List all themes (built-ins first, then custom) |
| `POST` | `/api/themes` | Create a new custom theme (JSON body) |
| `GET` | `/api/themes/:id` | Get full theme manifest |
| `DELETE` | `/api/themes/:id` | Delete a custom theme (403 if built-in or locked) |
| `GET` | `/api/themes/:id/export` | Download theme as ZIP |
| `POST` | `/api/themes/import` | Upload a ZIP to import a theme |
| `GET` | `/api/themes/:id/assets/:filename` | Serve a theme asset file |
