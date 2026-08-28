import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BiometricGate } from '@/components/biometric-gate';
import { BiometricProvider } from '@/contexts/BiometricContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { ThemePreferenceProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
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
                <Stack.Screen
                  name="modal/categories"
                  options={{ presentation: 'fullScreenModal', title: 'Categorías' }}
                />
                <Stack.Screen
                  name="modal/payment-methods"
                  options={{ presentation: 'fullScreenModal', title: 'Medios de pago' }}
                />
                <Stack.Screen
                  name="modal/payment-method-form"
                  options={{ presentation: 'modal', title: 'Medio de pago' }}
                />
                <Stack.Screen
                  name="modal/card-cycles"
                  options={{ presentation: 'fullScreenModal', title: 'Conciliación' }}
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

export default function RootLayout() {
  return (
    <ThemePreferenceProvider>
      <AppContent />
    </ThemePreferenceProvider>
  );
}
