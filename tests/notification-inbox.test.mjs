import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  DEDUPLICATE_MOVEMENT_REMINDERS_SQL,
  localNotificationDateKey,
} from '../lib/notification-inbox.ts';

test('movement reminder keys use the device local calendar date', () => {
  const localEvening = new Date(2026, 8, 25, 21, 0, 0);
  assert.equal(localNotificationDateKey(localEvening), '2026-09-25');
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
