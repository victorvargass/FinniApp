import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getEstimatedPaymentDueDate } from '@/lib/payment-method-calculations';
import type { Debt, DebtPlan, PaymentMethod, Period } from '@/lib/types';
import { replaceFutureAppNotifications } from '@/repositories/notifications';

const CHANNEL = 'financial-reminders';
const MAX_SCHEDULED_REMINDERS = 20;
const FINANCIAL_KINDS = [
  'card-billing-date',
  'card-payment-due',
  'debt-payment-due',
  'installment-payment-due',
  'period-ending',
] as const;

type FinancialNotificationKind = typeof FINANCIAL_KINDS[number];

type Reminder = {
  sourceKey: string;
  kind: FinancialNotificationKind;
  date: Date;
  title: string;
  body: string;
  url: string;
};

type FinancialReminderData = {
  paymentMethods: PaymentMethod[];
  debts: Debt[];
  debtPlans: DebtPlan[];
  currentPeriod: Period | null;
};

function localDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function atTime(date: Date, hour: number): Date {
  const result = new Date(date);
  result.setHours(hour, 0, 0, 0);
  return result;
}

function nextMonthlyDate(day: number, now: Date): Date {
  const candidate = new Date(
    now.getFullYear(),
    now.getMonth(),
    Math.min(day, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()),
    9
  );
  if (candidate.getTime() > now.getTime()) return candidate;
  const nextMonth = now.getMonth() + 1;
  return new Date(
    now.getFullYear(),
    nextMonth,
    Math.min(day, new Date(now.getFullYear(), nextMonth + 1, 0).getDate()),
    9
  );
}

function futureDate(value: string | null, now: Date, hour = 9): Date | null {
  if (!value) return null;
  const date = atTime(localDate(value), hour);
  return date.getTime() > now.getTime() ? date : null;
}

function reminderDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildFinancialReminders(
  data: FinancialReminderData,
  now = new Date()
): Reminder[] {
  const reminders: Reminder[] = [];

  for (const method of data.paymentMethods) {
    if (!method.active || method.type !== 'credit') continue;
    const detailUrl = `/modal/payment-method-detail?id=${method.id}`;

    if (method.billingDay != null) {
      const date = nextMonthlyDate(method.billingDay, now);
      reminders.push({
        sourceKey: `card-billing-date:${method.id}:${reminderDateKey(date)}`,
        kind: 'card-billing-date',
        date,
        title: t('notifications.cardBillingTitle', { name: method.name }),
        body: t('notifications.cardBillingBody', { name: method.name }),
        url: `/modal/card-cycles?id=${method.id}`,
      });
    }

    if (method.billedAmount > 0 && method.statementDate && method.paymentDueDay != null) {
      const dueDate = atTime(
        getEstimatedPaymentDueDate(method.statementDate, method.paymentDueDay),
        9
      );
      if (dueDate.getTime() > now.getTime()) {
        reminders.push({
          sourceKey: `card-payment-due:${method.id}:${reminderDateKey(dueDate)}`,
          kind: 'card-payment-due',
          date: dueDate,
          title: t('notifications.cardDueTitle', { name: method.name }),
          body: t('notifications.cardDueBody', {
            name: method.name,
            amount: formatCLP(method.billedAmount),
          }),
          url: detailUrl,
        });
      }
    }
  }

  for (const debt of data.debts) {
    const date = debt.status === 'active' ? futureDate(debt.nextDueDate, now) : null;
    if (!date || debt.installmentAmount == null) continue;
    reminders.push({
      sourceKey: `debt-payment-due:${debt.id}:${reminderDateKey(date)}`,
      kind: 'debt-payment-due',
      date,
      title: t(debt.direction === 'receivable' ? 'notifications.debtCollectionTitle' : 'notifications.debtPaymentTitle', { name: debt.name }),
      body: t(debt.direction === 'receivable' ? 'notifications.debtCollectionBody' : 'notifications.debtPaymentBody', {
        name: debt.name,
        amount: formatCLP(Math.min(debt.installmentAmount, debt.currentBalance)),
      }),
      url: `/modal/manual-debt-detail?id=${debt.id}`,
    });
  }

  for (const plan of data.debtPlans) {
    const date = plan.status !== 'completed' && plan.status !== 'cancelled'
      ? futureDate(plan.nextInstallmentDueDate, now)
      : null;
    if (!date || plan.nextInstallmentNumber == null || plan.nextInstallmentAmount == null) continue;
    reminders.push({
      sourceKey: `installment-payment-due:${plan.id}:${reminderDateKey(date)}`,
      kind: 'installment-payment-due',
      date,
      title: t('notifications.installmentDueTitle', { name: plan.name }),
      body: t('notifications.installmentDueBody', {
        number: plan.nextInstallmentNumber,
        total: plan.totalInstallments,
        amount: formatCLP(plan.nextInstallmentAmount),
        card: plan.paymentMethodName,
      }),
      url: `/modal/debt-detail?id=${plan.id}`,
    });
  }

  if (data.currentPeriod) {
    const warningDate = localDate(data.currentPeriod.endDate);
    warningDate.setDate(warningDate.getDate() - 1);
    warningDate.setHours(20, 0, 0, 0);
    if (warningDate.getTime() > now.getTime()) {
      reminders.push({
        sourceKey: `period-ending:${data.currentPeriod.id}:${reminderDateKey(warningDate)}`,
        kind: 'period-ending',
        date: warningDate,
        title: t('notifications.periodEndingTitle'),
        body: t('notifications.periodEndingBody'),
        url: '/(tabs)/home',
      });
    }
  }

  return reminders
    .sort((first, second) => first.date.getTime() - second.date.getTime())
    .slice(0, MAX_SCHEDULED_REMINDERS);
}

export async function cancelFinancialReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((item) => FINANCIAL_KINDS.includes(
        item.content.data?.kind as FinancialNotificationKind
      ))
      .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier))
  );
  await replaceFutureAppNotifications([...FINANCIAL_KINDS], []);
}

export async function configureFinancialReminderChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: t('notifications.financialChannelName'),
    description: t('notifications.financialChannelDescription'),
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
  });
}

export async function syncFinancialReminders(
  data: FinancialReminderData,
  notificationsEnabled = true
): Promise<void> {
  if (Platform.OS === 'web') return;

  await configureFinancialReminderChannel();
  await cancelFinancialReminders();
  if (!notificationsEnabled) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;

  const reminders = buildFinancialReminders(data);
  await replaceFutureAppNotifications(
    [...FINANCIAL_KINDS],
    reminders.map((reminder) => ({
      sourceKey: reminder.sourceKey,
      kind: reminder.kind,
      title: reminder.title,
      body: reminder.body,
      scheduledFor: reminder.date.getTime(),
      actionUrl: reminder.url,
      recurringKind: null,
      recurringId: null,
      recurringDate: null,
    }))
  );

  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: 'default',
        data: { kind: reminder.kind, url: reminder.url, inboxKey: reminder.sourceKey },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.date,
        channelId: CHANNEL,
      },
    });
  }
}

export function getFinancialReminderUrl(
  response: Notifications.NotificationResponse
): string | null {
  const data = response.notification.request.content.data;
  return FINANCIAL_KINDS.includes(data?.kind as FinancialNotificationKind)
    && typeof data?.url === 'string'
    ? data.url
    : null;
}
