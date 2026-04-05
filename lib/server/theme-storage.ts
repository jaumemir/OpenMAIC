/**
 * Theme storage — filesystem CRUD for custom themes.
 * Custom themes live under:  data/themes/{themeId}/
 * Built-in themes are NOT managed here; see lib/themes/index.ts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ThemeManifest, ThemeListItem } from '@/lib/types/theme';

export const THEMES_DIR = path.join(process.cwd(), 'data', 'themes');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export async function listCustomThemes(): Promise<ThemeListItem[]> {
  try {
    await ensureDir(THEMES_DIR);
    const entries = await fs.readdir(THEMES_DIR, { withFileTypes: true });
    const results: ThemeListItem[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const manifestPath = path.join(THEMES_DIR, entry.name, 'theme.json');
      const manifest = await readJson<ThemeManifest>(manifestPath);
      if (!manifest) continue;
      results.push({
        id: manifest.id,
        name: manifest.name,
        description: manifest.description,
        locked: manifest.locked,
        builtIn: false,
        colors: { primary: manifest.colors.primary, background: manifest.colors.background },
      });
    }
    return results;
  } catch {
    return [];
  }
}

export async function loadCustomTheme(themeId: string): Promise<ThemeManifest | null> {
  const manifestPath = path.join(THEMES_DIR, themeId, 'theme.json');
  return readJson<ThemeManifest>(manifestPath);
}

export async function saveCustomTheme(manifest: ThemeManifest): Promise<void> {
  const themeDir = path.join(THEMES_DIR, manifest.id);
  await ensureDir(themeDir);
  const tmp = path.join(themeDir, `theme.json.${process.pid}.tmp`);
  await fs.writeFile(tmp, JSON.stringify(manifest, null, 2), 'utf-8');
  await fs.rename(tmp, path.join(themeDir, 'theme.json'));
}

export async function saveCustomThemeCSS(themeId: string, css: string): Promise<void> {
  const themeDir = path.join(THEMES_DIR, themeId);
  await ensureDir(themeDir);
  await fs.writeFile(path.join(themeDir, 'styles.css'), css, 'utf-8');
}

export async function loadCustomThemeCSS(themeId: string): Promise<string | null> {
  const cssPath = path.join(THEMES_DIR, themeId, 'styles.css');
  try {
    return await fs.readFile(cssPath, 'utf-8');
  } catch {
    return null;
  }
}

export async function deleteCustomTheme(themeId: string): Promise<void> {
  const themeDir = path.join(THEMES_DIR, themeId);
  await fs.rm(themeDir, { recursive: true, force: true });
}

export async function getThemeAssetPath(themeId: string, filename: string): Promise<string> {
  return path.join(THEMES_DIR, themeId, 'assets', filename);
}

export async function saveThemeAsset(
  themeId: string,
  filename: string,
  buffer: Buffer,
): Promise<void> {
  const assetDir = path.join(THEMES_DIR, themeId, 'assets');
  await ensureDir(assetDir);
  await fs.writeFile(path.join(assetDir, filename), buffer);
}
