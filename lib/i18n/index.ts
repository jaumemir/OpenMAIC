/**
 * Server-safe i18n utilities.
 *
 * This file must NOT import react-i18next or lib/i18n/config.ts because
 * react-i18next calls createContext() which is forbidden in Server Components.
 * Translation for server use is a plain JSON key lookup — no React needed.
 */

import ca from './locales/ca.json';
import enUS from './locales/en-US.json';
import zhCN from './locales/zh-CN.json';

export { type Locale, defaultLocale, VALID_LOCALES } from './locales';
export { type LocaleEntry, supportedLocales } from './locales';
export type TranslationKey = string;

const dictionaries: Record<string, Record<string, unknown>> = {
  ca: ca as Record<string, unknown>,
  'en-US': enUS as Record<string, unknown>,
  'zh-CN': zhCN as Record<string, unknown>,
};

/** Resolve a dot-separated key like "admin.table.user" in a nested object. */
function lookup(dict: Record<string, unknown>, key: string): string | undefined {
  const parts = key.split('.');
  let node: unknown = dict;
  for (const part of parts) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Translate a key for a given locale (server-safe, no React).
 * Supports {{var}} interpolation via the options object.
 */
export function translate(locale: string, key: string, options?: Record<string, string>): string {
  const dict = dictionaries[locale] ?? dictionaries['ca'];
  let value = lookup(dict, key) ?? lookup(dictionaries['ca'], key) ?? key;
  if (options) {
    for (const [k, v] of Object.entries(options)) {
      value = value.replaceAll(`{{${k}}}`, v);
    }
  }
  return value;
}
