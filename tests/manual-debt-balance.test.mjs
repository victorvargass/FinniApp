import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  MANUAL_DEBT_BALANCE_AT_DATE_SQL,
  manualDebtBalanceAtDateParams,
} from '../lib/manual-debt-balance.ts';

function debtDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE manual_debts (
      id INTEGER PRIMARY KEY,
      initial_amount INTEGER NOT NULL,
      balance_updated_at TEXT,
      balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE manual_debt_entries (
      id INTEGER PRIMARY KEY,
      debt_id INTEGER NOT NULL,
      kind TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date TEXT NOT NULL,
      reported_balance INTEGER,
      payment_anchor_id INTEGER NOT NULL DEFAULT 0
    );
  `);
  return database;
}

function balanceAt(database, debtId, date) {
  const row = database.prepare(MANUAL_DEBT_BALANCE_AT_DATE_SQL)
    .get(...manualDebtBalanceAtDateParams(debtId, date));
  return Math.max(0, Number(row.balance));
}

test('debt payments before a reported balance do not reduce it again', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000, '2026-09-15', 2);
      INSERT INTO manual_debt_entries VALUES (1, 1, 'payment', 200, '2026-09-14', NULL, 0);
      INSERT INTO manual_debt_entries VALUES (2, 1, 'payment', 100, '2026-09-15', NULL, 0);
    `);
    assert.equal(balanceAt(database, 1, '2026-09-16'), 1000);
  } finally {
    database.close();
  }
});

test('a later same-day debt payment is applied after the synchronization anchor', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000, '2026-09-15', 2);
      INSERT INTO manual_debt_entries VALUES (2, 1, 'payment', 100, '2026-09-15', NULL, 0);
      INSERT INTO manual_debt_entries VALUES (3, 1, 'payment', 150, '2026-09-15', NULL, 0);
    `);
    assert.equal(balanceAt(database, 1, '2026-09-15'), 850);
  } finally {
    database.close();
  }
});

test('the latest dated debt synchronization wins over a later inserted backdated one', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000, '2026-09-15', 0);
      INSERT INTO manual_debt_entries VALUES (4, 1, 'adjustment', -200, '2026-09-20', 800, 0);
      INSERT INTO manual_debt_entries VALUES (5, 1, 'adjustment', -100, '2026-09-18', 900, 0);
    `);
    assert.equal(balanceAt(database, 1, '2026-09-21'), 800);
  } finally {
    database.close();
  }
});

test('a payment after historical debt creation but before the reported balance does not reduce it again', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000000, '2026-09-15', 0);
      INSERT INTO manual_debt_entries VALUES (1, 1, 'payment', 150000, '2026-08-26', NULL, 0);
    `);
    assert.equal(balanceAt(database, 1, '2026-09-15'), 1000000);
  } finally {
    database.close();
  }
});

test('a payment after the reported debt balance reduces it, regardless of creation date', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000000, '2026-09-15', 0);
      INSERT INTO manual_debt_entries VALUES (1, 1, 'payment', 150000, '2026-09-16', NULL, 0);
    `);
    assert.equal(balanceAt(database, 1, '2026-09-16'), 850000);
  } finally {
    database.close();
  }
});

test('editing a payment excludes its previous amount when checking the balance at its date', () => {
  const database = debtDatabase();
  try {
    database.exec(`
      INSERT INTO manual_debts VALUES (1, 1000, '2026-09-15', 0);
      INSERT INTO manual_debt_entries VALUES (1, 1, 'payment', 400, '2026-09-16', NULL, 0);
    `);
    const row = database.prepare(MANUAL_DEBT_BALANCE_AT_DATE_SQL)
      .get(...manualDebtBalanceAtDateParams(1, '2026-09-16', 1));
    assert.equal(Number(row.balance), 1000);
  } finally {
    database.close();
  }
});
