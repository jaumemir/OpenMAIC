import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getBuiltInTheme } from '@/lib/themes/index';
import { saveCustomTheme, saveCustomThemeCSS, saveThemeAsset } from '@/lib/server/theme-storage';
import type { ThemeManifest } from '@/lib/types/theme';

// POST /api/themes/import — multipart body with a single 'file' field (ZIP)
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
    }

    const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'ZIP file too large' }, { status: 413 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(arrayBuffer);
    } catch {
      return NextResponse.json({ error: 'Uploaded file is not a valid ZIP' }, { status: 400 });
    }

    // ZIP bomb guard — check total uncompressed size before extraction
    const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50 MB
    const totalUncompressed = Object.values(zip.files).reduce(
      (sum, f) =>
        sum +
        ((f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0),
      0,
    );
    if (totalUncompressed > MAX_UNCOMPRESSED_BYTES) {
      return NextResponse.json({ error: 'ZIP contents exceed size limit' }, { status: 400 });
    }

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
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(manifest.id)) {
      return NextResponse.json(
        { error: 'theme.json id is invalid (use only letters, numbers, - and _)' },
        { status: 400 },
      );
    }

    // Prevent overwriting built-ins
    if (getBuiltInTheme(manifest.id)) {
      return NextResponse.json({ error: 'Cannot overwrite a built-in theme' }, { status: 403 });
    }

    // Force builtIn: false for all imports
    manifest.builtIn = false;
    manifest.locked = false;

    await saveCustomTheme(manifest); // also validates manifest.id internally

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
    const MAX_ASSETS = 100;
    if (assetEntries.length > MAX_ASSETS) {
      return NextResponse.json({ error: 'ZIP contains too many asset files' }, { status: 400 });
    }
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
