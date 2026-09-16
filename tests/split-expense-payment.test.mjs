import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { paymentOutflowSql } from '../lib/expense-amounts.ts';
import { calculateAvailableBalance } from '../lib/payment-method-calculations.ts';
import { reconcileLegacySplitCardCycles } from '../lib/split-expense-migration.ts';

function migrationDatabase(database) {
  return {
    getAllAsync: async (source) => database.prepare(source).all(),
    getFirstAsync: async (source, ...params) => database.prepare(source).get(...params) ?? null,
    runAsync: async (source, ...params) => {
      const result = database.prepare(source).run(...params);
      return { lastInsertRowId: Number(result.lastInsertRowid) };
    },
  };
}

test('a split purchase charges the full amount to every kind of payment method', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        payment_method_id INTEGER,
        amount INTEGER NOT NULL,
        original_amount INTEGER
      );
      INSERT INTO expenses VALUES (1, 1, 3745, 7490);
      INSERT INTO expenses VALUES (2, 2, 3745, 7490);
      INSERT INTO expenses VALUES (3, 3, 3745, 7490);
      INSERT INTO expenses VALUES (4, 4, 3745, 7490);
      INSERT INTO expenses VALUES (5, 1, 1000, NULL);
    `);

    for (const [type, methodId] of [['cash', 1], ['debit', 2], ['prepaid', 3], ['credit', 4]]) {
      const row = database.prepare(`
        SELECT SUM(expense.amount) AS personal_spending,
               SUM(${paymentOutflowSql('expense')}) AS account_outflow
        FROM expenses expense WHERE expense.payment_method_id = ?
      `).get(methodId);
      assert.equal(row.personal_spending, methodId === 1 ? 4745 : 3745, type);
      assert.equal(row.account_outflow, methodId === 1 ? 8490 : 7490, type);
      assert.equal(calculateAvailableBalance(20_000, row.account_outflow, 0),
        methodId === 1 ? 11_510 : 12_510, type);
    }
  } finally {
    database.close();
  }
});

test('payment outflow SQL rejects unsafe table aliases', () => {
  assert.throws(() => paymentOutflowSql('expense; DROP TABLE expenses'), /alias/);
});

test('older card reconciliation removes the duplicate difference from a split purchase', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE periods (id INTEGER PRIMARY KEY, start_date TEXT, end_date TEXT);
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, name TEXT, amount INTEGER, category_id INTEGER,
        period_id INTEGER, date TEXT, original_amount INTEGER, split_percentage REAL,
        payment_method_id INTEGER, recurring_expense_id INTEGER
      );
      CREATE TABLE credit_card_cycles (
        id INTEGER PRIMARY KEY, payment_method_id INTEGER, start_date TEXT, end_date TEXT,
        statement_amount INTEGER, status TEXT, adjustment_expense_id INTEGER
      );
      INSERT INTO periods VALUES (1, '2026-09-01', '2026-09-30');
      INSERT INTO expenses (id, name, amount, period_id, date, original_amount, payment_method_id)
        VALUES (1, 'McDonalds', 3745, 1, '2026-09-15', 7490, 1);
      INSERT INTO expenses (id, name, amount, period_id, date, payment_method_id)
        VALUES (2, 'Diferencia de facturación', 3745, 1, '2026-09-19', 1);
      INSERT INTO credit_card_cycles VALUES (1, 1, '2026-09-01', '2026-09-19', 7490, 'reconciled', 2);
    `);

    await reconcileLegacySplitCardCycles(migrationDatabase(database), 'Diferencia de facturación');

    assert.equal(database.prepare('SELECT adjustment_expense_id FROM credit_card_cycles').get().adjustment_expense_id, null);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM expenses').get().count, 1);
    assert.equal(database.prepare(`SELECT SUM(${paymentOutflowSql('expense')}) AS total FROM expenses expense`).get().total, 7490);
    assert.equal(database.prepare('SELECT SUM(amount) AS total FROM expenses').get().total, 3745);
  } finally {
    database.close();
  }
});

test('older reconciled cycle without a difference remains equal to its statement', async () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE periods (id INTEGER PRIMARY KEY, start_date TEXT, end_date TEXT);
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, name TEXT, amount INTEGER, category_id INTEGER,
        period_id INTEGER, date TEXT, original_amount INTEGER, split_percentage REAL,
        payment_method_id INTEGER, recurring_expense_id INTEGER
      );
      CREATE TABLE credit_card_cycles (
        id INTEGER PRIMARY KEY, payment_method_id INTEGER, start_date TEXT, end_date TEXT,
        statement_amount INTEGER, status TEXT, adjustment_expense_id INTEGER
      );
      INSERT INTO periods VALUES (1, '2026-09-01', '2026-09-30');
      INSERT INTO expenses (id, name, amount, period_id, date, original_amount, payment_method_id)
        VALUES (1, 'McDonalds', 3745, 1, '2026-09-15', 7490, 1);
      INSERT INTO credit_card_cycles VALUES (1, 1, '2026-09-01', '2026-09-19', 3745, 'reconciled', NULL);
    `);

    await reconcileLegacySplitCardCycles(migrationDatabase(database), 'Diferencia de facturación');

    const newAdjustmentId = database.prepare('SELECT adjustment_expense_id FROM credit_card_cycles').get().adjustment_expense_id;
    assert.ok(newAdjustmentId);
    assert.equal(database.prepare('SELECT amount FROM expenses WHERE id = ?').get(newAdjustmentId).amount, -3745);
    assert.equal(database.prepare(`SELECT SUM(${paymentOutflowSql('expense')}) AS total FROM expenses expense`).get().total, 3745);
  } finally {
    database.close();
  }
});
