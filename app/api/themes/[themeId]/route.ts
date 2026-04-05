import { NextResponse } from 'next/server';
import { getBuiltInTheme } from '@/lib/themes/index';
import { loadCustomTheme, deleteCustomTheme } from '@/lib/server/theme-storage';

type Params = Promise<{ themeId: string }>;

function isValidThemeId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

// GET /api/themes/[themeId]
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { themeId } = await params;
  if (!isValidThemeId(themeId)) {
    return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
  }
  try {
    const builtIn = getBuiltInTheme(themeId);
    if (builtIn) return NextResponse.json(builtIn);
    const custom = await loadCustomTheme(themeId);
    if (custom) return NextResponse.json(custom);
    return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
  } catch (err) {
    console.error('[GET /api/themes/[themeId]]', err);
    return NextResponse.json({ error: 'Failed to load theme' }, { status: 500 });
  }
}

// DELETE /api/themes/[themeId]
export async function DELETE(
  _req: Request,
  { params }: { params: Params },
) {
  const { themeId } = await params;
  if (!isValidThemeId(themeId)) {
    return NextResponse.json({ error: 'Invalid theme id' }, { status: 400 });
  }
  try {
    const builtIn = getBuiltInTheme(themeId);
    if (builtIn) {
      return NextResponse.json({ error: 'Cannot delete a built-in theme' }, { status: 403 });
    }
    const custom = await loadCustomTheme(themeId);
    if (!custom) {
      return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
    }
    if (custom.locked) {
      return NextResponse.json({ error: 'Theme is locked' }, { status: 403 });
    }
    await deleteCustomTheme(themeId);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/themes/[themeId]]', err);
    return NextResponse.json({ error: 'Failed to delete theme' }, { status: 500 });
  }
}
