import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  isMovementCoveredByBalanceSnapshot,
  paymentMethodAfterSnapshotSql,
  resolveBalanceTrackingStartDate,
} from '../lib/balance-snapshot.ts';

test('a movement before a reported balance is already covered', () => {
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-14', 30, {
    date: '2026-09-15',
    movementAnchorId: 25,
  }), true);
});

test('same-day movements use their anchor order instead of the date alone', () => {
  const boundary = { date: '2026-09-15', movementAnchorId: 25 };
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-15', 25, boundary), true);
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-15', 26, boundary), false);
});

test('a movement after a reported balance changes the current amount', () => {
  assert.equal(isMovementCoveredByBalanceSnapshot('2026-09-16', 10, {
    date: '2026-09-15',
    movementAnchorId: 25,
  }), false);
});

test('tracking starts on the reported balance date independently of historical creation', () => {
  assert.equal(resolveBalanceTrackingStartDate('2026-09-15'), '2026-09-15');
});

test('a card payment after a backdated snapshot changes the running total', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE payment_methods (
        id INTEGER PRIMARY KEY,
        balance_updated_at TEXT,
        balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        credit_payment_target_id INTEGER,
        amount INTEGER,
        date TEXT
      );
      INSERT INTO payment_methods VALUES (1, '2026-08-25', 0);
      INSERT INTO expenses VALUES (1, 1, 50000, '2026-08-26');
    `);
    const row = database.prepare(`
      SELECT COALESCE((
        SELECT SUM(payment.amount) FROM expenses payment
        WHERE payment.credit_payment_target_id = method.id
          AND ${paymentMethodAfterSnapshotSql('payment.date', 'payment.id', 'balance_payment_anchor_id')}
      ), 0) AS registered_payments
      FROM payment_methods method WHERE id = 1
    `).get();
    assert.equal(row.registered_payments, 50_000);
  } finally {
    database.close();
  }
});

test('payment-method movements before a snapshot are covered but later same-day ones count', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE payment_methods (
        id INTEGER PRIMARY KEY,
        balance_updated_at TEXT,
        balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        credit_payment_target_id INTEGER,
        amount INTEGER,
        date TEXT
      );
      INSERT INTO payment_methods VALUES (1, '2026-09-15', 2);
      INSERT INTO expenses VALUES
        (1, 1, 10000, '2026-09-14'),
        (2, 1, 20000, '2026-09-15'),
        (3, 1, 30000, '2026-09-15'),
        (4, 1, 40000, '2026-09-16');
    `);
    const row = database.prepare(`
      SELECT COALESCE(SUM(payment.amount), 0) AS registered_payments
      FROM payment_methods method JOIN expenses payment
        ON payment.credit_payment_target_id = method.id
      WHERE method.id = 1
        AND ${paymentMethodAfterSnapshotSql('payment.date', 'payment.id', 'balance_payment_anchor_id')}
    `).get();
    assert.equal(row.registered_payments, 70_000);
  } finally {
    database.close();
  }
});

test('without a payment-method snapshot card payments still count', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE payment_methods (
        id INTEGER PRIMARY KEY,
        balance_updated_at TEXT,
        balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY,
        credit_payment_target_id INTEGER,
        amount INTEGER,
        date TEXT
      );
      INSERT INTO payment_methods VALUES (1, NULL, 0);
      INSERT INTO expenses VALUES (1, 1, 80000, '2026-08-26');
    `);
    const row = database.prepare(`
      SELECT COALESCE((
        SELECT SUM(payment.amount) FROM expenses payment
        WHERE payment.credit_payment_target_id = method.id
          AND ${paymentMethodAfterSnapshotSql('payment.date', 'payment.id', 'balance_payment_anchor_id')}
      ), 0) AS registered_payments
      FROM payment_methods method WHERE id = 1
    `).get();
    assert.equal(row.registered_payments, 80_000);
  } finally {
    database.close();
  }
});
