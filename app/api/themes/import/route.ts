import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getBuiltInTheme } from '@/lib/themes/index';
import {
  saveCustomTheme,
  saveCustomThemeCSS,
  saveThemeAsset,
} from '@/lib/server/theme-storage';
import type { ThemeManifest } from '@/lib/types/theme';

// POST /api/themes/import — multipart body with a single 'file' field (ZIP)
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Parse theme.json
    const manifestEntry = zip.file('theme.json');
    if (!manifestEntry) {
      return NextResponse.json({ error: 'ZIP must contain theme.json' }, { status: 400 });
    }
    const manifestText = await manifestEntry.async('text');
    let manifest: ThemeManifest;
    try {
      manifest = JSON.parse(manifestText) as ThemeManifest;
    } catch {
      return NextResponse.json({ error: 'theme.json is not valid JSON' }, { status: 400 });
    }
    if (!manifest.id || !manifest.name) {
      return NextResponse.json({ error: 'theme.json must have id and name' }, { status: 400 });
    }

    // Prevent overwriting built-ins
    if (getBuiltInTheme(manifest.id)) {
      return NextResponse.json({ error: 'Cannot overwrite a built-in theme' }, { status: 403 });
    }

    // Force builtIn: false for all imports
    manifest.builtIn = false;

    await saveCustomTheme(manifest);  // also validates manifest.id internally

    // styles.css (optional)
    const cssEntry = zip.file('styles.css');
    if (cssEntry) {
      const css = await cssEntry.async('text');
      await saveCustomThemeCSS(manifest.id, css);
    }

    // assets/ (optional)
    const assetEntries = Object.entries(zip.files).filter(
      ([name]) => name.startsWith('assets/') && !name.endsWith('/'),
    );
    for (const [name, entry] of assetEntries) {
      const filename = name.replace('assets/', '');
      // Sanitise: no path traversal, no hidden files
      if (filename.includes('/') || filename.includes('..') || filename.startsWith('.')) continue;
      const buffer = Buffer.from(await entry.async('arraybuffer'));
      await saveThemeAsset(manifest.id, filename, buffer);
    }

    return NextResponse.json(manifest, { status: 201 });
  } catch (err) {
    console.error('[POST /api/themes/import]', err);
    return NextResponse.json({ error: 'Failed to import theme' }, { status: 500 });
  }
}
