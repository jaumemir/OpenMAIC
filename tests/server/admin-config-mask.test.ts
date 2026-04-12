import { describe, expect, it } from 'vitest';
import { maskApiKeys, stripSentinelApiKeys } from '@/lib/server/admin-config-mask';
import type { SerializableSettings } from '@/app/api/admin/config/providers/route';

const SENTINEL = '__STORED__';

// Helper per crear SerializableSettings de test sense haver de satisfer tots els camps
function cfg(
  partial: Record<string, { apiKey: string; [k: string]: unknown }>,
): SerializableSettings {
  return { providersConfig: partial as unknown as SerializableSettings['providersConfig'] };
}

describe('maskApiKeys', () => {
  it('replaces non-empty apiKeys with sentinel', () => {
    const config = cfg({
      anthropic: { apiKey: 'sk-real-key', baseUrl: '' },
      openai: { apiKey: 'sk-openai', baseUrl: '' },
    });
    const masked = maskApiKeys(config);
    expect(masked.providersConfig?.anthropic.apiKey).toBe(SENTINEL);
    expect(masked.providersConfig?.openai.apiKey).toBe(SENTINEL);
  });

  it('leaves empty apiKeys as empty string', () => {
    const config = cfg({ openai: { apiKey: '', baseUrl: '' } });
    const masked = maskApiKeys(config);
    expect(masked.providersConfig?.openai.apiKey).toBe('');
  });

  it('masks keys in ttsProvidersConfig', () => {
    const config: SerializableSettings = {
      ttsProvidersConfig: {
        'openai-tts': { apiKey: 'sk-tts', baseUrl: '', enabled: true },
      },
    };
    const masked = maskApiKeys(config);
    expect(masked.ttsProvidersConfig?.['openai-tts'].apiKey).toBe(SENTINEL);
  });

  it('does not mutate the original config', () => {
    const config = cfg({ anthropic: { apiKey: 'sk-real', baseUrl: '' } });
    maskApiKeys(config);
    expect(config.providersConfig?.anthropic.apiKey).toBe('sk-real');
  });
});

describe('stripSentinelApiKeys', () => {
  it('preserves existing key when incoming is sentinel', () => {
    const incoming = { anthropic: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-existing', baseUrl: '' } };
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('sk-existing');
  });

  it('uses new key when incoming is a real key', () => {
    const incoming = { anthropic: { apiKey: 'sk-new-key', baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-old', baseUrl: '' } };
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('sk-new-key');
  });

  it('uses empty string when incoming is empty and no existing key', () => {
    const incoming = { anthropic: { apiKey: '', baseUrl: '' } };
    const existing = {};
    const result = stripSentinelApiKeys(incoming, existing);
    expect(result.anthropic.apiKey).toBe('');
  });

  it('handles new provider not in existing', () => {
    const incoming = { newprovider: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = {};
    const result = stripSentinelApiKeys(incoming, existing);
    // Sentinel with no existing key → empty string
    expect(result.newprovider.apiKey).toBe('');
  });

  it('does not mutate the incoming object', () => {
    const incoming = { anthropic: { apiKey: SENTINEL, baseUrl: '' } };
    const existing = { anthropic: { apiKey: 'sk-existing', baseUrl: '' } };
    stripSentinelApiKeys(incoming, existing);
    expect(incoming.anthropic.apiKey).toBe(SENTINEL);
  });
});
