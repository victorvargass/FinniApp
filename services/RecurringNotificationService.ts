import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatCLP } from '@/lib/format';
import { parseIsoDate } from '@/lib/recurrence';
import type {
  GeneratedRecurringExpenseNotification,
  RecurringConfirmationSchedule,
} from '@/lib/types';

const RECURRING_CHANNEL = 'recurring-expenses';
const DATA_KIND = 'recurring-expense';
const LEGACY_CATEGORIES = [
  'recurring-expense-confirmation',
  'recurring_expense_confirmation',
];

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configureRecurringNotifications(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(RECURRING_CHANNEL, {
      name: 'Gastos recurrentes',
      description: 'Avisos de gastos programados',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }
  await Promise.all(
    LEGACY_CATEGORIES.map((identifier) =>
      Notifications.deleteNotificationCategoryAsync(identifier).catch(() => false)
    )
  );
}

export async function ensureRecurringNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await configureRecurringNotifications();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return requested.granted;
}

export async function notifyGeneratedRecurringExpenses(
  expenses: GeneratedRecurringExpenseNotification[]
): Promise<void> {
  if (Platform.OS === 'web' || expenses.length === 0) return;
  await configureRecurringNotifications();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  for (const expense of expenses) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gasto recurrente registrado',
        body: `${expense.name} por ${formatCLP(expense.amount)} fue agregado automáticamente.`,
        sound: 'default',
        data: {
          kind: 'recurring-expense-generated',
          recurringExpenseId: expense.recurringExpenseId,
          scheduledDate: expense.scheduledDate,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 1,
        channelId: RECURRING_CHANNEL,
      },
    });
  }
}

function notificationDate(scheduledDate: string): Date {
  const date = parseIsoDate(scheduledDate);
  date.setHours(9, 0, 0, 0);
  if (date.getTime() <= Date.now()) return new Date(Date.now() + 3000);
  return date;
}

async function cancelOurScheduledNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => item.content.data?.kind === DATA_KIND)
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
}

export async function syncRecurringNotifications(
  schedules: RecurringConfirmationSchedule[]
): Promise<void> {
  if (Platform.OS === 'web') return;
  await configureRecurringNotifications();
  await cancelOurScheduledNotifications();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const limited = [...schedules]
    .sort((first, second) => first.scheduledDate.localeCompare(second.scheduledDate))
    .slice(0, 50);
  for (const schedule of limited) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'FinniApp quiere registrar un gasto recurrente',
        body: `${schedule.name} · ${formatCLP(schedule.amount)}. Toca para revisarlo.`,
        sound: 'default',
        data: {
          kind: DATA_KIND,
          recurringExpenseId: schedule.recurringExpenseId,
          scheduledDate: schedule.scheduledDate,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: notificationDate(schedule.scheduledDate),
        channelId: RECURRING_CHANNEL,
      },
    });
  }
}

export function getRecurringNotificationData(response: Notifications.NotificationResponse): {
  recurringExpenseId: number;
  scheduledDate: string;
} | null {
  const data = response.notification.request.content.data;
  const recurringExpenseId = Number(data?.recurringExpenseId);
  const scheduledDate = typeof data?.scheduledDate === 'string' ? data.scheduledDate : null;
  if (data?.kind !== DATA_KIND || !Number.isInteger(recurringExpenseId) || !scheduledDate) return null;
  return { recurringExpenseId, scheduledDate };
}
