import sistemaManifestRaw from './sistema/theme.json';
import type { ThemeManifest, ThemeListItem } from '@/lib/types/theme';

const BUILT_IN_MANIFESTS: ThemeManifest[] = [sistemaManifestRaw satisfies ThemeManifest];

export function getBuiltInThemes(): ThemeListItem[] {
  return BUILT_IN_MANIFESTS.map(
    (t): ThemeListItem => ({
      id: t.id,
      name: t.name,
      description: t.description,
      locked: t.locked,
      builtIn: t.builtIn,
      colors: { primary: t.colors.primary, background: t.colors.background },
    }),
  );
}

export function getBuiltInTheme(id: string): ThemeManifest | undefined {
  return BUILT_IN_MANIFESTS.find((t) => t.id === id);
}
