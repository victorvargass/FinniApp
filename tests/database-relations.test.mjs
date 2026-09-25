import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import { repairRecoverableDatabaseRelations } from '../lib/database-relations.ts';

function asyncAdapter(database) {
  return {
    async getAllAsync(source, ...params) {
      return database.prepare(source).all(...params);
    },
    async runAsync(source, ...params) {
      return database.prepare(source).run(...params);
    },
  };
}

function createDatabase() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    PRAGMA foreign_keys = OFF;
    CREATE TABLE periods (id INTEGER PRIMARY KEY);
    CREATE TABLE categories (id INTEGER PRIMARY KEY);
    CREATE TABLE payment_methods (id INTEGER PRIMARY KEY);
    CREATE TABLE expenses (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      period_id INTEGER NOT NULL REFERENCES periods(id),
      credit_payment_target_id INTEGER REFERENCES payment_methods(id)
    );
    CREATE TABLE savings_goals (id INTEGER PRIMARY KEY);
    CREATE TABLE incomes (id INTEGER PRIMARY KEY);
    CREATE TABLE savings_goal_movements (
      id INTEGER PRIMARY KEY,
      goal_id INTEGER NOT NULL REFERENCES savings_goals(id),
      expense_id INTEGER REFERENCES expenses(id),
      income_id INTEGER REFERENCES incomes(id)
    );
    INSERT INTO periods (id) VALUES (1);
  `);
  return database;
}

test('repairs an optional orphan without deleting its financial movement', async () => {
  const database = createDatabase();
  try {
    database.exec(`
      INSERT INTO expenses (id, name, amount, category_id, period_id, credit_payment_target_id)
      VALUES (1, 'Compra conservada', 25000, 999, 1, 888);
      PRAGMA foreign_keys = ON;
    `);

    await repairRecoverableDatabaseRelations(asyncAdapter(database));

    const expense = database.prepare(
      'SELECT name, amount, category_id, credit_payment_target_id FROM expenses WHERE id = 1'
    ).get();
    assert.deepEqual({ ...expense }, {
      name: 'Compra conservada',
      amount: 25000,
      category_id: null,
      credit_payment_target_id: null,
    });
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('removes only an orphaned association while preserving its expense', async () => {
  const database = createDatabase();
  try {
    database.exec(`
      INSERT INTO expenses (id, name, amount, period_id)
      VALUES (1, 'Ahorro conservado', 40000, 1);
      INSERT INTO savings_goal_movements (id, goal_id, expense_id)
      VALUES (1, 999, 1);
      PRAGMA foreign_keys = ON;
    `);

    await repairRecoverableDatabaseRelations(asyncAdapter(database));

    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM expenses').get().count, 1);
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM savings_goal_movements').get().count, 0);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    database.close();
  }
});

test('does not hide an unsafe missing period from strict backup validation', async () => {
  const database = createDatabase();
  try {
    database.exec(`
      INSERT INTO expenses (id, name, amount, period_id)
      VALUES (1, 'Movimiento inseguro', 10000, 999);
      PRAGMA foreign_keys = ON;
    `);

    await repairRecoverableDatabaseRelations(asyncAdapter(database));

    const violations = database.prepare('PRAGMA foreign_key_check').all();
    assert.equal(violations.length, 1);
    assert.equal(violations[0].table, 'expenses');
    assert.equal(database.prepare('SELECT COUNT(*) AS count FROM expenses').get().count, 1);
  } finally {
    database.close();
  }
});
