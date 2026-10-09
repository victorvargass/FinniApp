import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/database/engine.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');
const fixtureSql = readFileSync(new URL('../fixtures/database/v27.sql', import.meta.url), 'utf8');
const fixtureManifest = JSON.parse(
  readFileSync(new URL('../fixtures/database/manifest.json', import.meta.url), 'utf8')
).v27;

function financialSnapshot(database) {
  const aggregate = (table, column) => ({
    count: database.prepare(`SELECT COUNT(*) AS value FROM ${table}`).get().value,
    total: database.prepare(`SELECT COALESCE(SUM(${column}), 0) AS value FROM ${table}`).get().value,
  });
  return {
    expenses: aggregate('expenses', 'amount'),
    incomes: aggregate('incomes', 'amount'),
    savingsGoals: aggregate('savings_goals', 'current_amount'),
    manualDebts: aggregate('manual_debts', 'current_balance'),
    debtPlans: aggregate('debt_plans', 'total_amount'),
    recurringExpenses: aggregate('recurring_expenses', 'amount'),
  };
}

test('schema v28 stores optional Home layout preferences without changing existing settings', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = (?:28|29|30|31|32)/);
  assert.match(registrySource, /version: 28, name: 'home-layout-preferences'/);
  const migrationStart = databaseSource.indexOf('if (previousSchemaVersion < 28)');
  const migration = databaseSource.slice(
    migrationStart,
    databaseSource.indexOf('const expenseColumns', migrationStart)
  );
  assert.match(migration, /ensureColumn\(db, 'settings', 'home_preferences', 'TEXT'\)/);

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(fixtureSql);
    assert.deepEqual(financialSnapshot(database), fixtureManifest.expected);

    database.exec('ALTER TABLE settings ADD COLUMN home_preferences TEXT;');
    database.exec('PRAGMA user_version = 28;');

    const row = database.prepare('SELECT current_period_id, home_preferences FROM settings WHERE id = 1').get();
    assert.deepEqual({ ...row }, { current_period_id: 1, home_preferences: null });
    assert.deepEqual(financialSnapshot(database), fixtureManifest.expected);
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 28);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});
