import { describe, it, expect } from 'vitest';
import { getBuiltInThemes, getBuiltInTheme } from '@/lib/themes/index';

describe('getBuiltInThemes', () => {
  it('returns at least the Sistema theme', () => {
    const themes = getBuiltInThemes();
    expect(themes.length).toBeGreaterThanOrEqual(1);
    const sistema = themes.find((t) => t.id === 'sistema');
    expect(sistema).toBeDefined();
    expect(sistema?.locked).toBe(true);
    expect(sistema?.builtIn).toBe(true);
  });
});

describe('getBuiltInTheme', () => {
  it('returns the theme by id', () => {
    const t = getBuiltInTheme('sistema');
    expect(t?.id).toBe('sistema');
  });

  it('returns undefined for unknown id', () => {
    expect(getBuiltInTheme('nonexistent')).toBeUndefined();
  });
});
