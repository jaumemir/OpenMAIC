import { describe, it, expect } from 'vitest';

// We test via the module directly
describe('listCustomThemes', () => {
  it('returns gencat theme when data/themes/gencat exists', async () => {
    // This test relies on data/themes/gencat/ being present (it is, committed)
    const { listCustomThemes } = await import('@/lib/server/theme-storage');
    const themes = await listCustomThemes();
    expect(Array.isArray(themes)).toBe(true);
    const gencat = themes.find((t) => t.id === 'gencat');
    expect(gencat).toBeDefined();
    expect(gencat?.builtIn).toBe(false);
  });
});

describe('loadCustomTheme', () => {
  it('returns gencat manifest', async () => {
    const { loadCustomTheme } = await import('@/lib/server/theme-storage');
    const t = await loadCustomTheme('gencat');
    expect(t?.id).toBe('gencat');
    expect(t?.colors.primary).toBe('#cc0000');
  });

  it('returns null for nonexistent theme', async () => {
    const { loadCustomTheme } = await import('@/lib/server/theme-storage');
    expect(await loadCustomTheme('nonexistent')).toBeNull();
  });
});
