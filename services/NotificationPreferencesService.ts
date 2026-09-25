import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  cancelFinancialReminders,
  configureFinancialReminderChannel,
} from '@/services/FinancialReminderService';
import {
  cancelMovementReminder,
  configureMovementReminderChannel,
  NotificationPermissionError,
} from '@/services/MovementReminderService';
import {
  cancelRecurringNotifications,
  configureRecurringNotifications,
} from '@/services/RecurringNotificationService';

async function configureNotificationChannels(): Promise<void> {
  await Promise.all([
    configureMovementReminderChannel(),
    configureRecurringNotifications(),
    configureFinancialReminderChannel(),
  ]);
}

export async function ensurePushNotificationPermission(): Promise<void> {
  if (Platform.OS === 'web') throw new NotificationPermissionError(false);

  // Android 13 only shows its notification permission prompt after a channel exists.
  await configureNotificationChannels();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return;
  if (!current.canAskAgain) throw new NotificationPermissionError(false);

  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  if (!requested.granted) {
    throw new NotificationPermissionError(requested.canAskAgain);
  }
}

export async function cancelFinniNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Promise.all([
    cancelMovementReminder(),
    cancelRecurringNotifications(),
    cancelFinancialReminders(),
  ]);
}
