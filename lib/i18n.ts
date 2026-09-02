import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';

import es from '@/locales/es';

export const DEFAULT_LANGUAGE = 'es';
export const APP_LOCALE = 'es-CL';

const i18n = new I18n({ es });

i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;

const deviceLanguage = getLocales()[0]?.languageCode;
i18n.locale = deviceLanguage === DEFAULT_LANGUAGE ? deviceLanguage : DEFAULT_LANGUAGE;

export function t(scope: string, options?: TranslateOptions): string {
  return i18n.t(scope, options);
}

export default i18n;
