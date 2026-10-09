import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/database/engine.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');
const fixtureSql = readFileSync(new URL('../fixtures/database/v27.sql', import.meta.url), 'utf8');

test('schema v30 adds isolated USD ledgers while preserving all existing CLP data', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = (?:30|31|32)/);
  assert.match(registrySource, /version: 30, name: 'credit-card-usd-ledger'/);
  assert.match(databaseSource, /ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'CLP'/);
  assert.match(databaseSource, /ALTER TABLE payment_methods ADD COLUMN usd_credit_limit_cents INTEGER/);
  assert.match(databaseSource, /ALTER TABLE credit_card_adjustments ADD COLUMN currency TEXT NOT NULL DEFAULT 'CLP'/);

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(fixtureSql);
    const before = database.prepare('SELECT COUNT(*) count, COALESCE(SUM(amount), 0) total FROM expenses').get();
    database.exec(`
      CREATE TABLE IF NOT EXISTS credit_card_adjustments (
        id INTEGER PRIMARY KEY, payment_method_id INTEGER NOT NULL, amount INTEGER NOT NULL,
        date TEXT NOT NULL, time TEXT NOT NULL DEFAULT '12:00', kind TEXT NOT NULL, note TEXT
      );
      ALTER TABLE expenses ADD COLUMN currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD'));
      ALTER TABLE payment_methods ADD COLUMN usd_credit_limit_cents INTEGER;
      ALTER TABLE credit_card_adjustments ADD COLUMN currency TEXT NOT NULL DEFAULT 'CLP' CHECK (currency IN ('CLP', 'USD'));
      PRAGMA user_version = 30;
    `);

    assert.deepEqual(
      { ...database.prepare('SELECT COUNT(*) count, COALESCE(SUM(amount), 0) total FROM expenses').get() },
      { ...before }
    );
    assert.equal(database.prepare("SELECT COUNT(*) count FROM expenses WHERE currency != 'CLP'").get().count, 0);
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 30);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('USD card balances are calculated independently from CLP balances', () => {
  assert.match(databaseSource, /charge\.currency = 'CLP'/);
  assert.match(databaseSource, /charge\.currency = 'USD'/);
  assert.match(databaseSource, /usdCreditLimitCents - usdRegisteredChargesCents \+ usdRegisteredPaymentsCents \+ usdRegisteredAdjustmentsCents/);
  assert.match(databaseSource, /data\.currency \?\? 'CLP'/);
});
