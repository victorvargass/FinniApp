import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/database/engine.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');

test('schema v31 repairs reported balance writes without losing debt history', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = (?:31|32)/);
  assert.match(registrySource, /version: 31, name: 'balance-adjustment-write-repair'/);

  const migrationStart = databaseSource.indexOf('if (previousSchemaVersion < 31)');
  const migrationEnd = databaseSource.indexOf('if (previousSchemaVersion < 14)', migrationStart);
  const migrationSource = databaseSource.slice(migrationStart, migrationEnd);
  const migrationSql = migrationSource.match(/await db\.execAsync\(`([\s\S]*?)`\);/)?.[1];
  assert.ok(migrationSql, 'v31 debt entry migration SQL');

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE periods (id INTEGER PRIMARY KEY);
      CREATE TABLE expenses (id INTEGER PRIMARY KEY);
      CREATE TABLE incomes (id INTEGER PRIMARY KEY);
      CREATE TABLE manual_debts (id INTEGER PRIMARY KEY);
      CREATE TABLE manual_debt_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        debt_id INTEGER NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('payment', 'adjustment')),
        amount INTEGER NOT NULL CHECK (amount != 0),
        date TEXT NOT NULL,
        time TEXT NOT NULL DEFAULT '12:00',
        period_id INTEGER,
        expense_id INTEGER UNIQUE,
        income_id INTEGER UNIQUE,
        note TEXT,
        reported_balance INTEGER CHECK (reported_balance IS NULL OR reported_balance >= 0),
        payment_anchor_id INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(debt_id) REFERENCES manual_debts(id) ON DELETE CASCADE,
        FOREIGN KEY(period_id) REFERENCES periods(id),
        FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
        FOREIGN KEY(income_id) REFERENCES incomes(id) ON DELETE CASCADE
      );
      INSERT INTO manual_debts VALUES (1);
      INSERT INTO manual_debt_entries
        (debt_id, kind, amount, date, time, note, reported_balance, payment_anchor_id)
      VALUES (1, 'adjustment', 5000, '2026-10-02', '23:50', 'anterior', 35000, 0);
    `);

    database.exec(migrationSql);
    database.prepare(`INSERT INTO manual_debt_entries
      (debt_id, kind, amount, date, time, reported_balance, payment_anchor_id)
      VALUES (1, 'adjustment', 0, '2026-10-03', '00:10', 35000, 0)`).run();

    const rows = database.prepare(`SELECT amount, time, reported_balance
      FROM manual_debt_entries ORDER BY id`).all().map((row) => ({ ...row }));
    assert.deepEqual(rows, [
      { amount: 5000, time: '23:50', reported_balance: 35000 },
      { amount: 0, time: '00:10', reported_balance: 35000 },
    ]);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('savings balance snapshots persist their event time', () => {
  const writeStart = databaseSource.indexOf('export async function addSavingsGoalBalanceAdjustment');
  const writeEnd = databaseSource.indexOf('export async function deleteSavingsGoalBalanceAdjustment', writeStart);
  const writeSource = databaseSource.slice(writeStart, writeEnd);
  assert.match(
    writeSource,
    /data\.date,\s+resolveEventTime\(data\.time\),\s+data\.note\?\.trim\(\) \|\| null/
  );

  const legacyMigrationStart = databaseSource.indexOf('CREATE TABLE savings_goal_adjustments_v15');
  const legacyMigrationEnd = databaseSource.indexOf('ALTER TABLE savings_goal_adjustments_v15 RENAME', legacyMigrationStart);
  const legacyMigration = databaseSource.slice(legacyMigrationStart, legacyMigrationEnd);
  assert.match(legacyMigration, /time TEXT NOT NULL DEFAULT '12:00'/);
  assert.match(legacyMigration, /SELECT id, goal_id, amount, date, time, note/);
});

test('reported balance screens record handled write failures', () => {
  for (const path of ['../../app/modal/savings-goal-balance.tsx', '../../app/modal/manual-debt-balance.tsx']) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(source, /catch \(error\) \{\s+logAppError\('database\.write', error\)/);
  }
});
