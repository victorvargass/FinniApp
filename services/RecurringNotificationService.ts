import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import { parseIsoDate } from '@/lib/recurrence';
import type {
  GeneratedRecurringExpenseNotification,
  RecurringConfirmationSchedule,
} from '@/lib/types';

const RECURRING_CHANNEL = 'recurring-expenses';
const DATA_KINDS = ['recurring-expense', 'recurring-income'] as const;
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
      name: t('navigation.recurringMovements'),
      description: t('notifications.recurringChannelDescription'),
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
        title: t('notifications.recurringExpenseRegistered'),
        body: t('notifications.generatedExpenseBody', {
          name: expense.name,
          amount: formatCLP(expense.amount),
        }),
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
      .filter((item) => DATA_KINDS.includes(item.content.data?.kind as typeof DATA_KINDS[number]))
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
    const noun = schedule.kind === 'expense' ? t('navigation.expense').toLowerCase() : t('navigation.income').toLowerCase();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('notifications.recurringReviewTitle', { movement: noun }),
        body: t('notifications.recurringReviewBody', {
          name: schedule.name,
          amount: formatCLP(schedule.amount),
        }),
        sound: 'default',
        data: {
          kind: `recurring-${schedule.kind}`,
          recurringId: schedule.recurringId,
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
  kind: 'expense' | 'income';
  recurringId: number;
  scheduledDate: string;
} | null {
  const data = response.notification.request.content.data;
  const kind = data?.kind === 'recurring-expense'
    ? 'expense'
    : data?.kind === 'recurring-income' ? 'income' : null;
  const recurringId = Number(data?.recurringId ?? data?.recurringExpenseId);
  const scheduledDate = typeof data?.scheduledDate === 'string' ? data.scheduledDate : null;
  if (!kind || !Number.isInteger(recurringId) || !scheduledDate) return null;
  return { kind, recurringId, scheduledDate };
}
