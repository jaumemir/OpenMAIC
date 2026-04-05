import type { ThemeManifest, ThemeListItem } from '@/lib/types/theme';
import { describe, it, expect } from 'vitest';

describe('ThemeManifest type', () => {
  it('has required fields', () => {
    const t: ThemeManifest = {
      id: 'test', name: 'Test', description: '', locked: false, builtIn: false, version: '1.0.0',
      typography: { fontFamily: 'sans-serif', headingWeight: '700', bodyWeight: '400' },
      colors: { primary: '#000', secondary: '#111', background: '#fff', text: '#333', accent: '#f00', palette: ['#000'] },
      modelInstructions: '',
      assets: {},
    };
    expect(t.id).toBe('test');
    expect(t.locked).toBe(false);
  });
});
