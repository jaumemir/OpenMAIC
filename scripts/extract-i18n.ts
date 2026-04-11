import { translations } from '../lib/i18n/index';
import { writeFileSync, mkdirSync } from 'fs';

mkdirSync('lib/i18n/locales', { recursive: true });

for (const [locale, data] of Object.entries(translations)) {
  writeFileSync(
    `lib/i18n/locales/${locale}.json`,
    JSON.stringify(data, null, 2) + '\n',
  );
  console.log(`✓ lib/i18n/locales/${locale}.json`);
}
