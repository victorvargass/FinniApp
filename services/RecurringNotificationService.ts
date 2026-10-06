import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import { parseIsoDate, toIsoDate } from '@/lib/recurrence';
import { shouldScheduleRecurringNotification } from '@/lib/recurring-notification-sync';
import type {
  GeneratedRecurringExpenseNotification,
  RecurringConfirmationSchedule,
  RecurringDecisionItem,
} from '@/lib/types';
import {
  replaceFutureAppNotifications,
  upsertAppNotifications,
} from '@/repositories/notifications';

const RECURRING_CHANNEL = 'recurring-expenses';
const NOTIFIED_RECURRING_KEYS = '@finniapp/notified-recurring-keys-v1';
const DATA_KINDS = [
  'recurring-expense',
  'recurring-income',
  'recurring-expense-generated',
] as const;
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
  expenses: GeneratedRecurringExpenseNotification[],
  notificationsEnabled = true
): Promise<void> {
  if (Platform.OS === 'web' || !notificationsEnabled || expenses.length === 0) return;
  await configureRecurringNotifications();
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  for (const expense of expenses) {
    const title = t(expense.isSavingsContribution
      ? 'notifications.recurringSavingsRegistered'
      : 'notifications.recurringExpenseRegistered');
    const body = t(expense.isSavingsContribution
      ? 'notifications.generatedSavingsBody'
      : 'notifications.generatedExpenseBody', {
      name: expense.name,
      amount: formatCLP(expense.amount),
    });
    const inboxKey = `recurring-expense-generated:${expense.recurringExpenseId}:${expense.scheduledDate}`;
    await upsertAppNotifications([{
      sourceKey: inboxKey,
      kind: 'recurring-expense-generated',
      title,
      body,
      scheduledFor: Date.now(),
      actionUrl: '/(tabs)/movements?movementType=expenses',
      recurringKind: null,
      recurringId: null,
      recurringDate: null,
    }]);
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: {
          kind: 'recurring-expense-generated',
          recurringExpenseId: expense.recurringExpenseId,
          scheduledDate: expense.scheduledDate,
          inboxKey,
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
  if (scheduledDate <= toIsoDate(new Date())) return new Date(Date.now() + 3000);
  date.setHours(9, 0, 0, 0);
  return date;
}

async function getNotifiedRecurringKeys(): Promise<Set<string>> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFIED_RECURRING_KEYS);
    if (!stored) return new Set();
    const parsed: unknown = JSON.parse(stored);
    return new Set(Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []);
  } catch {
    return new Set();
  }
}

async function saveNotifiedRecurringKeys(keys: ReadonlySet<string>): Promise<void> {
  await AsyncStorage.setItem(NOTIFIED_RECURRING_KEYS, JSON.stringify([...keys]));
}

function inboxNotificationDate(scheduledDate: string): Date {
  const date = parseIsoDate(scheduledDate);
  date.setHours(9, 0, 0, 0);
  return date;
}

function recurringInboxItem(schedule: RecurringConfirmationSchedule) {
  const noun = schedule.isSavingsContribution
    ? t('recurrence.saving')
    : schedule.kind === 'expense'
      ? t('navigation.expense').toLowerCase()
      : t('navigation.income').toLowerCase();
  return {
    sourceKey: `recurring-${schedule.kind}:${schedule.recurringId}:${schedule.scheduledDate}`,
    kind: `recurring-${schedule.kind}`,
    title: t('notifications.recurringReviewTitle', { movement: noun }),
    body: t('notifications.recurringReviewBody', {
      name: schedule.name,
      amount: formatCLP(schedule.amount),
    }),
    scheduledFor: inboxNotificationDate(schedule.scheduledDate).getTime(),
    actionUrl: `/modal/recurrence-detail?id=${schedule.recurringId}&kind=${schedule.kind}`,
    recurringKind: schedule.kind,
    recurringId: schedule.recurringId,
    recurringDate: schedule.scheduledDate,
  };
}

export async function upsertRecurringDecisionNotifications(
  decisions: RecurringDecisionItem[]
): Promise<void> {
  await upsertAppNotifications(decisions.map(recurringInboxItem));
}

export async function cancelRecurringNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => DATA_KINDS.includes(item.content.data?.kind as typeof DATA_KINDS[number]))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
  await replaceFutureAppNotifications([...DATA_KINDS], []);
  await AsyncStorage.removeItem(NOTIFIED_RECURRING_KEYS);
}

export async function syncRecurringNotifications(
  schedules: RecurringConfirmationSchedule[],
  notificationsEnabled = true
): Promise<void> {
  if (Platform.OS === 'web') return;
  await configureRecurringNotifications();
  if (!notificationsEnabled) {
    await cancelRecurringNotifications();
    return;
  }
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const limited = [...schedules]
    .sort((first, second) => first.scheduledDate.localeCompare(second.scheduledDate))
    .slice(0, 40);
  const inboxItems = limited.map(recurringInboxItem);
  const desiredKeys = new Set(inboxItems.map((item) => item.sourceKey));
  const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const scheduledKeys = new Set<string>();
  const cancellationIds: string[] = [];
  for (const notification of scheduledNotifications) {
    const kind = notification.content.data?.kind;
    if (kind !== 'recurring-expense' && kind !== 'recurring-income') continue;
    const inboxKey = typeof notification.content.data?.inboxKey === 'string'
      ? notification.content.data.inboxKey
      : null;
    if (inboxKey == null || !desiredKeys.has(inboxKey) || scheduledKeys.has(inboxKey)) {
      cancellationIds.push(notification.identifier);
    } else {
      scheduledKeys.add(inboxKey);
    }
  }
  await Promise.all(cancellationIds.map((identifier) =>
    Notifications.cancelScheduledNotificationAsync(identifier)
  ));
  const notifiedKeys = await getNotifiedRecurringKeys();
  for (const key of [...notifiedKeys]) {
    if (!desiredKeys.has(key)) notifiedKeys.delete(key);
  }
  for (const key of scheduledKeys) notifiedKeys.add(key);
  await replaceFutureAppNotifications([...DATA_KINDS], inboxItems);
  for (const [index, schedule] of limited.entries()) {
    const noun = schedule.isSavingsContribution
      ? t('recurrence.saving')
      : schedule.kind === 'expense'
        ? t('navigation.expense').toLowerCase()
        : t('navigation.income').toLowerCase();
    const inboxItem = inboxItems[index];
    const triggerDate = notificationDate(schedule.scheduledDate);
    if (!shouldScheduleRecurringNotification({
      inboxKey: inboxItem.sourceKey,
      triggerTime: parseIsoDate(schedule.scheduledDate).getTime(),
      scheduledKeys,
      notifiedKeys,
    })) continue;
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
          inboxKey: inboxItem.sourceKey,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
        channelId: RECURRING_CHANNEL,
      },
    });
    notifiedKeys.add(inboxItem.sourceKey);
  }
  await saveNotifiedRecurringKeys(notifiedKeys);
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
