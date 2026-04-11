import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { getBuiltInTheme } from '@/lib/themes/index';
import { loadCustomTheme, THEMES_DIR } from '@/lib/server/theme-storage';

type Params = Promise<{ themeId: string }>;

function isValidThemeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// GET /api/themes/[themeId]/export  → ZIP download
export async function GET(_req: Request, { params }: { params: Params }) {
  const { themeId } = await params;

  if (!isValidThemeId(themeId)) {
    return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
  }

  try {
    // Resolve theme source
    const builtIn = getBuiltInTheme(themeId);
    const themeDir = builtIn
      ? path.join(process.cwd(), 'lib', 'themes', themeId)
      : path.join(THEMES_DIR, themeId);

    const manifest = builtIn ?? (await loadCustomTheme(themeId));
    if (!manifest) return NextResponse.json({ error: 'Theme not found' }, { status: 404 });

    const zip = new JSZip();
    zip.file('theme.json', JSON.stringify(manifest, null, 2));

    // Add styles.css if exists
    try {
      const css = await fs.readFile(path.join(themeDir, 'styles.css'), 'utf-8');
      zip.file('styles.css', css);
    } catch {
      /* optional */
    }

    // Add assets if exist
    const assetsDir = path.join(themeDir, 'assets');
    try {
      const entries = await fs.readdir(assetsDir, { withFileTypes: true });
      const assetsFolder = zip.folder('assets')!;
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const buffer = await fs.readFile(path.join(assetsDir, entry.name));
        assetsFolder.file(entry.name, buffer);
      }
    } catch {
      /* no assets dir */
    }

    const zipBuffer = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });
    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="theme-${themeId}.zip"`,
      },
    });
  } catch (err) {
    console.error('[GET /api/themes/[themeId]/export]', err);
    return NextResponse.json({ error: 'Failed to export theme' }, { status: 500 });
  }
}
