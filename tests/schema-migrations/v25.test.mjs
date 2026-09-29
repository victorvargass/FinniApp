import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const source = readFileSync(new URL('../../lib/db.ts', import.meta.url), 'utf8');
const v24Fixture = readFileSync(new URL('../fixtures/database/v24.sql', import.meta.url), 'utf8');

function tableDefinition(name) {
  const statement = source.match(
    new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\([\\s\\S]*?\\n    \\);`)
  )?.[0];
  assert.ok(statement, `No se encontró el esquema de ${name}`);
  return statement;
}

test('schema v25 creates a complete clean database', () => {
  const database = new DatabaseSync(':memory:');
  try {
    const initializer = source.slice(
      source.indexOf('async function initializeDatabase(): Promise<void> {'),
      source.indexOf('// Existing databases can have an older expenses/incomes schema.')
    );
    const ddl = initializer.match(/await db\.execAsync\(`([\s\S]*?)`\);/)?.[1];
    assert.ok(ddl, 'No se encontró el DDL inicial');
    database.exec(ddl.replace('${DATABASE_APPLICATION_ID}', '1179213390'));

    const tables = database.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    ).all().map((row) => row.name);
    assert.ok(tables.includes('expense_shares'));
    assert.ok(tables.includes('manual_debts'));
    assert.ok(tables.includes('payment_methods'));
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('schema v25 creates expense shares on a v24 database without losing existing expenses', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(v24Fixture);

    database.exec(tableDefinition('expense_shares'));
    database.exec(`
      INSERT INTO expense_shares (
        expense_id, contact_id, debt_id, amount, status, due_date, due_time
      ) VALUES (7, 3, 9, 60000, 'pending', '2026-10-05', '18:30');
    `);

    assert.deepEqual(
      { ...database.prepare('SELECT id, amount FROM expenses WHERE id = 7').get() },
      { id: 7, amount: 120000 }
    );
    assert.deepEqual(
      { ...database.prepare('SELECT expense_id, amount, status FROM expense_shares').get() },
      { expense_id: 7, amount: 60000, status: 'pending' }
    );
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});
