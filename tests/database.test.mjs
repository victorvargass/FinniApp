import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { withDatabaseLock } from '../lib/database-lock.ts';
import {
  DATABASE_APPLICATION_ID,
  DATABASE_SCHEMA_VERSION,
} from '../lib/database-schema.ts';
import { recordAppliedSchema } from '../lib/schema-migrations.ts';

function temporaryDatabase() {
  return new DatabaseSync(':memory:');
}

test('database lock serializes concurrent writes and survives errors', async () => {
  const order = [];
  const first = withDatabaseLock(async () => {
    order.push('first:start');
    await new Promise((resolve) => setTimeout(resolve, 10));
    order.push('first:end');
  });
  const second = withDatabaseLock(async () => {
    order.push('second');
  });
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second']);

  await assert.rejects(withDatabaseLock(async () => { throw new Error('expected'); }));
  await withDatabaseLock(async () => { order.push('recovered'); });
  assert.equal(order.at(-1), 'recovered');
});

test('schema migration records a deterministic version and application id', async () => {
  const database = temporaryDatabase();
  try {
    await recordAppliedSchema({ execAsync: async (source) => { database.exec(source); } });
    const migration = database.prepare('SELECT version, name FROM schema_migrations ORDER BY version DESC').get();
    assert.deepEqual({ ...migration }, {
      version: DATABASE_SCHEMA_VERSION,
      name: 'payment-method-account-balances',
    });
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, DATABASE_SCHEMA_VERSION);
    assert.equal(database.prepare('PRAGMA application_id').get().application_id, DATABASE_APPLICATION_ID);
  } finally {
    database.close();
  }
});

test('composed SQLite writes roll back together on failure', () => {
  const database = temporaryDatabase();
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE periods (id INTEGER PRIMARY KEY, start_date TEXT, end_date TEXT);
      CREATE TABLE settings (id INTEGER PRIMARY KEY, current_period_id INTEGER REFERENCES periods(id));
      INSERT INTO periods VALUES (1, '2026-01-01', '2026-01-31');
      INSERT INTO settings VALUES (1, 1);
    `);
    database.exec('BEGIN IMMEDIATE');
    assert.throws(() => database.exec(`
      INSERT INTO periods VALUES (2, '2026-02-01', '2026-03-01');
      UPDATE settings SET current_period_id = 999 WHERE id = 1;
    `));
    database.exec('ROLLBACK');
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM periods').get().count, 1);
    assert.equal(database.prepare('SELECT current_period_id FROM settings').get().current_period_id, 1);
  } finally {
    database.close();
  }
});
