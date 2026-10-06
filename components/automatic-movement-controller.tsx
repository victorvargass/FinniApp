import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { usePaymentDatabase, useRecurrenceDatabase } from '@/contexts/DatabaseDomainContexts';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findPendingRecurringMatches } from '@/lib/notification-recurrence-match';
import {
  claimNextPendingNotificationMovement,
  notificationMovementCaptureSupported,
  pendingMovementHref,
  removePendingNotificationMovement,
} from '@/lib/notification-movements';
import { showToast } from '@/lib/toast';

export function AutomaticMovementController({ enabled }: { enabled: boolean }) {
  const { recurringDecisions, approveRecurringOccurrence } = useRecurrenceDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const checkingRef = useRef(false);
  const alertVisibleRef = useRef(false);

  const check = useCallback(async () => {
    if (!enabled || !notificationMovementCaptureSupported || checkingRef.current || alertVisibleRef.current) return;
    checkingRef.current = true;
    try {
      const candidate = await claimNextPendingNotificationMovement();
      if (!candidate) return;
      const occurredAt = new Date(candidate.occurredAt);
      const recurringMatches = findPendingRecurringMatches(candidate, recurringDecisions);
      alertVisibleRef.current = true;
      const approveMatch = async (match: (typeof recurringMatches)[number]) => {
        try {
          await approveRecurringOccurrence(match.kind, match.recurringId, match.scheduledDate);
          await removePendingNotificationMovement(candidate.id);
          showToast(t('pendingMovements.recurringApproved', { name: match.name }));
        } catch (error) {
          Alert.alert(
            t('errors.couldNotSave'),
            error instanceof Error ? error.message : t('common.tryAgain')
          );
        }
      };
      const actions = recurringMatches.length === 1
        ? [
            { text: t('pendingMovements.later'), style: 'cancel' as const, onPress: () => { alertVisibleRef.current = false; } },
            {
              text: t('pendingMovements.registerSeparate'),
              onPress: () => {
                alertVisibleRef.current = false;
                router.push(pendingMovementHref(candidate, paymentMethods));
              },
            },
            {
              text: t('pendingMovements.approveRecurring', { name: recurringMatches[0].name }),
              onPress: () => {
                alertVisibleRef.current = false;
                void approveMatch(recurringMatches[0]);
              },
            },
          ]
        : recurringMatches.length > 1
          ? [
              { text: t('pendingMovements.later'), style: 'cancel' as const, onPress: () => { alertVisibleRef.current = false; } },
              {
                text: t('pendingMovements.chooseRecurring'),
                onPress: () => {
                  alertVisibleRef.current = false;
                  router.push('/modal/pending-movements' as never);
                },
              },
            ]
          : [
              { text: t('pendingMovements.later'), style: 'cancel' as const, onPress: () => { alertVisibleRef.current = false; } },
              {
                text: t('pendingMovements.register'),
                onPress: () => {
                  alertVisibleRef.current = false;
                  router.push(pendingMovementHref(candidate, paymentMethods));
                },
              },
            ];
      Alert.alert(
        t('pendingMovements.detectedTitle'),
        t('pendingMovements.detectedQuestion', {
          name: candidate.name,
          amount: formatCLP(candidate.amount),
          date: formatDate(occurredAt),
          time: formatTime(occurredAt),
        }),
        actions,
        { onDismiss: () => { alertVisibleRef.current = false; } }
      );
    } finally {
      checkingRef.current = false;
    }
  }, [approveRecurringOccurrence, enabled, paymentMethods, recurringDecisions]);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, 10_000);
    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [check]);

  return null;
}
