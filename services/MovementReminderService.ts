import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { MovementReminderSettings } from '@/lib/types';

const CHANNEL = 'movement-reminders';
const KIND = 'movement-reminder';

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
      data: { kind: KIND },
    },
    trigger: settings.movementReminderFrequency === 'daily'
      ? { type: Notifications.SchedulableTriggerInputTypes.DAILY, ...base }
      : { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: settings.movementReminderWeekday, ...base },
  });
  return true;
}
