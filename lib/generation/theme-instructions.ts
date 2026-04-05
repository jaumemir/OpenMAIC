/**
 * Fetches model instructions for the active theme.
 * Returns empty string if no theme is set or instructions are empty.
 */
import { getBuiltInTheme } from '@/lib/themes/index';
import { loadCustomTheme } from '@/lib/server/theme-storage';

export async function resolveThemeInstructions(themeId: string | undefined): Promise<string> {
  if (!themeId) return '';
  const builtIn = getBuiltInTheme(themeId);
  if (builtIn) return builtIn.modelInstructions ?? '';
  const custom = await loadCustomTheme(themeId);
  return custom?.modelInstructions ?? '';
}
