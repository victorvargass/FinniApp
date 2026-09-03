import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { BiometricGate } from '@/components/biometric-gate';
import { RecurringNotificationController } from '@/components/recurring-notification-controller';
import { t } from '@/lib/i18n';
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
            <RecurringNotificationController />
            <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
              <Stack>
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
                  options={{ presentation: 'modal', title: t('manualDebts.debt') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-detail"
                  options={{ presentation: 'fullScreenModal', title: t('manualDebts.debtDetail') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-payment"
                  options={{ presentation: 'modal', title: t('manualDebts.payment') }}
                />
                <Stack.Screen
                  name="modal/manual-debt-balance"
                  options={{ presentation: 'modal', title: t('manualDebts.updateBalance') }}
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
                  name="modal/movement-reminder"
                  options={{ presentation: 'modal', title: t('navigation.movementReminder') }}
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
