import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';

import { getActiveUpdate, getInstalledVersion } from '@/lib/app-update-info';
import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { checkStoreUpdate } from '@/lib/store-update';
import { showToast } from '@/lib/toast';
import { shouldShowCurrentUpdateToast } from '@/lib/update-toast';

const LAST_ACTIVE_UPDATE_KEY = '@finniapp/last-active-update-v2';
const LEGACY_LAST_CONFIRMED_UPDATE_KEY = '@finniapp/last-confirmed-current-update-v1';

let currentUpdateConfirmation: Promise<boolean> | null = null;
let storeUpdateCheck: Promise<void> | null = null;

async function confirmCurrentUpdateOnce(): Promise<boolean> {
  const activeUpdateId = getActiveUpdate().id;
  if (!activeUpdateId) return false;

  const storedActiveUpdateId = await AsyncStorage.getItem(LAST_ACTIVE_UPDATE_KEY);
  const previousActiveUpdateId = storedActiveUpdateId
    ?? await AsyncStorage.getItem(LEGACY_LAST_CONFIRMED_UPDATE_KEY);

  // Record what is really executing. A downloaded update is not considered
  // installed until Expo launches with its new updateId.
  await AsyncStorage.setItem(LAST_ACTIVE_UPDATE_KEY, activeUpdateId);
  return shouldShowCurrentUpdateToast({ activeUpdateId, previousActiveUpdateId });
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

async function openStore(storeUrl: string) {
  await Linking.openURL(storeUrl);
}

async function checkStoreUpdateOnce() {
  const status = await checkStoreUpdate(getInstalledVersion());
  if (status.kind === 'current' || status.kind === 'unavailable') return;

  const buttons = status.required
    ? [{
        text: t('settings.storeUpdateAction'),
        onPress: () => { void openStore(status.storeUrl); },
      }]
    : [
        { text: t('common.later'), style: 'cancel' as const },
        {
          text: t('settings.storeUpdateAction'),
          onPress: () => { void openStore(status.storeUrl); },
        },
      ];

  Alert.alert(
    t('settings.storeUpdateTitle'),
    t(status.required ? 'settings.storeUpdateRequiredBody' : 'settings.storeUpdateBody', {
      version: status.latestVersion,
    }),
    buttons,
    { cancelable: !status.required }
  );
}

export function AppUpdateToastController({ enabled }: { enabled: boolean }) {
  const { downloadedUpdate, isUpdatePending } = Updates.useUpdates();
  const promptedPendingUpdate = useRef<string | null>(null);

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

  useEffect(() => {
    if (!enabled || !isUpdatePending) return;
    const pendingUpdateId = downloadedUpdate?.updateId ?? 'pending-update';
    if (promptedPendingUpdate.current === pendingUpdateId) return;
    promptedPendingUpdate.current = pendingUpdateId;

    Alert.alert(
      t('settings.otaPendingTitle'),
      t('settings.otaPendingBody'),
      [
        { text: t('common.later'), style: 'cancel' },
        {
          text: t('settings.otaRestartAction'),
          onPress: () => {
            void Updates.reloadAsync().catch((error) => {
              promptedPendingUpdate.current = null;
              logAppError('updates.reload', error);
            });
          },
        },
      ]
    );
  }, [downloadedUpdate?.updateId, enabled, isUpdatePending]);

  useEffect(() => {
    if (!enabled) return;
    if (!storeUpdateCheck) {
      storeUpdateCheck = checkStoreUpdateOnce().catch((error) => {
        storeUpdateCheck = null;
        logAppError('updates.storeCheck', error);
      });
    }
  }, [enabled]);

  return null;
}
