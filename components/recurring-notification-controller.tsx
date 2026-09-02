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
import { getMovementReminderUrl } from '@/services/MovementReminderService';

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
    recurringIncomes,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    markRecurringOccurrencePending,
  } = useDatabase();
  const handledResponse = useRef<string | null>(null);

  useEffect(() => {
    const handleResponse = async (response: Notifications.NotificationResponse) => {
      const responseKey = `${response.notification.request.identifier}:${response.actionIdentifier}`;
      const movementReminderUrl = getMovementReminderUrl(response);
      if (movementReminderUrl) {
        if (handledResponse.current === responseKey) return;
        handledResponse.current = responseKey;
        router.replace(movementReminderUrl);
        await Notifications.dismissNotificationAsync(response.notification.request.identifier)
          .catch(() => undefined);
        await Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
        return;
      }

      const data = getRecurringNotificationData(response);
      if (!data) return;
      if (handledResponse.current === responseKey) {
        await Notifications.dismissNotificationAsync(response.notification.request.identifier)
          .catch(() => undefined);
        return;
      }
      handledResponse.current = responseKey;

      try {
        await markRecurringOccurrencePending(data.kind, data.recurringId, data.scheduledDate);
        const recurring = (data.kind === 'expense' ? recurringExpenses : recurringIncomes).find(
          (item) => item.id === data.recurringId
        );
        const noun = data.kind === 'expense' ? 'gasto' : 'ingreso';
        const description = recurring
          ? `${recurring.name} por ${formatCLP(recurring.amount)}`
          : `el ${noun} recurrente programado`;

        const confirmMovement = async () => {
          try {
            await approveRecurringOccurrence(data.kind, data.recurringId, data.scheduledDate);
            showResult(`${noun === 'gasto' ? 'Gasto' : 'Ingreso'} recurrente creado`);
            router.replace(data.kind === 'expense' ? '/(tabs)/expenses' : '/(tabs)/incomes');
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Inténtalo nuevamente.';
            Alert.alert(
              `No se pudo crear el ${noun}`,
              `${message}\n\nLa ejecución seguirá pendiente para que puedas intentarlo nuevamente.`,
              [
                {
                  text: 'Ver pendientes',
                  onPress: () => router.push('/modal/recurring-confirmations'),
                },
                {
                  text: 'Reintentar',
                  onPress: () => void confirmMovement(),
                },
              ]
            );
          }
        };

        const omitMovement = async () => {
          try {
            await skipRecurringOccurrence(data.kind, data.recurringId, data.scheduledDate);
            showResult('Omitido. Puedes reintentarlo desde Notificaciones');
          } catch (error) {
            Alert.alert(
              'No se pudo omitir',
              error instanceof Error ? error.message : 'Inténtalo nuevamente.'
            );
          }
        };

        Alert.alert(
          `Registrar ${noun} recurrente`,
          `FinniApp quiere registrar ${description}.`,
          [
            {
              text: 'Omitir',
              style: 'destructive',
              onPress: () => void omitMovement(),
            },
            {
              text: 'Confirmar',
              onPress: () => void confirmMovement(),
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
    recurringIncomes,
    skipRecurringOccurrence,
  ]);

  return null;
}
