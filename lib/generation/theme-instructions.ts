/**
 * Fetches model instructions for the active theme.
 * Returns empty string if no theme is set or instructions are empty.
 */
import { getBuiltInTheme } from '@/lib/themes/index';
import { loadCustomTheme, loadCustomThemeCSS } from '@/lib/server/theme-storage';
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

export async function resolveThemeManifest(themeId: string | undefined): Promise<ThemeManifest | null> {
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
    try { return await fs.readFile(cssPath, 'utf-8'); } catch { return ''; }
  }
  return (await loadCustomThemeCSS(themeId)) ?? '';
}
