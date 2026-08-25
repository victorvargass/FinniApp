import { useThemePreference } from '@/contexts/ThemeContext';

export function useColorScheme() {
  return useThemePreference().colorScheme;
}
