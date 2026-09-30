import { getDatabase } from '@/lib/db';
import { withDatabaseLock } from '@/lib/database-lock';
import { DEDUPLICATE_MOVEMENT_REMINDERS_SQL } from '@/lib/notification-inbox';
import type { AppNotification, NewAppNotification } from '@/lib/types';

const DATABASE_BUSY_TIMEOUT_MS = 5000;

async function withNotificationTransaction(
  task: (transaction: Awaited<ReturnType<typeof getDatabase>>) => Promise<void>
): Promise<void> {
  const database = await getDatabase();
  await withDatabaseLock(async () => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      await transaction.execAsync(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
      await task(transaction);
    });
  });
}

async function upsertNotification(
  database: Awaited<ReturnType<typeof getDatabase>>,
  item: NewAppNotification
): Promise<void> {
  await database.runAsync(
    `INSERT INTO app_notifications (
      source_key, kind, title, body, scheduled_for, action_url,
      recurring_kind, recurring_id, recurring_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source_key) DO UPDATE SET
      kind = excluded.kind,
      title = excluded.title,
      body = excluded.body,
      scheduled_for = excluded.scheduled_for,
      action_url = excluded.action_url,
      recurring_kind = excluded.recurring_kind,
      recurring_id = excluded.recurring_id,
      recurring_date = excluded.recurring_date,
      updated_at = CURRENT_TIMESTAMP`,
    item.sourceKey,
    item.kind,
    item.title,
    item.body,
    item.scheduledFor,
    item.actionUrl,
    item.recurringKind,
    item.recurringId,
    item.recurringDate
  );
}

export async function upsertAppNotifications(items: NewAppNotification[]): Promise<void> {
  if (items.length === 0) return;
  await withNotificationTransaction(async (transaction) => {
    for (const item of items) await upsertNotification(transaction, item);
  });
}

export async function getExistingAppNotificationSourceKeys(sourceKeys: string[]): Promise<string[]> {
  if (sourceKeys.length === 0) return [];
  const database = await getDatabase();
  const placeholders = sourceKeys.map(() => '?').join(', ');
  const rows = await database.getAllAsync<{ source_key: string }>(
    `SELECT source_key FROM app_notifications
     WHERE source_key IN (${placeholders}) AND deleted_at IS NULL`,
    ...sourceKeys
  );
  return rows.map((row) => row.source_key);
}

export async function replaceFutureAppNotifications(
  kinds: string[],
  items: NewAppNotification[]
): Promise<void> {
  await withNotificationTransaction(async (transaction) => {
    if (kinds.length > 0) {
      const placeholders = kinds.map(() => '?').join(', ');
      await transaction.runAsync(
        `DELETE FROM app_notifications
         WHERE kind IN (${placeholders}) AND scheduled_for > ?
           AND read_at IS NULL AND deleted_at IS NULL`,
        ...kinds,
        Date.now()
      );
    }
    for (const item of items) await upsertNotification(transaction, item);
  });
}

export async function getAppNotifications(): Promise<AppNotification[]> {
  await withNotificationTransaction(async (transaction) => {
    await transaction.execAsync(DEDUPLICATE_MOVEMENT_REMINDERS_SQL);
  });
  const database = await getDatabase();
  const rows = await database.getAllAsync<Omit<AppNotification, 'isRead'> & { isRead: number }>(
    `SELECT
      id,
      source_key AS sourceKey,
      kind,
      title,
      body,
      scheduled_for AS scheduledFor,
      action_url AS actionUrl,
      recurring_kind AS recurringKind,
      recurring_id AS recurringId,
      recurring_date AS recurringDate,
      read_at AS readAt,
      created_at AS createdAt,
      CASE WHEN read_at IS NULL THEN 0 ELSE 1 END AS isRead
     FROM app_notifications
     WHERE deleted_at IS NULL AND scheduled_for <= ?
     ORDER BY scheduled_for DESC, id DESC
     LIMIT 200`,
    Date.now()
  );
  return rows.map((row) => ({ ...row, isRead: row.isRead === 1 }));
}

export async function setAppNotificationRead(id: number, read: boolean): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE app_notifications
     SET read_at = ${read ? 'CURRENT_TIMESTAMP' : 'NULL'}, updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND deleted_at IS NULL`,
    id
  );
}

export async function markAppNotificationReadBySourceKey(sourceKey: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE app_notifications
     SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE source_key = ? AND deleted_at IS NULL`,
    sourceKey
  );
}

export async function deleteAppNotification(id: number): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    `UPDATE app_notifications
     SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    id
  );
}
