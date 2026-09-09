import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  Quicksand_400Regular,
  Quicksand_500Medium,
  Quicksand_600SemiBold,
  Quicksand_700Bold,
  useFonts,
} from '@expo-google-fonts/quicksand';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BiometricGate } from '@/components/biometric-gate';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { RecurringNotificationController } from '@/components/recurring-notification-controller';
import { t } from '@/lib/i18n';
import { BiometricProvider } from '@/contexts/BiometricContext';
import { DatabaseProvider } from '@/contexts/DatabaseContext';
import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { OnboardingProvider, useOnboarding } from '@/contexts/OnboardingContext';
import { ThemePreferenceProvider } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors, Fonts } from '@/constants/theme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppContent() {
  const colorScheme = useColorScheme();
  const { isLanguageReady, language } = useLanguage();
  const { hasCompletedOnboarding, isOnboardingReady } = useOnboarding();
  const palette = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...baseTheme,
    colors: {
      ...baseTheme.colors,
      primary: palette.action,
      background: palette.screen,
      card: palette.surfaceRaised,
      text: palette.text,
      border: palette.border,
      notification: palette.expense,
    },
    fonts: {
      regular: { fontFamily: Fonts.regular, fontWeight: '400' as const },
      medium: { fontFamily: Fonts.medium, fontWeight: '500' as const },
      bold: { fontFamily: Fonts.bold, fontWeight: '700' as const },
      heavy: { fontFamily: Fonts.bold, fontWeight: '700' as const },
    },
  };

  if (!isLanguageReady || !isOnboardingReady) return <AppLoadingScreen />;

  return (
    <GestureHandlerRootView key={language} style={{ flex: 1 }}>
      <BiometricProvider>
        <BiometricGate>
          <DatabaseProvider>
            <RecurringNotificationController />
            <ThemeProvider value={navigationTheme}>
              <Stack>
                <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
                <Stack.Protected guard={hasCompletedOnboarding}>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen
                  name="modal/income-form"
                  options={{ presentation: 'modal', title: t('navigation.income') }}
                />
                <Stack.Screen
                  name="modal/expense-form"
                  options={{ presentation: 'modal', title: t('navigation.expense') }}
                />
                <Stack.Screen
                  name="modal/category-form"
                  options={{ presentation: 'modal', title: t('navigation.category') }}
                />
                <Stack.Screen
                  name="modal/categories"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.categories') }}
                />
                <Stack.Screen
                  name="modal/payment-methods"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.paymentMethods') }}
                />
                <Stack.Screen
                  name="modal/payment-method-form"
                  options={{ presentation: 'modal', title: t('navigation.paymentMethod') }}
                />
                <Stack.Screen
                  name="modal/card-cycles"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.reconciliation') }}
                />
                <Stack.Screen
                  name="modal/recurring-expenses"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.recurringMovements') }}
                />
                <Stack.Screen
                  name="modal/recurring-confirmations"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.notifications') }}
                />
                <Stack.Screen
                  name="modal/recurring-expense-form"
                  options={{ presentation: 'modal', title: t('navigation.recurringExpense') }}
                />
                <Stack.Screen
                  name="modal/recurring-income-form"
                  options={{ presentation: 'modal', title: t('navigation.recurringIncome') }}
                />
                <Stack.Screen
                  name="modal/debts"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.debts') }}
                />
                <Stack.Screen
                  name="modal/debt-detail"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.installmentDetail') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-form"
                  options={{ presentation: 'modal', title: t('debts.debt') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-detail"
                  options={{ presentation: 'fullScreenModal', title: t('debts.debtDetail') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-payment"
                  options={{ presentation: 'modal', title: t('debts.payment') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-balance"
                  options={{ presentation: 'modal', title: t('debts.updateBalance') }}
                />
                <Stack.Screen
                  name="modal/savings-goals"
                  options={{ presentation: 'fullScreenModal', title: t('savings.title') }}
                />
                <Stack.Screen
                  name="modal/savings-goal-form"
                  options={{ presentation: 'modal', title: t('savings.goal') }}
                />
                <Stack.Screen
                  name="modal/savings-goal-balance"
                  options={{ presentation: 'modal', title: t('savings.updateBalance') }}
                />
                <Stack.Screen
                  name="modal/movement-reminder"
                  options={{ presentation: 'modal', title: t('navigation.movementReminder') }}
                />
                <Stack.Screen
                  name="modal/google-drive"
                  options={{ presentation: 'fullScreenModal', title: t('navigation.googleDrive') }}
                />
                <Stack.Screen
                  name="modal/privacy"
                  options={{ presentation: 'fullScreenModal', title: t('privacy.title') }}
                />
                </Stack.Protected>
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
  const [fontsLoaded, fontError] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  return (
    <LanguageProvider>
      <ThemePreferenceProvider>
        <OnboardingProvider>
          {!fontsLoaded && !fontError ? <AppLoadingScreen /> : <AppContent />}
        </OnboardingProvider>
      </ThemePreferenceProvider>
    </LanguageProvider>
  );
}
