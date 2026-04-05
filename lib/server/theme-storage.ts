/**
 * Theme storage — filesystem CRUD for custom themes.
 * Custom themes live under:  data/themes/{themeId}/
 * Built-in themes are NOT managed here; see lib/themes/index.ts.
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { ThemeManifest, ThemeListItem } from '@/lib/types/theme';
import { writeJsonFileAtomic } from '@/lib/server/classroom-storage';

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
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(manifest.id)) {
    throw new Error(`Invalid theme id: ${manifest.id}`);
  }
  const themeDir = path.join(THEMES_DIR, manifest.id);
  await ensureDir(themeDir);
  await writeJsonFileAtomic(path.join(themeDir, 'theme.json'), manifest);
}

export async function saveCustomThemeCSS(themeId: string, css: string): Promise<void> {
  const themeDir = path.join(THEMES_DIR, themeId);
  await ensureDir(themeDir);
  const filePath = path.join(themeDir, 'styles.css');
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, css, 'utf-8');
  await fs.rename(tmp, filePath);
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

export function getThemeAssetPath(themeId: string, filename: string): string {
  if (!/^[a-zA-Z0-9_.\-]{1,128}$/.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid asset filename: ${filename}`);
  }
  return path.join(THEMES_DIR, themeId, 'assets', filename);
}

export async function saveThemeAsset(
  themeId: string,
  filename: string,
  buffer: Buffer,
): Promise<void> {
  if (!/^[a-zA-Z0-9_.\-]{1,128}$/.test(filename) || filename.includes('..')) {
    throw new Error(`Invalid asset filename: ${filename}`);
  }
  const assetDir = path.join(THEMES_DIR, themeId, 'assets');
  await ensureDir(assetDir);
  const filePath = path.join(assetDir, filename);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, buffer);
  await fs.rename(tmp, filePath);
}
