import { describe, it, expect } from 'vitest';

describe('settings store themeId', () => {
  it('has sistema as default themeId', async () => {
    // Reset module to get fresh state
    const { useSettingsStore } = await import('@/lib/store/settings');
    const state = useSettingsStore.getState();
    expect(state.themeId).toBe('sistema');
  });

  it('setTheme updates themeId', async () => {
    const { useSettingsStore } = await import('@/lib/store/settings');
    useSettingsStore.getState().setTheme('gencat');
    expect(useSettingsStore.getState().themeId).toBe('gencat');
    // Reset
    useSettingsStore.getState().setTheme('sistema');
  });
});
