import { router } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import {
  claimNextPendingNotificationMovement,
  notificationMovementCaptureSupported,
  pendingMovementHref,
} from '@/lib/notification-movements';

export function AutomaticMovementController({ enabled }: { enabled: boolean }) {
  const checkingRef = useRef(false);
  const alertVisibleRef = useRef(false);

  const check = useCallback(async () => {
    if (!enabled || !notificationMovementCaptureSupported || checkingRef.current || alertVisibleRef.current) return;
    checkingRef.current = true;
    try {
      const candidate = await claimNextPendingNotificationMovement();
      if (!candidate) return;
      const occurredAt = new Date(candidate.occurredAt);
      alertVisibleRef.current = true;
      Alert.alert(
        t('pendingMovements.detectedTitle'),
        t('pendingMovements.detectedQuestion', {
          name: candidate.name,
          amount: formatCLP(candidate.amount),
          date: formatDate(occurredAt),
          time: formatTime(occurredAt),
        }),
        [
          { text: t('pendingMovements.later'), style: 'cancel', onPress: () => { alertVisibleRef.current = false; } },
          {
            text: t('pendingMovements.register'),
            onPress: () => {
              alertVisibleRef.current = false;
              router.push(pendingMovementHref(candidate));
            },
          },
        ],
        { onDismiss: () => { alertVisibleRef.current = false; } }
      );
    } finally {
      checkingRef.current = false;
    }
  }, [enabled]);

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
