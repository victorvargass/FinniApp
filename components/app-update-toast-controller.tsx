import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

import { checkPublishedUpdate, getActiveUpdate } from '@/lib/app-update-info';
import { t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { shouldShowCurrentUpdateToast } from '@/lib/update-toast';

const LAST_CONFIRMED_UPDATE_KEY = '@finniapp/last-confirmed-current-update-v1';

let currentUpdateConfirmation: Promise<boolean> | null = null;

async function confirmCurrentUpdateOnce(): Promise<boolean> {
  const activeUpdateId = getActiveUpdate().id;
  if (!activeUpdateId) return false;

  const lastConfirmedUpdateId = await AsyncStorage.getItem(LAST_CONFIRMED_UPDATE_KEY);
  if (lastConfirmedUpdateId === activeUpdateId) return false;

  const status = await checkPublishedUpdate();
  if (!shouldShowCurrentUpdateToast({ activeUpdateId, lastConfirmedUpdateId, status })) {
    return false;
  }

  // Persist before displaying so React development effects or fast remounts
  // cannot announce the same installed update twice.
  await AsyncStorage.setItem(LAST_CONFIRMED_UPDATE_KEY, activeUpdateId);
  return true;
}

function sharedCurrentUpdateConfirmation(): Promise<boolean> {
  if (!currentUpdateConfirmation) {
    currentUpdateConfirmation = confirmCurrentUpdateOnce().catch((error) => {
      currentUpdateConfirmation = null;
      throw error;
    });
  }
  return currentUpdateConfirmation;
}

export function AppUpdateToastController({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled) return;
    let mounted = true;

    sharedCurrentUpdateConfirmation()
      .then((shouldShow) => {
        if (mounted && shouldShow) showToast(t('settings.appUpdatedToast'));
      })
      .catch((error) => {
        logAppError('updates.currentToast', error);
      });

    return () => {
      mounted = false;
    };
  }, [enabled]);

  return null;
}
