import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useDatabase } from '@/contexts/DatabaseContext';
import { Alert } from '@/lib/alert';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import {
  configureRecurringNotifications,
  getRecurringNotificationData,
} from '@/services/RecurringNotificationService';
import { getMovementReminderUrl } from '@/services/MovementReminderService';

function showResult(message: string) {
  showToast(message);
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
        const noun = data.kind === 'expense' ? t('navigation.expense').toLocaleLowerCase() : t('navigation.income').toLocaleLowerCase();
        const description = recurring
          ? t('notifications.scheduledDescription', { name: recurring.name, amount: formatCLP(recurring.amount) })
          : t('notifications.fallbackDescription', { movement: noun });

        const confirmMovement = async () => {
          try {
            await approveRecurringOccurrence(data.kind, data.recurringId, data.scheduledDate);
            showResult(t(data.kind === 'expense' ? 'notifications.resultExpense' : 'notifications.resultIncome'));
            router.replace({
              pathname: '/(tabs)/movements',
              params: { movementType: data.kind === 'expense' ? 'expenses' : 'incomes' },
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : t('common.tryAgain');
            Alert.alert(
              t('notifications.createFailed', { movement: noun }),
              t('notifications.remainsPending', { message }),
              [
                {
                  text: t('notifications.viewPending'),
                  onPress: () => router.push('/modal/recurring-confirmations'),
                },
                {
                  text: t('common.retry'),
                  onPress: () => void confirmMovement(),
                },
              ]
            );
          }
        };

        const omitMovement = async () => {
          try {
            await skipRecurringOccurrence(data.kind, data.recurringId, data.scheduledDate);
            showResult(t('notifications.omitted'));
          } catch (error) {
            Alert.alert(
              t('notifications.omitFailed'),
              error instanceof Error ? error.message : t('common.tryAgain')
            );
          }
        };

        Alert.alert(
          t('notifications.registerRecurring', { movement: noun }),
          t('notifications.wantsToRegister', { description }),
          [
            {
              text: t('common.skip'),
              style: 'destructive',
              onPress: () => void omitMovement(),
            },
            {
              text: t('common.confirm'),
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
          t('errors.couldNotComplete'),
          error instanceof Error ? error.message : t('common.tryAgain')
        );
      });
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) return handleResponse(response);
      })
      .catch((error) => {
        Alert.alert(
          t('errors.couldNotComplete'),
          error instanceof Error ? error.message : t('common.tryAgain')
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
