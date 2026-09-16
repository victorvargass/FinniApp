import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { withDatabaseLock } from '../lib/database-lock.ts';
import {
  DATABASE_APPLICATION_ID,
  DATABASE_SCHEMA_VERSION,
} from '../lib/database-schema.ts';
import {
  LEGACY_DEBT_BALANCE_DATE_SQL,
  LEGACY_SAVINGS_BALANCE_DATE_SQL,
  recordAppliedSchema,
} from '../lib/schema-migrations.ts';

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
      name: 'separate-creation-and-reported-balance-dates',
    });
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, DATABASE_SCHEMA_VERSION);
    assert.equal(database.prepare('PRAGMA application_id').get().application_id, DATABASE_APPLICATION_ID);
  } finally {
    database.close();
  }
});

test('legacy balances stop using historical creation when no later snapshot exists', () => {
  const database = temporaryDatabase();
  try {
    database.exec(`
      CREATE TABLE savings_goals (
        id INTEGER PRIMARY KEY, created_at TEXT, updated_at TEXT,
        balance_updated_at TEXT, balance_movement_anchor_id INTEGER
      );
      CREATE TABLE savings_goal_adjustments (
        goal_id INTEGER, reported_balance INTEGER
      );
      CREATE TABLE savings_goal_movements (
        id INTEGER PRIMARY KEY, goal_id INTEGER, expense_id INTEGER, income_id INTEGER
      );
      CREATE TABLE expenses (id INTEGER PRIMARY KEY, date TEXT);
      CREATE TABLE incomes (id INTEGER PRIMARY KEY, date TEXT);
      CREATE TABLE manual_debts (
        id INTEGER PRIMARY KEY, created_at TEXT, updated_at TEXT,
        balance_updated_at TEXT, balance_payment_anchor_id INTEGER
      );
      CREATE TABLE manual_debt_entries (
        id INTEGER PRIMARY KEY, debt_id INTEGER, kind TEXT,
        reported_balance INTEGER, date TEXT
      );
      INSERT INTO savings_goals VALUES
        (1, '2024-12-30 12:00:00', '2026-09-15 12:00:00', '2024-12-30', 0),
        (2, '2024-12-30 12:00:00', '2026-09-15 12:00:00', '2024-12-30', 0);
      INSERT INTO savings_goal_adjustments VALUES (2, 30000);
      INSERT INTO expenses VALUES (1, '2026-09-15'), (2, '2026-09-16');
      INSERT INTO savings_goal_movements VALUES (1, 1, 1, NULL), (2, 1, 2, NULL);
      INSERT INTO manual_debts VALUES
        (1, '2024-12-30 12:00:00', '2026-09-15 12:00:00', '2024-12-30', 0),
        (2, '2024-12-30 12:00:00', '2026-09-15 12:00:00', '2024-12-30', 0);
      INSERT INTO manual_debt_entries VALUES
        (1, 1, 'payment', NULL, '2026-09-15'),
        (2, 1, 'payment', NULL, '2026-09-16'),
        (3, 2, 'adjustment', 100000, '2026-09-15');
    `);
    database.exec(LEGACY_SAVINGS_BALANCE_DATE_SQL);
    database.exec(LEGACY_DEBT_BALANCE_DATE_SQL);
    const savings = database.prepare('SELECT balance_updated_at FROM savings_goals ORDER BY id').all();
    const debts = database.prepare('SELECT balance_updated_at FROM manual_debts ORDER BY id').all();
    const savingsAnchor = database.prepare('SELECT balance_movement_anchor_id AS id FROM savings_goals WHERE id = 1').get();
    const debtAnchor = database.prepare('SELECT balance_payment_anchor_id AS id FROM manual_debts WHERE id = 1').get();
    assert.deepEqual(savings.map((item) => item.balance_updated_at), ['2026-09-15', '2024-12-30']);
    assert.deepEqual(debts.map((item) => item.balance_updated_at), ['2026-09-15', '2024-12-30']);
    assert.equal(savingsAnchor.id, 1);
    assert.equal(debtAnchor.id, 1);
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
