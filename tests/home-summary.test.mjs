import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { UNBILLED_CREDIT_CARD_TOTAL_SQL } from '../lib/home-summary.ts';

test('unbilled credit total includes only visible single-payment purchases after the latest cycle', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE payment_methods (
        id INTEGER PRIMARY KEY, type TEXT, active INTEGER, show_on_home INTEGER
      );
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY, amount INTEGER, original_amount INTEGER,
        payment_method_id INTEGER, debt_plan_id INTEGER, credit_payment_target_id INTEGER,
        date TEXT
      );
      CREATE TABLE credit_card_cycles (
        id INTEGER PRIMARY KEY, payment_method_id INTEGER, end_date TEXT
      );
      CREATE TABLE credit_card_adjustments (
        id INTEGER PRIMARY KEY, payment_method_id INTEGER, amount INTEGER, date TEXT
      );
      INSERT INTO payment_methods VALUES
        (1, 'credit', 1, 1),
        (2, 'credit', 1, 0),
        (3, 'debit', 1, 1);
      INSERT INTO credit_card_cycles VALUES (1, 1, '2020-01-15');
      INSERT INTO expenses VALUES
        (1, 5000, NULL, 1, NULL, NULL, '2020-01-10'),
        (2, 7000, NULL, 1, NULL, NULL, '2020-01-20'),
        (3, 3000, 9000, 1, NULL, NULL, '2020-01-21'),
        (4, 4000, NULL, 1, 99, NULL, '2020-01-22'),
        (5, 6000, NULL, 2, NULL, NULL, '2020-01-22'),
        (6, 8000, NULL, 3, NULL, NULL, '2020-01-22');
      INSERT INTO credit_card_adjustments VALUES (1, 1, 2000, '2020-01-23');
    `);

    const row = database.prepare(UNBILLED_CREDIT_CARD_TOTAL_SQL).get();
    assert.equal(row.total, 14000);
  } finally {
    database.close();
  }
});
