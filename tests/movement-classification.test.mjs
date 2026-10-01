import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  clpSpendingExpenseSql,
  isSpendingExpense,
  spendingExpenseSql,
} from '../lib/movement-classification.ts';

test('card payments are balance movements, not spending expenses', () => {
  assert.equal(isSpendingExpense({ creditPaymentTargetId: null }), true);
  assert.equal(isSpendingExpense({ creditPaymentTargetId: 9 }), false);
});

test('period spending SQL excludes card payments from totals', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        amount INTEGER NOT NULL,
        credit_payment_target_id INTEGER
      );
      INSERT INTO expenses VALUES (1, 40000, NULL);
      INSERT INTO expenses VALUES (2, 25000, 7);
    `);

    const result = database.prepare(
      `SELECT SUM(expense.amount) AS total
       FROM expenses expense
       WHERE ${spendingExpenseSql('expense')}`
    ).get();

    assert.equal(result.total, 40000);
  } finally {
    database.close();
  }
});

test('peso totals exclude USD purchases without hiding them from the ledger', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, amount INTEGER NOT NULL,
        credit_payment_target_id INTEGER, currency TEXT NOT NULL
      );
      INSERT INTO expenses VALUES (1, 40000, NULL, 'CLP');
      INSERT INTO expenses VALUES (2, 999900, NULL, 'USD');
    `);
    const total = database.prepare(
      `SELECT SUM(expense.amount) AS total FROM expenses expense
       WHERE ${clpSpendingExpenseSql('expense')}`
    ).get().total;
    const visible = database.prepare(
      `SELECT COUNT(*) AS count FROM expenses expense
       WHERE ${spendingExpenseSql('expense')}`
    ).get().count;
    assert.equal(total, 40000);
    assert.equal(visible, 2);
  } finally {
    database.close();
  }
});

test('spending SQL only accepts safe table aliases', () => {
  assert.equal(spendingExpenseSql(), 'credit_payment_target_id IS NULL');
  assert.equal(clpSpendingExpenseSql(), "credit_payment_target_id IS NULL AND currency = 'CLP'");
  assert.throws(() => spendingExpenseSql('expense; DROP TABLE expenses'));
});
