import { NextResponse } from 'next/server';
import { getBuiltInThemes } from '@/lib/themes/index';
import { listCustomThemes, saveCustomTheme, saveCustomThemeCSS } from '@/lib/server/theme-storage';
import type { ThemeManifest } from '@/lib/types/theme';

// GET /api/themes — fused list (built-ins first, then custom)
export async function GET() {
  const builtIns = getBuiltInThemes();
  const custom = await listCustomThemes();
  // Deduplicate: built-in wins if same id
  const builtInIds = new Set(builtIns.map((t) => t.id));
  const filteredCustom = custom.filter((t) => !builtInIds.has(t.id));
  return NextResponse.json([...builtIns, ...filteredCustom]);
}

// POST /api/themes — create custom theme
export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ThemeManifest> & { css?: string };
  if (!body.id || !body.name) {
    return NextResponse.json({ error: 'id and name are required' }, { status: 400 });
  }
  // Prevent overwriting built-ins
  const builtIns = getBuiltInThemes();
  if (builtIns.some((t) => t.id === body.id)) {
    return NextResponse.json({ error: 'Cannot overwrite a built-in theme' }, { status: 403 });
  }
  try {
    const manifest: ThemeManifest = {
      id: body.id,
      name: body.name,
      description: body.description ?? '',
      locked: false,
      builtIn: false,
      version: body.version ?? '1.0.0',
      typography: body.typography ?? {
        fontFamily: 'system-ui',
        headingWeight: '700',
        bodyWeight: '400',
      },
      colors: body.colors ?? {
        primary: '#000000',
        secondary: '#333333',
        background: '#ffffff',
        text: '#333333',
        accent: '#ff0000',
        palette: [],
      },
      modelInstructions: body.modelInstructions ?? '',
      assets: body.assets ?? {},
    };
    await saveCustomTheme(manifest);
    if (body.css && typeof body.css === 'string') {
      await saveCustomThemeCSS(manifest.id, body.css);
    }
    return NextResponse.json(manifest, { status: 201 });
  } catch (err) {
    console.error('[POST /api/themes]', err);
    return NextResponse.json({ error: 'Failed to create theme' }, { status: 500 });
  }
}
