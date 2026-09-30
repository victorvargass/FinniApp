import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/db.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');
const fixtureSql = readFileSync(new URL('../fixtures/database/v27.sql', import.meta.url), 'utf8');

const auditTableSql = databaseSource.match(
  /CREATE TABLE IF NOT EXISTS financial_audit_log \([\s\S]*?\n    \);/
)?.[0];

test('schema v29 adds a persistent financial audit without changing existing movements', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = 29/);
  assert.match(registrySource, /version: 29, name: 'financial-audit-and-recovery'/);
  assert.ok(auditTableSql, 'financial audit table must be part of the creation and upgrade contract');

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(fixtureSql);
    const before = {
      expenses: database.prepare('SELECT COUNT(*) count, SUM(amount) total FROM expenses').get(),
      incomes: database.prepare('SELECT COUNT(*) count, SUM(amount) total FROM incomes').get(),
    };
    database.exec(`${auditTableSql}; PRAGMA user_version = 29;`);
    database.prepare(`INSERT INTO financial_audit_log
      (entity_type, entity_id, action, title, amount, event_date, event_time, restorable)
      VALUES ('expense', 1, 'deleted', 'Prueba', 1000, '2026-09-29', '10:00', 1)`).run();

    assert.deepEqual({ ...database.prepare('SELECT COUNT(*) count, SUM(amount) total FROM expenses').get() }, { ...before.expenses });
    assert.deepEqual({ ...database.prepare('SELECT COUNT(*) count, SUM(amount) total FROM incomes').get() }, { ...before.incomes });
    assert.equal(database.prepare('SELECT restorable FROM financial_audit_log').get().restorable, 1);
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 29);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('movement deletion audits ordinary recovery and protects linked records', () => {
  assert.match(databaseSource, /INSERT INTO financial_audit_log[\s\S]*?'expense'/);
  assert.match(databaseSource, /hasProtectedLink = expenseShares\.length > 0/);
  assert.match(databaseSource, /hasProtectedLink = savingsMovement != null \|\| occurrence != null \|\| debtEntry != null/);
  assert.match(databaseSource, /30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(databaseSource, /assertCreditCardCycleIsEditable\([\s\S]*?snapshot\.payment_method_id/);
});
