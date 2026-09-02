import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MovementReminderSettings } from '@/lib/types';

const CHANNEL = 'movement-reminders';
const KIND = 'movement-reminder';
export const MOVEMENT_REMINDER_URL = '/(tabs)/period' as const;

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
      name: 'Recordatorio de movimientos',
      description: 'Recordatorios para registrar gastos e ingresos',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: 'default',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return false;

  const base = {
    hour: settings.movementReminderHour,
    minute: settings.movementReminderMinute,
    channelId: CHANNEL,
  };
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Registra tus movimientos',
      body: '¿Olvidaste registrar tus gastos o ingresos de hoy?',
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
