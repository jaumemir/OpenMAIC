export type LocaleEntry = {
  code: string;
  label: string;
  shortLabel: string;
};

/**
 * Supported locales registry.
 * To add a language: create lib/i18n/locales/<code>.json and add an entry here.
 */
export const supportedLocales = [
  { code: 'zh-CN', label: '简体中文', shortLabel: 'CN' },
  { code: 'en-US', label: 'English', shortLabel: 'EN' },
  { code: 'ca', label: 'Català', shortLabel: 'CA' },
] as const satisfies readonly LocaleEntry[];

export type Locale = (typeof supportedLocales)[number]['code'];

export const defaultLocale: Locale = 'ca';

export const VALID_LOCALES: Locale[] = supportedLocales.map((l) => l.code) as Locale[];
