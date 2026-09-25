import type * as Notifications from 'expo-notifications';

import { upsertAppNotifications } from '@/repositories/notifications';

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDeliveredNotificationInboxKey(
  notification: Notifications.Notification
): string {
  const data = notification.request.content.data;
  if (data?.kind === 'movement-reminder') {
    return `movement-reminder:${localDateKey(notification.date)}`;
  }
  return typeof data?.inboxKey === 'string'
    ? data.inboxKey
    : `delivered:${notification.request.identifier}`;
}

export async function recordDeliveredNotification(
  notification: Notifications.Notification
): Promise<string> {
  const content = notification.request.content;
  const data = content.data;
  const sourceKey = getDeliveredNotificationInboxKey(notification);
  const recurringKind = data?.kind === 'recurring-expense'
    ? 'expense'
    : data?.kind === 'recurring-income' ? 'income' : null;
  const recurringId = Number(data?.recurringId ?? data?.recurringExpenseId);
  const recurringDate = typeof data?.scheduledDate === 'string' ? data.scheduledDate : null;
  const actionUrl = typeof data?.url === 'string'
    ? data.url
    : recurringKind && Number.isInteger(recurringId)
      ? recurringKind === 'expense'
        ? `/modal/recurring-expense-form?id=${recurringId}`
        : `/modal/recurring-income-form?id=${recurringId}`
      : null;

  await upsertAppNotifications([{
    sourceKey,
    kind: typeof data?.kind === 'string' ? data.kind : 'general',
    title: content.title ?? '',
    body: content.body ?? '',
    scheduledFor: notification.date,
    actionUrl,
    recurringKind,
    recurringId: Number.isInteger(recurringId) ? recurringId : null,
    recurringDate,
  }]);
  return sourceKey;
}
