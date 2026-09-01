import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, ToastAndroid } from 'react-native';

import { useDatabase } from '@/contexts/DatabaseContext';
import { Alert } from '@/lib/alert';
import { formatCLP } from '@/lib/format';
import {
  configureRecurringNotifications,
  getRecurringNotificationData,
} from '@/services/RecurringNotificationService';

function showResult(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('Listo', message);
  }
}

export function RecurringNotificationController() {
  const {
    recurringExpenses,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    markRecurringOccurrencePending,
  } = useDatabase();
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const data = getRecurringNotificationData(response);
      if (!data) return;
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      if (handledResponse.current === responseKey) {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier)
          .catch(() => undefined);
        return;
      }
      handledResponse.current = responseKey;

      try {
        await markRecurringOccurrencePending(data.recurringExpenseId, data.scheduledDate);
        const recurring = recurringExpenses.find(
          (item) => item.id === data.recurringExpenseId
        );
        const description = recurring
          ? `${recurring.name} por ${formatCLP(recurring.amount)}`
          : 'el gasto recurrente programado';

        const confirmExpense = async () => {
          try {
            await approveRecurringOccurrence(data.recurringExpenseId, data.scheduledDate);
            showResult('Gasto recurrente creado');
            router.replace('/(tabs)/expenses');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Inténtalo nuevamente.';
            Alert.alert(
              'No se pudo crear el gasto',
              `${message}\n\nLa ejecución seguirá pendiente para que puedas intentarlo nuevamente.`,
              [
                {
                  text: 'Ver pendientes',
                  onPress: () => router.push('/modal/recurring-confirmations'),
                },
                {
                  text: 'Reintentar',
                  onPress: () => void confirmExpense(),
                },
              ]
            );
          }
        };

        const omitExpense = async () => {
          try {
            await skipRecurringOccurrence(data.recurringExpenseId, data.scheduledDate);
            showResult('Omitido. Puedes reintentarlo desde Notificaciones');
          } catch (error) {
            Alert.alert(
              'No se pudo omitir',
              error instanceof Error ? error.message : 'Inténtalo nuevamente.'
            );
          }
        };

        Alert.alert(
          'Registrar gasto recurrente',
          `FinniApp quiere registrar ${description}.`,
          [
            {
              text: 'Omitir',
              style: 'destructive',
              onPress: () => void omitExpense(),
            },
            {
              text: 'Confirmar',
              onPress: () => void confirmExpense(),
            },
          ]
        );
      } finally {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier)
          .catch(() => undefined);
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
      }
    };

    configureRecurringNotifications().catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleResponse(response).catch((error) => {
        Alert.alert(
          'No se pudo completar',
          error instanceof Error ? error.message : 'Inténtalo nuevamente.'
        );
      });
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) return handleResponse(response);
      })
      .catch((error) => {
        Alert.alert(
          'No se pudo completar',
          error instanceof Error ? error.message : 'Inténtalo nuevamente.'
        );
      });
    return () => subscription.remove();
  }, [
    approveRecurringOccurrence,
    markRecurringOccurrencePending,
    recurringExpenses,
    skipRecurringOccurrence,
  ]);

  return null;
}
