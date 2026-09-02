import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';
import { ColorSchemeName, useColorScheme as useSystemColorScheme } from 'react-native';
import { t } from '@/lib/i18n';

const THEME_PREFERENCE_KEY = '@finniapp/theme-preference';

export type ThemePreference = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colorScheme: 'light' | 'dark';
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const systemColorScheme: ColorSchemeName = useSystemColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((storedPreference) => {
        if (mounted && isThemePreference(storedPreference)) {
          setPreferenceState(storedPreference);
        }
      })
      .catch(() => {
        // Si no se puede leer la preferencia, se mantiene el tema del sistema.
      });

    return () => {
      mounted = false;
    };
  }, []);

  const setPreference = async (nextPreference: ThemePreference) => {
    await AsyncStorage.setItem(THEME_PREFERENCE_KEY, nextPreference);
    setPreferenceState(nextPreference);
  };

  const colorScheme =
    preference === 'system' ? (systemColorScheme ?? 'light') : preference;

  return (
    <ThemeContext.Provider value={{ colorScheme, preference, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemePreference() {
  const value = useContext(ThemeContext);
  if (!value) {
    throw new Error(t('errors.themeProvider'));
  }
  return value;
}
