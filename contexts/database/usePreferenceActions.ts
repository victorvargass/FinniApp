import { useCallback, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';

import * as db from '@/repositories';
import { t } from '@/lib/i18n';
import type { HomePreferences } from '@/lib/home-preferences';
import type { AppNotification, MovementReminderSettings, Settings } from '@/lib/types';
import { syncMovementReminder } from '@/services/MovementReminderService';
import {
  cancelFinniNotifications,
  ensurePushNotificationPermission,
} from '@/services/NotificationPreferencesService';

type Refresh = () => Promise<void>;

export function usePreferenceActions(
  settings: Settings,
  setAppNotifications: Dispatch<SetStateAction<AppNotification[]>>,
  refresh: Refresh
) {
  const setMovementReminder = useCallback(async (data: MovementReminderSettings) => {
    let notificationsEnabled = settings.pushNotificationsEnabled;
    if (data.movementReminderEnabled && !notificationsEnabled) {
      await ensurePushNotificationPermission();
      await db.updatePushNotificationsEnabled(true);
      notificationsEnabled = true;
    }
    const scheduled = await syncMovementReminder(data, notificationsEnabled);
    if (data.movementReminderEnabled && !scheduled) {
      throw new Error(t('errors.notificationPermissionRequired'));
    }
    await db.updateMovementReminderSettings(data);
    await refresh();
  }, [refresh, settings.pushNotificationsEnabled]);

  const setPushNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) await ensurePushNotificationPermission();
    await db.updatePushNotificationsEnabled(enabled);
    if (!enabled) await cancelFinniNotifications();
    await refresh();
  }, [refresh]);

  const setHomePreferences = useCallback(async (data: HomePreferences) => {
    await db.updateHomePreferences(data);
    await refresh();
  }, [refresh]);

  const reloadNotifications = useCallback(async () => {
    setAppNotifications(await db.getAppNotifications());
  }, [setAppNotifications]);

  const setAppNotificationRead = useCallback(async (id: number, read: boolean) => {
    await db.setAppNotificationRead(id, read);
    await reloadNotifications();
  }, [reloadNotifications]);

  const markAppNotificationReadBySourceKey = useCallback(async (sourceKey: string) => {
    await db.markAppNotificationReadBySourceKey(sourceKey);
    await reloadNotifications();
  }, [reloadNotifications]);

  const deleteAppNotification = useCallback(async (id: number) => {
    await db.deleteAppNotification(id);
    await reloadNotifications();
  }, [reloadNotifications]);

  const deleteAppNotifications = useCallback(async (ids: number[]) => {
    await db.deleteAppNotifications(ids);
    await reloadNotifications();
  }, [reloadNotifications]);

  const resetLocalData = useCallback(async () => {
    await db.resetLocalData();
    await cancelFinniNotifications().catch(() => undefined);
    await refresh();
  }, [refresh]);

  return useMemo(() => ({
    setMovementReminder,
    setPushNotificationsEnabled,
    setHomePreferences,
    setAppNotificationRead,
    markAppNotificationReadBySourceKey,
    deleteAppNotification,
    deleteAppNotifications,
    resetLocalData,
  }), [
    deleteAppNotification,
    deleteAppNotifications,
    markAppNotificationReadBySourceKey,
    resetLocalData,
    setAppNotificationRead,
    setHomePreferences,
    setMovementReminder,
    setPushNotificationsEnabled,
  ]);
}
