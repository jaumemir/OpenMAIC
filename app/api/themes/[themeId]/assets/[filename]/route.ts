import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getThemeAssetPath } from '@/lib/server/theme-storage';
import { getBuiltInTheme } from '@/lib/themes/index';

type Params = Promise<{ themeId: string; filename: string }>;

// GET /api/themes/[themeId]/assets/[filename]
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { themeId, filename } = await params;

  // Sanitise filename — no path traversal
  const safe = path.basename(filename);
  let assetPath: string;

  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) {
    assetPath = path.join(process.cwd(), 'lib', 'themes', themeId, 'assets', safe);
  } else {
    assetPath = getThemeAssetPath(themeId, safe); // synchronous — no await
  }

  try {
    const buffer = await fs.readFile(assetPath);
    const ext = path.extname(safe).toLowerCase();
    const contentType =
      ext === '.svg' ? 'image/svg+xml' :
      ext === '.png' ? 'image/png' :
      ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }
}
