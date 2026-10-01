import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  DEDUPLICATE_MOVEMENT_REMINDERS_SQL,
  isAppNotificationVisible,
  localNotificationDateKey,
  notificationDayBucket,
} from '../lib/notification-inbox.ts';

test('financial reminders due within seven days are visible before their push arrives', () => {
  const now = new Date(2026, 8, 30, 9, 43).getTime();
  const dueInFiveDays = new Date(2026, 9, 5, 9).getTime();
  const dueInEightDays = new Date(2026, 9, 8, 9).getTime();

  assert.equal(isAppNotificationVisible('card-payment-due', dueInFiveDays, now), true);
  assert.equal(isAppNotificationVisible('movement-reminder', dueInFiveDays, now), false);
  assert.equal(isAppNotificationVisible('card-payment-due', dueInEightDays, now), false);
});

test('movement reminder keys use the device local calendar date', () => {
  const localEvening = new Date(2026, 8, 25, 21, 0, 0);
  assert.equal(localNotificationDateKey(localEvening), '2026-09-25');
});

test('notification day buckets follow local calendar days across month boundaries', () => {
  const now = new Date(2026, 9, 1, 0, 15, 0);

  assert.equal(notificationDayBucket(new Date(2026, 9, 1, 0, 1, 0), now), 'today');
  assert.equal(notificationDayBucket(new Date(2026, 8, 30, 23, 59, 0), now), 'yesterday');
  assert.equal(notificationDayBucket(new Date(2026, 8, 29, 23, 59, 0), now), 'date');
});

test('removes only duplicate movement reminders for the same local day', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE app_notifications (
        id INTEGER PRIMARY KEY,
        kind TEXT NOT NULL,
        scheduled_for INTEGER NOT NULL,
        deleted_at TEXT
      );
      INSERT INTO app_notifications VALUES (1, 'movement-reminder', 1790380800000, NULL);
      INSERT INTO app_notifications VALUES (2, 'movement-reminder', 1790380800000, NULL);
      INSERT INTO app_notifications VALUES (3, 'period-ending', 1790380800000, NULL);
    `);

    database.exec(DEDUPLICATE_MOVEMENT_REMINDERS_SQL);

    assert.deepEqual(
      database.prepare('SELECT id, kind FROM app_notifications ORDER BY id').all()
        .map(({ id, kind }) => ({ id, kind })),
      [
        { id: 2, kind: 'movement-reminder' },
        { id: 3, kind: 'period-ending' },
      ]
    );
  } finally {
    database.close();
  }
});
