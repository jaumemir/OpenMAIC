import { NextResponse } from 'next/server';
import { getBuiltInTheme } from '@/lib/themes/index';
import { loadCustomTheme, deleteCustomTheme } from '@/lib/server/theme-storage';

type Params = Promise<{ themeId: string }>;

// GET /api/themes/[themeId]
export async function GET(
  _req: Request,
  { params }: { params: Params },
) {
  const { themeId } = await params;
  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) return NextResponse.json(builtIn);
  const custom = await loadCustomTheme(themeId);
  if (custom) return NextResponse.json(custom);
  return NextResponse.json({ error: 'Theme not found' }, { status: 404 });
}

// DELETE /api/themes/[themeId]
export async function DELETE(
  _req: Request,
  { params }: { params: Params },
) {
  const { themeId } = await params;
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
}
