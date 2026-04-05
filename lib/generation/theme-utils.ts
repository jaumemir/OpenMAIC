import type { ThemeManifest } from '@/lib/types/theme';
import type { SlideTheme } from '@/lib/types/slides';

/**
 * Convert a ThemeManifest to the SlideTheme format expected by the PPT renderer.
 */
export function themeToSlideTheme(manifest: ThemeManifest): SlideTheme {
  const palette = manifest.colors.palette.slice(0, 5);
  // Pad to 5 if needed
  while (palette.length < 5) palette.push(manifest.colors.primary);
  return {
    backgroundColor: manifest.colors.background,
    themeColors: palette,
    fontColor: manifest.colors.text,
    fontName: manifest.typography.fontFamily.split(',')[0].trim().replace(/['"]/g, ''),
    outline: { color: manifest.colors.primary, width: 2, style: 'solid' },
    shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
  };
}

export function defaultSlideTheme(): SlideTheme {
  return {
    backgroundColor: '#ffffff',
    themeColors: ['#5b9bd5', '#ed7d31', '#a5a5a5', '#ffc000', '#4472c4'],
    fontColor: '#333333',
    fontName: 'Microsoft YaHei',
    outline: { color: '#d14424', width: 2, style: 'solid' },
    shadow: { h: 0, v: 0, blur: 10, color: '#000000' },
  };
}
