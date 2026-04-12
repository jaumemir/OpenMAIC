/**
 * Fetches model instructions for the active theme.
 * Returns empty string if no theme is set or instructions are empty.
 */
import { getBuiltInTheme } from '@/lib/themes/index';
import {
  loadCustomTheme,
  loadCustomThemeCSS,
  getThemeAssetPath,
  THEMES_DIR,
} from '@/lib/server/theme-storage';
import type { ThemeManifest } from '@/lib/types/theme';
import path from 'path';
import { promises as fs } from 'fs';

export async function resolveThemeInstructions(themeId: string | undefined): Promise<string> {
  if (!themeId) return '';
  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) return builtIn.modelInstructions ?? '';
  const custom = await loadCustomTheme(themeId);
  return custom?.modelInstructions ?? '';
}

export async function resolveThemeManifest(
  themeId: string | undefined,
): Promise<ThemeManifest | null> {
  if (!themeId) return null;
  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) return builtIn;
  return loadCustomTheme(themeId);
}

export async function resolveThemeCSS(themeId: string | undefined): Promise<string> {
  if (!themeId) return '';
  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) {
    const cssPath = path.join(process.cwd(), 'lib', 'themes', themeId, 'styles.css');
    try {
      return await fs.readFile(cssPath, 'utf-8');
    } catch {
      return '';
    }
  }
  return (await loadCustomThemeCSS(themeId)) ?? '';
}

/**
 * Resolves a theme asset bare filename (e.g. "logo.svg") to a base64 data URI.
 *
 * Called by scene-generator.ts when injecting logo assets into slides.
 * Returns a data URI so the asset is embedded natively in web, PPTX, and SCORM
 * without any extra asset-tracking or ZIP bundling.
 *
 * Returns empty string if the asset cannot be read (non-fatal; logo simply omitted).
 */
export async function resolveThemeAssetDataUri(
  themeId: string,
  filename: string,
): Promise<string> {
  try {
    // getThemeAssetPath validates the filename and resolves to data/themes/{id}/assets/{filename}
    const assetPath = getThemeAssetPath(themeId, filename);
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(filename).toLowerCase();
    const mime =
      ext === '.svg'
        ? 'image/svg+xml'
        : ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return '';
  }
}

// Re-export THEMES_DIR for consumers that need the base path
export { THEMES_DIR };
