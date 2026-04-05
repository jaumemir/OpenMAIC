import { describe, it, expect } from 'vitest';
import { themeToSlideTheme } from '@/lib/generation/theme-utils';
import type { ThemeManifest } from '@/lib/types/theme';

const gencatManifest: ThemeManifest = {
  id: 'gencat', name: 'Gencat', description: '', locked: false, builtIn: false, version: '1.0.0',
  typography: { fontFamily: 'Open Sans, Arial, sans-serif', headingWeight: '700', bodyWeight: '400' },
  colors: { primary: '#006699', secondary: '#003366', background: '#ffffff', text: '#333333', accent: '#cc0000', palette: ['#006699', '#003366', '#cc0000', '#4d9900', '#ff6600', '#666666'] },
  modelInstructions: '',
  assets: {},
};

describe('themeToSlideTheme', () => {
  it('maps colors correctly', () => {
    const st = themeToSlideTheme(gencatManifest);
    expect(st.backgroundColor).toBe('#ffffff');
    expect(st.fontColor).toBe('#333333');
    expect(st.themeColors[0]).toBe('#006699');
    expect(st.themeColors).toHaveLength(5);
  });

  it('extracts first font family', () => {
    const st = themeToSlideTheme(gencatManifest);
    expect(st.fontName).toBe('Open Sans');
  });
});
