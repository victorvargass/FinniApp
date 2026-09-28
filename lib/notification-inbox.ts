export function localNotificationDateKey(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export type NotificationDayBucket = 'today' | 'yesterday' | 'date';

export function notificationDayBucket(
  value: Date | number,
  now: Date | number = Date.now()
): NotificationDayBucket {
  const notificationDate = typeof value === 'number' ? new Date(value) : value;
  const currentDate = typeof now === 'number' ? new Date(now) : now;

  if (localNotificationDateKey(notificationDate) === localNotificationDateKey(currentDate)) {
    return 'today';
  }

  const yesterday = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate() - 1
  );
  return localNotificationDateKey(notificationDate) === localNotificationDateKey(yesterday)
    ? 'yesterday'
    : 'date';
}

export const DEDUPLICATE_MOVEMENT_REMINDERS_SQL = `
  DELETE FROM app_notifications
  WHERE id IN (
    SELECT id
    FROM (
      SELECT
        id,
        ROW_NUMBER() OVER (
          PARTITION BY date(scheduled_for / 1000, 'unixepoch', 'localtime')
          ORDER BY id DESC
        ) AS duplicate_position
      FROM app_notifications
      WHERE kind = 'movement-reminder' AND deleted_at IS NULL
    ) duplicates
    WHERE duplicate_position > 1
  )`;
