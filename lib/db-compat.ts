/**
 * Database compatibility utilities (patró miniLMSCat).
 *
 * Els camps JSON s'emmagatzemen com a String en ambdós schemas (SQLite i
 * PostgreSQL) per uniformitat i simplicitat. Aquests helpers encapsulen
 * la serialització/deserialització JSON per als camps: inputSummary, result,
 * details (AuditLog), value (AdminConfig).
 */

export const isSqlite = (process.env.DATABASE_URL ?? '').startsWith('file:');

export function toDbJson(value: unknown): string {
  return JSON.stringify(value);
}

export function fromDbJson<T = unknown>(value: string | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
