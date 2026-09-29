import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/db.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');

test('schema v27 adds home visibility without hiding existing records', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = 27/);
  assert.match(registrySource, /version: 27, name: 'home-item-visibility'/);

  const migrationStart = databaseSource.indexOf('if (previousSchemaVersion < 27)');
  const migration = databaseSource.slice(
    migrationStart,
    databaseSource.indexOf('const expenseColumns', migrationStart)
  );

  for (const table of ['payment_methods', 'savings_goals', 'manual_debts', 'debt_plans']) {
    assert.match(
      migration,
      new RegExp(`ensureColumn\\(db, '${table}', 'show_on_home', 'INTEGER NOT NULL DEFAULT 1'\\)`)
    );
  }

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE payment_methods (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE savings_goals (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE manual_debts (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE debt_plans (id INTEGER PRIMARY KEY, name TEXT NOT NULL);
      INSERT INTO payment_methods VALUES (1, 'Cuenta');
      INSERT INTO savings_goals VALUES (2, 'Emergencias');
      INSERT INTO manual_debts VALUES (3, 'Préstamo');
      INSERT INTO debt_plans VALUES (4, 'Compra en cuotas');
      ALTER TABLE payment_methods ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE savings_goals ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE manual_debts ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE debt_plans ADD COLUMN show_on_home INTEGER NOT NULL DEFAULT 1;
    `);

    assert.equal(database.prepare('SELECT show_on_home FROM payment_methods WHERE id = 1').get().show_on_home, 1);
    assert.equal(database.prepare('SELECT show_on_home FROM savings_goals WHERE id = 2').get().show_on_home, 1);
    assert.equal(database.prepare('SELECT show_on_home FROM manual_debts WHERE id = 3').get().show_on_home, 1);
    assert.equal(database.prepare('SELECT show_on_home FROM debt_plans WHERE id = 4').get().show_on_home, 1);
  } finally {
    database.close();
  }
});
