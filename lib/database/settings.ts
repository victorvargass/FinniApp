import { getDatabase } from '@/lib/database/connection';
import { parseHomePreferences } from '@/lib/home-preferences';
import type { HomePreferences } from '@/lib/home-preferences';
import type { MovementReminderSettings, Settings } from '@/lib/types';

export async function getSettings(): Promise<Settings> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{
    id: number;
    current_period_id: number | null;
    default_payment_method_id: number | null;
    push_notifications_enabled: number;
    movement_reminder_enabled: number;
    movement_reminder_frequency: 'daily' | 'weekly';
    movement_reminder_weekday: number;
    movement_reminder_hour: number;
    movement_reminder_minute: number;
    home_preferences: string | null;
    period_id: number | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `SELECT s.id, s.current_period_id, s.default_payment_method_id,
            s.push_notifications_enabled, s.movement_reminder_enabled,
            s.movement_reminder_frequency, s.movement_reminder_weekday,
            s.movement_reminder_hour, s.movement_reminder_minute, s.home_preferences,
            p.id AS period_id, p.start_date, p.end_date
     FROM settings s
     LEFT JOIN periods p ON p.id = s.current_period_id
     WHERE s.id = 1`
  );

  return {
    id: row?.id ?? 1,
    currentPeriodId: row?.current_period_id ?? null,
    defaultPaymentMethodId: row?.default_payment_method_id ?? null,
    pushNotificationsEnabled: (row?.push_notifications_enabled ?? 0) === 1,
    movementReminderEnabled: (row?.movement_reminder_enabled ?? 0) === 1,
    movementReminderFrequency: row?.movement_reminder_frequency ?? 'daily',
    movementReminderWeekday: row?.movement_reminder_weekday ?? 1,
    movementReminderHour: row?.movement_reminder_hour ?? 21,
    movementReminderMinute: row?.movement_reminder_minute ?? 0,
    homePreferences: parseHomePreferences(row?.home_preferences),
    currentPeriod: row?.period_id ? {
      id: row.period_id,
      startDate: row.start_date!,
      endDate: row.end_date!,
    } : null,
  };
}

export async function updateMovementReminderSettings(data: MovementReminderSettings): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE settings SET movement_reminder_enabled = ?, movement_reminder_frequency = ?,
      movement_reminder_weekday = ?, movement_reminder_hour = ?, movement_reminder_minute = ?
     WHERE id = 1`,
    data.movementReminderEnabled ? 1 : 0,
    data.movementReminderFrequency,
    data.movementReminderWeekday,
    data.movementReminderHour,
    data.movementReminderMinute
  );
}

export async function updateHomePreferences(data: HomePreferences): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE settings SET home_preferences = ? WHERE id = 1',
    JSON.stringify(data)
  );
}

export async function updatePushNotificationsEnabled(enabled: boolean): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE settings SET push_notifications_enabled = ? WHERE id = 1',
    enabled ? 1 : 0
  );
}
