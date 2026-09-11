import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MovementReminderSettings } from '@/lib/types';
import { t } from '@/lib/i18n';

const CHANNEL = 'movement-reminders';
const KIND = 'movement-reminder';
export const MOVEMENT_REMINDER_URL = '/(tabs)/home' as const;

export class NotificationPermissionError extends Error {
  constructor(public readonly canAskAgain: boolean) {
    super(t('errors.notificationPermissionRequired'));
    this.name = 'NotificationPermissionError';
  }
}

async function cancelExisting() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.content.data?.kind === KIND)
    .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
}

export async function syncMovementReminder(settings: MovementReminderSettings): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await cancelExisting();
  if (!settings.movementReminderEnabled) return true;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: t('navigation.movementReminder'),
      description: t('notifications.movementReminderChannelDescription'),
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && !current.canAskAgain) {
    throw new NotificationPermissionError(false);
  }
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new NotificationPermissionError(permission.canAskAgain);

  const base = {
    hour: settings.movementReminderHour,
    minute: settings.movementReminderMinute,
    channelId: CHANNEL,
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: t('notifications.movementReminderTitle'),
      body: t('notifications.movementReminderBody'),
      sound: 'default',
      data: { kind: KIND, url: MOVEMENT_REMINDER_URL },
    },
    trigger: settings.movementReminderFrequency === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...base }
      : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: settings.movementReminderWeekday, ...base },
  });
  return true;
}

export function getMovementReminderUrl(
  response: Notifications.NotificationResponse
): typeof MOVEMENT_REMINDER_URL | null {
  const data = response.notification.request.content.data;
  return data?.kind === KIND && data.url === MOVEMENT_REMINDER_URL
    ? MOVEMENT_REMINDER_URL
    : null;
}
