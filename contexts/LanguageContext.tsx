import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import {
  getDeviceLanguage,
  setI18nLanguage,
  t,
  type AppLanguage,
} from '@/lib/i18n';

const LANGUAGE_PREFERENCE_KEY = '@finniapp/language-preference';

type LanguageContextValue = {
  isLanguageReady: boolean;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function isAppLanguage(value: string | null): value is AppLanguage {
  return value === 'es' || value === 'en';
}

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<AppLanguage>(getDeviceLanguage());
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(LANGUAGE_PREFERENCE_KEY)
      .then((storedLanguage) => {
        if (!mounted) return;
        const nextLanguage = isAppLanguage(storedLanguage)
          ? storedLanguage
          : getDeviceLanguage();
        setI18nLanguage(nextLanguage);
        setLanguageState(nextLanguage);
      })
      .catch(() => {
        // If the preference cannot be read, keep the device language.
      })
      .finally(() => {
        if (mounted) setIsLanguageReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = async (nextLanguage: AppLanguage) => {
    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_KEY, nextLanguage);
    setI18nLanguage(nextLanguage);
    setLanguageState(nextLanguage);
  };

  return (
    <LanguageContext.Provider value={{ isLanguageReady, language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) {
    throw new Error(t('errors.languageProvider'));
  }
  return value;
}
