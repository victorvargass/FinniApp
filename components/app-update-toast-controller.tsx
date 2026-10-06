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
import { parseSeenActiveUpdateIds, resolveCurrentUpdateToastState } from '@/lib/update-toast';

const LAST_ACTIVE_UPDATE_KEY = '@finniapp/last-active-update-v2';
const LEGACY_LAST_CONFIRMED_UPDATE_KEY = '@finniapp/last-confirmed-current-update-v1';
const SEEN_ACTIVE_UPDATES_KEY = '@finniapp/seen-active-updates-v1';

let currentUpdateConfirmation: Promise<boolean> | null = null;
let storeUpdateCheck: Promise<void> | null = null;
const confirmedUpdatesInSession = new Set<string>();

async function confirmCurrentUpdateOnce(): Promise<boolean> {
  const activeUpdateId = getActiveUpdate().id;
  if (!activeUpdateId) return false;
  if (confirmedUpdatesInSession.has(activeUpdateId)) return false;

  const [storedSeenUpdates, storedActiveUpdateId, legacyActiveUpdateId] = await Promise.all([
    AsyncStorage.getItem(SEEN_ACTIVE_UPDATES_KEY),
    AsyncStorage.getItem(LAST_ACTIVE_UPDATE_KEY),
    AsyncStorage.getItem(LEGACY_LAST_CONFIRMED_UPDATE_KEY),
  ]);
  const seenActiveUpdateIds = parseSeenActiveUpdateIds(storedSeenUpdates);
  const previousActiveUpdateId = storedActiveUpdateId ?? legacyActiveUpdateId;
  if (previousActiveUpdateId && !seenActiveUpdateIds.includes(previousActiveUpdateId)) {
    seenActiveUpdateIds.push(previousActiveUpdateId);
  }
  const state = resolveCurrentUpdateToastState({ activeUpdateId, seenActiveUpdateIds });

  // Record what is really executing. A downloaded update is not considered
  // installed until Expo launches with its new updateId. Keeping a bounded
  // history also avoids announcing the same update again after a rollback.
  await AsyncStorage.multiSet([
    [LAST_ACTIVE_UPDATE_KEY, activeUpdateId],
    [SEEN_ACTIVE_UPDATES_KEY, JSON.stringify(state.seenActiveUpdateIds)],
  ]);
  confirmedUpdatesInSession.add(activeUpdateId);
  return state.shouldShow;
}

function sharedCurrentUpdateConfirmation(): Promise<boolean> {
  if (!currentUpdateConfirmation) {
    const confirmation = confirmCurrentUpdateOnce();
    currentUpdateConfirmation = confirmation;
    void confirmation.finally(() => {
      if (currentUpdateConfirmation === confirmation) currentUpdateConfirmation = null;
    }).catch(() => undefined);
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
