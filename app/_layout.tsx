import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BiometricGate } from '@/components/biometric-gate';
import { BiometricProvider } from '@/contexts/BiometricContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <BiometricProvider>
        <BiometricGate>
          <DatabaseProvider>
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal/income-form"
                  options={{ presentation: 'modal', title: 'Ingreso' }}
                />
                <Stack.Screen
                  name="modal/expense-form"
                  options={{ presentation: 'modal', title: 'Gasto' }}
                />
                <Stack.Screen
                  name="modal/category-form"
                  options={{ presentation: 'modal', title: 'Categoría' }}
                />
              </Stack>
              <StatusBar style="auto" />
            </ThemeProvider>
          </DatabaseProvider>
        </BiometricGate>
      </BiometricProvider>
    </GestureHandlerRootView>
  );
}
