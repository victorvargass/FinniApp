import { getLocales } from 'expo-localization';
import { I18n, type TranslateOptions } from 'i18n-js';

import en from '@/locales/en';
import es from '@/locales/es';

type LeafPaths<T> = {
  [Key in keyof T & string]: T[Key] extends string
    ? Key
    : T[Key] extends Record<string, unknown>
      ? `${Key}.${LeafPaths<T[Key]>}`
      : never;
}[keyof T & string];

export type TranslationKey = LeafPaths<typeof es>;

export type AppLanguage = 'es' | 'en';

export const DEFAULT_LANGUAGE: AppLanguage = 'es';
export let APP_LOCALE = 'es-CL';

const i18n = new I18n({ en, es });

i18n.defaultLocale = DEFAULT_LANGUAGE;
i18n.enableFallback = true;

export function getDeviceLanguage(): AppLanguage {
  return getLocales()[0]?.languageCode === 'en' ? 'en' : DEFAULT_LANGUAGE;
}

export function setI18nLanguage(language: AppLanguage) {
  i18n.locale = language;
  APP_LOCALE = language === 'en' ? 'en-US' : 'es-CL';
}

setI18nLanguage(getDeviceLanguage());

export function t(scope: TranslationKey, options?: TranslateOptions): string {
  return i18n.t(scope, options);
}

export default i18n;
