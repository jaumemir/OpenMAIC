import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    adminConfig: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock config-crypto: decrypt returns the value as-is (no encryption key in test env)
vi.mock('@/lib/server/config-crypto', () => ({
  decrypt: (v: string) => v,
}));

describe('resolveApiKeyFromDb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty string when no globalConfig row exists', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue(null);

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });

  it('returns decrypted apiKey for a provider in providersConfig', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        providersConfig: {
          anthropic: { apiKey: 'sk-ant-stored', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('sk-ant-stored');
  });

  it('returns empty string when provider exists but apiKey is empty', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        providersConfig: {
          anthropic: { apiKey: '', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });

  it('returns empty string when provider is not in the config', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({ providersConfig: {} }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('openai')).toBe('');
  });

  it('resolves key from a non-default configSection (ttsProvidersConfig)', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockResolvedValue({
      key: 'globalConfig',
      value: JSON.stringify({
        ttsProvidersConfig: {
          'openai-tts': { apiKey: 'sk-tts-key', baseUrl: '' },
        },
      }),
      id: '1',
      updatedAt: new Date(),
      updatedById: null,
    });

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('openai-tts', 'ttsProvidersConfig')).toBe('sk-tts-key');
  });

  it('returns empty string and does not throw when prisma throws', async () => {
    const { prisma } = await import('@/lib/prisma');
    vi.mocked(prisma.adminConfig.findUnique).mockRejectedValue(new Error('DB error'));

    const { resolveApiKeyFromDb } = await import('@/lib/server/db-provider-config');
    expect(await resolveApiKeyFromDb('anthropic')).toBe('');
  });
});
