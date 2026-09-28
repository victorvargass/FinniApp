export function localNotificationDateKey(value: Date | number): string {
  const date = typeof value === 'number' ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
