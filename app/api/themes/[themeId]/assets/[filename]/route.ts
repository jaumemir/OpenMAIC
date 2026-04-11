import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getThemeAssetPath } from '@/lib/server/theme-storage';
import { getBuiltInTheme } from '@/lib/themes/index';

type Params = Promise<{ themeId: string; filename: string }>;

function isValidThemeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// GET /api/themes/[themeId]/assets/[filename]
export async function GET(_req: Request, { params }: { params: Params }) {
  const { themeId, filename } = await params;

  if (!isValidThemeId(themeId)) {
    return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
  }

  const safe = path.basename(filename);

  try {
    let assetPath: string;
    const builtIn = getBuiltInTheme(themeId);
    if (builtIn) {
      assetPath = path.join(process.cwd(), 'lib', 'themes', themeId, 'assets', safe);
    } else {
      assetPath = getThemeAssetPath(themeId, safe); // may throw on invalid filename
    }

    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(safe).toLowerCase();
    const contentType =
      ext === '.svg'
        ? 'image/svg+xml'
        : ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }
    console.error('[GET /api/themes/[themeId]/assets/[filename]]', err);
    return NextResponse.json({ error: 'Failed to serve asset' }, { status: 500 });
  }
}
