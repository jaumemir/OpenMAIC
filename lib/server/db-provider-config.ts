/**
 * DB-backed provider key resolution.
 *
 * Reads API keys directly from AdminConfig (Prisma) as a server-side fallback.
 * Used when the client does not supply a key (user role, or admin with masked key).
 * Never exposes keys to the client.
 */

import { prisma } from '@/lib/prisma';
import { decrypt } from '@/lib/server/config-crypto';

export type DbConfigSection =
  | 'providersConfig'
  | 'ttsProvidersConfig'
  | 'asrProvidersConfig'
  | 'pdfProvidersConfig'
  | 'imageProvidersConfig'
  | 'videoProvidersConfig'
  | 'webSearchProvidersConfig';

/**
 * Returns the decrypted API key for a provider stored in AdminConfig.
 * Returns '' when the key does not exist or on any error.
 */
export async function resolveApiKeyFromDb(
  providerId: string,
  configSection: DbConfigSection = 'providersConfig',
): Promise<string> {
  try {
    const row = await prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } });
    if (!row) return '';

    const config = JSON.parse(row.value) as Record<
      string,
      Record<string, { apiKey?: string }> | undefined
    >;
    const section = config[configSection];
    if (!section) return '';

    const entry = section[providerId];
    if (!entry?.apiKey) return '';

    return decrypt(entry.apiKey);
  } catch {
    return '';
  }
}

/**
 * Returns the base URL for a provider stored in AdminConfig.
 * Returns undefined when it does not exist or on any error.
 */
export async function resolveBaseUrlFromDb(
  providerId: string,
  configSection: DbConfigSection = 'providersConfig',
): Promise<string | undefined> {
  try {
    const row = await prisma.adminConfig.findUnique({ where: { key: 'globalConfig' } });
    if (!row) return undefined;

    const config = JSON.parse(row.value) as Record<
      string,
      Record<string, { baseUrl?: string }> | undefined
    >;
    const section = config[configSection];
    if (!section) return undefined;

    return section[providerId]?.baseUrl || undefined;
  } catch {
    return undefined;
  }
}
