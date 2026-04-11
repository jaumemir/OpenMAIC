/**
 * Xifrat AES-256-GCM per a API keys emmagatzemades a AdminConfig
 *
 * Clau: CONFIG_ENCRYPTION_KEY (variable d'entorn, hex 64 chars = 32 bytes)
 * Format del ciphertext: "iv:authTag:data" (tot en hex)
 *
 * Si CONFIG_ENCRYPTION_KEY no està definida, les claus es guarden en text pla
 * (comportament degradat acceptable per a dev local sense xifrat configurat).
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { ProvidersConfig } from '@/lib/types/settings';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes — recomanat per GCM
const AUTH_TAG_LENGTH = 16; // bytes

function getKey(): Buffer | null {
  const hex = process.env.CONFIG_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, 'hex');
}

/**
 * Xifra un string amb AES-256-GCM.
 * Retorna "iv:authTag:ciphertext" en hex, o el text pla si no hi ha clau.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // degraded: no xifrat

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
}

/**
 * Desxifra un string xifrat per `encrypt`.
 * Si el valor no té el format esperat (text pla legacy), el retorna directament.
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  if (!key) return ciphertext; // degraded: no xifrat

  const parts = ciphertext.split(':');
  if (parts.length !== 3) return ciphertext; // text pla legacy

  const [ivHex, authTagHex, dataHex] = parts;
  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(data) + decipher.final('utf8');
  } catch {
    // Si el desxifrat falla (clau incorrecta, dades corrompudes), retorna buit
    return '';
  }
}

/**
 * Xifra totes les .apiKey d'un Record de configs de proveïdors.
 * Funciona per a ProvidersConfig, ttsProvidersConfig, asrProvidersConfig, etc.
 * Retorna una còpia nova (no muta l'original).
 */
export function encryptProviderApiKeys<T extends Record<string, { apiKey?: string }>>(
  config: T,
): T {
  const result = {} as T;
  for (const [pid, cfg] of Object.entries(config)) {
    result[pid as keyof T] = {
      ...cfg,
      apiKey: cfg.apiKey ? encrypt(cfg.apiKey) : '',
    } as T[keyof T];
  }
  return result;
}

/**
 * Desxifra totes les .apiKey d'un Record de configs de proveïdors.
 * Funciona per a ProvidersConfig, ttsProvidersConfig, asrProvidersConfig, etc.
 * Retorna una còpia nova (no muta l'original).
 */
export function decryptProviderApiKeys<T extends Record<string, { apiKey?: string }>>(
  config: T,
): T {
  const result = {} as T;
  for (const [pid, cfg] of Object.entries(config)) {
    result[pid as keyof T] = {
      ...cfg,
      apiKey: cfg.apiKey ? decrypt(cfg.apiKey) : '',
    } as T[keyof T];
  }
  return result;
}

// Àlies per compatibilitat tipada amb ProvidersConfig
export { encryptProviderApiKeys as encryptProvidersConfig };
export { decryptProviderApiKeys as decryptProvidersConfig };
