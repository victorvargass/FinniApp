import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MovementReminderSettings } from '@/lib/types';
import { t } from '@/lib/i18n';
import { replaceFutureAppNotifications } from '@/repositories/notifications';

const CHANNEL = 'movement-reminders';
const KIND = 'movement-reminder';
export const MOVEMENT_REMINDER_URL = '/(tabs)/home' as const;

export class NotificationPermissionError extends Error {
  constructor(public readonly canAskAgain: boolean) {
    super(t('errors.notificationPermissionRequired'));
    this.name = 'NotificationPermissionError';
  }
}

export async function cancelMovementReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(scheduled
    .filter((item) => item.content.data?.kind === KIND)
    .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)));
  await replaceFutureAppNotifications([KIND], []);
}

function nextReminderDate(settings: MovementReminderSettings, now = new Date()): Date {
  const candidate = new Date(now);
  candidate.setHours(settings.movementReminderHour, settings.movementReminderMinute, 0, 0);
  if (settings.movementReminderFrequency === 'daily') {
    if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 1);
    return candidate;
  }
  const targetWeekday = settings.movementReminderWeekday - 1;
  const daysAhead = (targetWeekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + daysAhead);
  if (candidate.getTime() <= now.getTime()) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

export async function configureMovementReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('navigation.movementReminder'),
    description: t('notifications.movementReminderChannelDescription'),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function syncMovementReminder(
  settings: MovementReminderSettings,
  notificationsEnabled = true,
  requestPermission = true
): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await cancelMovementReminder();
  if (!notificationsEnabled || !settings.movementReminderEnabled) return true;

  await configureMovementReminderChannel();
  const current = await Notifications.getPermissionsAsync();
  if (!current.granted && !requestPermission) return false;
  if (!current.granted && !current.canAskAgain) {
    throw new NotificationPermissionError(false);
  }
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new NotificationPermissionError(permission.canAskAgain);

  const nextDate = nextReminderDate(settings);
  const inboxKey = `${KIND}:${nextDate.toISOString().slice(0, 10)}`;
  await replaceFutureAppNotifications([KIND], [{
    sourceKey: inboxKey,
    kind: KIND,
    title: t('notifications.movementReminderTitle'),
    body: t('notifications.movementReminderBody'),
    scheduledFor: nextDate.getTime(),
    actionUrl: MOVEMENT_REMINDER_URL,
    recurringKind: null,
    recurringId: null,
    recurringDate: null,
  }]);

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
      data: { kind: KIND, url: MOVEMENT_REMINDER_URL, inboxKey },
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
