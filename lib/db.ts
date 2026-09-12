import * as SQLite from 'expo-sqlite';
import { t } from './i18n';

import { withDatabaseLock } from './database-lock';
import {
  DATABASE_APPLICATION_ID,
  DATABASE_NAME,
} from './database-schema';
import { calculateInstallmentAmounts, calculateNextPeriodDates } from './financial-calculations';
import { calculateAvailableBalance } from './payment-method-calculations';
import { recordAppliedSchema } from './schema-migrations';
import { addIsoDays, addIsoMonths, getNextOccurrenceDate, getOccurrenceDates } from './recurrence';
import { VIRTUAL_SAVINGS_PAYMENT_METHOD_ID } from './types';
import type {
  AccountTransfer,
  Category,
  CreditCardCycle,
  DebtPlan,
  ExpenseWithCategory,
  GeneratedRecurringExpenseNotification,
  Income,
  Debt,
  DebtEntry,
  NewCategory,
  NewAccountTransfer,
  NewCreditCardCycle,
  NewExpense,
  NewIncome,
  NewInstallmentPurchase,
  NewDebt,
  NewDebtBalance,
  NewDebtPayment,
  NewPaymentMethod,
  NewPaymentMethodBalance,
  NewPeriod,
  NewRecurringExpense,
  NewRecurringIncome,
  NewRecurringSchedule,
  NewSavingsGoal,
  NewSavingsGoalBalance,
  PaymentMethod,
  PaymentMethodMovement,
  PaymentMethodTotal,
  Period,
  PeriodCategoryExpensesTotals,
  PeriodHistory,
  PeriodFinancialDetails,
  PeriodStatement,
  ReconcileCreditCardCycle,
  RecurringConfirmationSchedule,
  RecurringDecisionItem,
  RecurringExpense,
  RecurringIncome,
  RecurringOccurrenceStatus,
  SavingsExpenseKind,
  SavingsGoal,
  SavingsGoalMovement,
  SavingsGoalPeriodActivity,
  Settings,
} from './types';

const DATABASE_BUSY_TIMEOUT_MS = 5000;

const RESERVED_COLORS = [
  '#008000', // Verde estándar para ingresos
];

// Utilidad para comparar colores en minúsculas y sin espacios
function normalizeColor(color: string): string {
  return color.trim().toLowerCase();
}

const DEFAULT_CATEGORIES: NewCategory[] = [
  { name: t('database.defaultCategories.food'), color: '#e74c3c', periodLimit: null },
  { name: t('database.defaultCategories.transport'), color: '#3498db', periodLimit: null },
  { name: t('database.defaultCategories.bills'), color: '#34495e', periodLimit: null },
  { name: t('database.defaultCategories.savings'), color: '#27ae60', periodLimit: null, purpose: 'savings' },
  { name: t('database.defaultCategories.creditPayment'), color: '#d88916', periodLimit: null, systemKey: 'credit_payment' },
  { name: t('database.defaultCategories.health'), color: '#1abc9c', periodLimit: null },
  { name: t('database.defaultCategories.fun'), color: '#9b59b6', periodLimit: null },
  { name: t('database.defaultCategories.pets'), color: '#e67e22', periodLimit: null },
  { name: t('database.defaultCategories.extras'), color: '#95a5a6', periodLimit: null },
  { name: t('database.defaultCategories.home'), color: '#2ecc71', periodLimit: null },
  { name: t('database.defaultCategories.subscriptions'), color: '#8e44ad', periodLimit: null },
  { name: t('database.defaultCategories.clothing'), color: '#d35400', periodLimit: null },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<void> | null = null;
let closePeriodPromise: Promise<Period> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS};
        PRAGMA foreign_keys = ON;
      `);
      return database;
    }).catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  return getDatabase();
}

async function withExclusiveTransaction(
  database: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  await withDatabaseLock(async () => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      // Expo opens a separate connection for exclusive transactions, so the
      // connection-level busy timeout must also be configured here.
      await transaction.execAsync(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
      await task(transaction);
    });
  });
}

async function needsSchemaMigration(
  db: SQLite.SQLiteDatabase
): Promise<boolean> {
  const categoriesTable =
    await db.getFirstAsync<{ sql: string }>(
      `
      SELECT sql
      FROM sqlite_master
      WHERE type='table'
      AND name='categories'
      `
    );

  if (!categoriesTable?.sql) {
    return false;
  }

  const hasUniqueColor =
    categoriesTable.sql.includes(
      'color TEXT NOT NULL UNIQUE'
    );

  const expenseColumns =
    await db.getAllAsync<{
      name: string;
      notnull: number;
    }>(
      'PRAGMA table_info(expenses)'
    );

  const incomeColumns =
    await db.getAllAsync<{
      name: string;
      notnull: number;
    }>(
      'PRAGMA table_info(incomes)'
    );

  const categoryColumn =
    expenseColumns.find(
      c => c.name === 'category_id'
    );

  const expensePeriodColumn =
    expenseColumns.find(
      c => c.name === 'period_id'
    );

  const incomePeriodColumn =
    incomeColumns.find(
      c => c.name === 'period_id'
    );

  const settingsTable =
    await db.getFirstAsync(
      `
      SELECT name
      FROM sqlite_master
      WHERE type='table'
      AND name='settings'
      `
    );

  const settingsColumns =
    await db.getAllAsync<{
      name: string;
    }>('PRAGMA table_info(settings)');

  const currentPeriodColumn = settingsColumns.find(
    c => c.name === 'current_period_id'
  );

  return (
    !hasUniqueColor ||
    categoryColumn?.notnull !== 0 ||
    !expensePeriodColumn ||
    !incomePeriodColumn ||
    !settingsTable ||
    !currentPeriodColumn
  );
}

async function migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
  const settingsColumns =
    await db.getAllAsync<{
      name: string;
    }>('PRAGMA table_info(settings)');

  const canCopyCurrentPeriod = settingsColumns.some(
    column => column.name === 'current_period_id'
  );

  const copySettings = canCopyCurrentPeriod
    ? `
      INSERT INTO settings_new (id, current_period_id)
      SELECT id, current_period_id FROM settings;
    `
    : '';

  await db.execAsync(`
    PRAGMA foreign_keys = OFF;

    -- Crear la tabla periods con los campos necesarios
    CREATE TABLE periods_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );

    CREATE TABLE settings_new (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_period_id INTEGER,
      FOREIGN KEY (current_period_id)
          REFERENCES periods(id)
          ON DELETE SET NULL
    );

    CREATE TABLE categories_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL UNIQUE DEFAULT '#0a7ea4',
      period_limit INTEGER
    );

    CREATE TABLE expenses_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category_id INTEGER,
      period_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      original_amount INTEGER,
      split_percentage REAL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    );

    CREATE TABLE incomes_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY (period_id) REFERENCES periods(id)
    );

    -- Insertar datos existentes de periods si existía la tabla
    INSERT INTO periods_new (id, start_date, end_date)
    SELECT id, start_date, end_date FROM periods
    WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='periods');

    ${copySettings}

    INSERT INTO categories_new (id, name, color, period_limit)
    SELECT id, name, color, period_limit FROM categories;

    INSERT INTO expenses_new (id, name, amount, category_id, period_id, date)
    SELECT id, name, amount, category_id, 1, date FROM expenses;

    INSERT INTO incomes_new (id, name, amount, period_id, date)
    SELECT id, name, amount, 1, date FROM incomes;

    DROP TABLE IF EXISTS expenses;
    DROP TABLE IF EXISTS incomes;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS periods;
    DROP TABLE IF EXISTS settings;

    ALTER TABLE categories_new RENAME TO categories;
    ALTER TABLE expenses_new RENAME TO expenses;
    ALTER TABLE incomes_new RENAME TO incomes;
    ALTER TABLE periods_new RENAME TO periods;
    ALTER TABLE settings_new RENAME TO settings;

    PRAGMA foreign_keys = ON;
  `);
}

async function assertUniqueCategoryFields(
  db: SQLite.SQLiteDatabase,
  data: NewCategory,
  excludeId?: number
): Promise<void> {
  // Validación para no permitir colores reservados (por ejemplo, el verde de ingresos)
  const colorNormalized = normalizeColor(data.color);
  if (RESERVED_COLORS.map(normalizeColor).includes(colorNormalized)) {
    throw new Error(t('database.reservedIncomeColor'));
  }

  const nameRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? AND id != ?',
    data.name.trim(),
    excludeId ?? -1
  );
  if (nameRow) {
    throw new Error(t('database.categoryNameExists'));
  }

  const colorRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE color = ? AND id != ?',
    colorNormalized,
    excludeId ?? -1
  );
  if (colorRow) {
    throw new Error(t('database.categoryColorExists'));
  }
}

function recurringExecutionDay(date: string, frequency: RecurringExpense['frequency']): number | null {
  if (frequency !== 'monthly' && frequency !== 'custom') return null;
  return Number(date.slice(8, 10));
}

async function syncRecurringSourceExpenses(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.runAsync(`
    UPDATE recurring_expenses
    SET source_expense_id = (
      SELECT occurrence.expense_id
      FROM recurring_expense_occurrences occurrence
      WHERE occurrence.recurring_expense_id = recurring_expenses.id
        AND occurrence.scheduled_date = recurring_expenses.start_date
        AND occurrence.status = 'generated'
        AND occurrence.expense_id IS NOT NULL
      ORDER BY occurrence.id ASC
      LIMIT 1
    )
    WHERE source_expense_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM recurring_expense_occurrences occurrence
        WHERE occurrence.recurring_expense_id = recurring_expenses.id
          AND occurrence.scheduled_date = recurring_expenses.start_date
          AND occurrence.status = 'generated'
          AND occurrence.expense_id IS NOT NULL
      )
  `);

  const sources = await db.getAllAsync<{
    id: number;
    frequency: RecurringExpense['frequency'];
    start_date: string;
    source_expense_id: number;
    name: string;
    amount: number;
    original_amount: number | null;
    split_percentage: number | null;
    category_id: number | null;
    payment_method_id: number | null;
    savings_goal_id: number | null;
    savings_kind: string | null;
    date: string;
  }>(`
    SELECT
      recurring.id,
      recurring.frequency,
      recurring.start_date,
      recurring.source_expense_id,
      expense.name,
      expense.amount,
      expense.original_amount,
      expense.split_percentage,
      expense.category_id,
      expense.payment_method_id,
      savingsMovement.goal_id AS savings_goal_id,
      savingsMovement.kind AS savings_kind,
      expense.date
    FROM recurring_expenses recurring
    INNER JOIN expenses expense ON expense.id = recurring.source_expense_id
    LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.expense_id = expense.id
  `);

  for (const source of sources) {
    await withExclusiveTransaction(db, async (transaction) => {
      if (source.date !== source.start_date) {
        const collision = await transaction.getFirstAsync<{ id: number }>(
          `SELECT id FROM recurring_expense_occurrences
           WHERE recurring_expense_id = ? AND scheduled_date = ? AND expense_id != ?`,
          source.id,
          source.date,
          source.source_expense_id
        );
        if (!collision) {
          await transaction.runAsync(
            `UPDATE recurring_expense_occurrences
             SET scheduled_date = ?, updated_at = CURRENT_TIMESTAMP
             WHERE recurring_expense_id = ? AND expense_id = ?`,
            source.date,
            source.id,
            source.source_expense_id
          );
          await transaction.runAsync(
            `DELETE FROM recurring_expense_occurrences
             WHERE recurring_expense_id = ? AND status != 'generated'`,
            source.id
          );
        }
      }

      await transaction.runAsync(
        `UPDATE recurring_expenses SET
          name = ?, amount = ?, original_amount = ?, split_percentage = ?,
          category_id = ?, payment_method_id = ?, savings_goal_id = ?, savings_kind = ?,
          start_date = CASE
            WHEN NOT EXISTS (
              SELECT 1 FROM recurring_expense_occurrences
              WHERE recurring_expense_id = ? AND scheduled_date = ? AND expense_id != ?
            ) THEN ? ELSE start_date END,
          execution_day = ?,
          end_date = CASE WHEN end_date IS NOT NULL AND end_date < ? THEN ? ELSE end_date END,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        source.name,
        source.amount,
        source.original_amount,
        source.split_percentage,
        source.category_id,
        source.payment_method_id,
        source.savings_kind === 'contribution' ? source.savings_goal_id : null,
        source.savings_kind === 'contribution' ? 'contribution' : null,
        source.id,
        source.date,
        source.source_expense_id,
        source.date,
        recurringExecutionDay(source.date, source.frequency),
        source.date,
        source.date,
        source.id
      );
    });
  }
}

async function initializeDatabase(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
    PRAGMA application_id = ${DATABASE_APPLICATION_ID};
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS periods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_period_id INTEGER,
      default_payment_method_id INTEGER,
      movement_reminder_enabled INTEGER NOT NULL DEFAULT 0,
      movement_reminder_frequency TEXT NOT NULL DEFAULT 'daily',
      movement_reminder_weekday INTEGER NOT NULL DEFAULT 1,
      movement_reminder_hour INTEGER NOT NULL DEFAULT 21,
      movement_reminder_minute INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (current_period_id) REFERENCES periods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL UNIQUE DEFAULT '#0a7ea4',
      period_limit INTEGER,
      purpose TEXT NOT NULL DEFAULT 'general' CHECK (purpose IN ('general', 'savings')),
      system_key TEXT UNIQUE CHECK (system_key IS NULL OR system_key IN ('savings', 'credit_payment'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      category_id INTEGER,
      period_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      original_amount INTEGER,
      split_percentage REAL,
      credit_payment_target_id INTEGER,

      FOREIGN KEY(category_id)
          REFERENCES categories(id)
          ON DELETE RESTRICT,

      FOREIGN KEY(period_id)
          REFERENCES periods(id),

      FOREIGN KEY(credit_payment_target_id)
          REFERENCES payment_methods(id)
          ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      payment_method_id INTEGER,
      FOREIGN KEY(period_id) REFERENCES periods(id),
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('cash', 'debit', 'prepaid', 'credit')),
      system_key TEXT CHECK (system_key IS NULL OR system_key = 'cash'),
      billing_day INTEGER,
      color TEXT NOT NULL DEFAULT '#0a7ea4',
      active INTEGER NOT NULL DEFAULT 1,
      credit_limit INTEGER,
      reported_balance INTEGER,
      balance_updated_at TEXT,
      balance_synced_at TEXT,
      balance_expense_anchor_id INTEGER NOT NULL DEFAULT 0,
      balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0,
      balance_income_anchor_id INTEGER NOT NULL DEFAULT 0,
      balance_debt_plan_anchor_id INTEGER NOT NULL DEFAULT 0,
      balance_transfer_anchor_id INTEGER NOT NULL DEFAULT 0,
      payment_due_day INTEGER
    );

    CREATE TABLE IF NOT EXISTS account_transfers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_payment_method_id INTEGER NOT NULL,
      destination_payment_method_id INTEGER NOT NULL,
      amount INTEGER NOT NULL CHECK (amount > 0),
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (source_payment_method_id != destination_payment_method_id),
      FOREIGN KEY(source_payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT,
      FOREIGN KEY(destination_payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS credit_card_cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_method_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      statement_amount INTEGER,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reconciled')),
      bank_charge_expense_id INTEGER,
      adjustment_expense_id INTEGER,
      reconciled_at TEXT,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      original_amount INTEGER,
      split_percentage REAL,
      category_id INTEGER,
      payment_method_id INTEGER,
      frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'annual', 'custom')),
      interval_months INTEGER NOT NULL DEFAULT 1,
      execution_basis TEXT NOT NULL DEFAULT 'calendar' CHECK (execution_basis = 'calendar'),
      execution_day INTEGER,
      registration_mode TEXT NOT NULL CHECK (registration_mode IN ('automatic', 'confirmation')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      source_expense_id INTEGER,
      savings_goal_id INTEGER,
      savings_kind TEXT CHECK (savings_kind IS NULL OR savings_kind = 'contribution'),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY(source_expense_id) REFERENCES expenses(id) ON DELETE SET NULL,
      FOREIGN KEY(savings_goal_id) REFERENCES savings_goals(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_expense_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_expense_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'pending', 'generated', 'skipped')),
      expense_id INTEGER,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recurring_expense_id, scheduled_date),
      FOREIGN KEY(recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE CASCADE,
      FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS debt_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL DEFAULT 'credit_installment',
      name TEXT NOT NULL,
      total_amount INTEGER NOT NULL,
      category_id INTEGER,
      payment_method_id INTEGER NOT NULL,
      purchase_date TEXT NOT NULL,
      first_due_date TEXT NOT NULL,
      total_installments INTEGER NOT NULL,
      installment_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'projected'
        CHECK (status IN ('projected', 'active', 'completed', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS debt_installments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_plan_id INTEGER NOT NULL,
      installment_number INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      projected_amount INTEGER NOT NULL,
      expense_id INTEGER,
      manually_removed INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'projected'
        CHECK (status IN ('projected', 'posted', 'cancelled')),
      UNIQUE(debt_plan_id, installment_number),
      FOREIGN KEY(debt_plan_id) REFERENCES debt_plans(id) ON DELETE CASCADE,
      FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'annual', 'custom')),
      interval_months INTEGER NOT NULL DEFAULT 1,
      execution_day INTEGER,
      registration_mode TEXT NOT NULL DEFAULT 'automatic'
        CHECK (registration_mode IN ('automatic', 'confirmation')),
      start_date TEXT NOT NULL,
      end_date TEXT,
      next_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      source_income_id INTEGER,
      payment_method_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_income_id) REFERENCES incomes(id) ON DELETE SET NULL,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS recurring_income_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_income_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'pending', 'generated', 'skipped')),
      income_id INTEGER,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recurring_income_id, scheduled_date),
      FOREIGN KEY(recurring_income_id) REFERENCES recurring_incomes(id) ON DELETE CASCADE,
      FOREIGN KEY(income_id) REFERENCES incomes(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      target_amount INTEGER NOT NULL CHECK (target_amount > 0),
      initial_amount INTEGER NOT NULL DEFAULT 0 CHECK (initial_amount >= 0),
      allow_withdrawals INTEGER NOT NULL DEFAULT 1,
      deadline TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#0a7ea4',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
      archived_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS savings_goal_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('contribution', 'withdrawal', 'funded_expense')),
      expense_id INTEGER UNIQUE,
      income_id INTEGER UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (
        (kind IN ('contribution', 'funded_expense') AND expense_id IS NOT NULL AND income_id IS NULL)
        OR (kind = 'withdrawal' AND expense_id IS NULL AND income_id IS NOT NULL)
      ),
      FOREIGN KEY(goal_id) REFERENCES savings_goals(id) ON DELETE RESTRICT,
      FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY(income_id) REFERENCES incomes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS savings_goal_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      amount INTEGER NOT NULL CHECK (amount != 0),
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(goal_id) REFERENCES savings_goals(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS manual_debts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
      name TEXT NOT NULL,
      creditor TEXT,
      initial_amount INTEGER NOT NULL CHECK (initial_amount > 0),
      installment_amount INTEGER,
      frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'annual')),
      first_due_date TEXT,
      category_id INTEGER,
      payment_method_id INTEGER,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'archived')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS manual_debt_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      debt_id INTEGER NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('payment', 'adjustment')),
      amount INTEGER NOT NULL CHECK (amount != 0),
      date TEXT NOT NULL,
      period_id INTEGER,
      expense_id INTEGER UNIQUE,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(debt_id) REFERENCES manual_debts(id) ON DELETE CASCADE,
      FOREIGN KEY(period_id) REFERENCES periods(id),
      FOREIGN KEY(expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

  `);

  // Existing databases can have an older expenses/incomes schema. Migrate it
  // before creating indexes or running any query that requires period_id.
  if (await needsSchemaMigration(db)) {
    await migrateSchema(db);
  }

  const expenseColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(expenses)'
  );
  if (!expenseColumns.some((column) => column.name === 'original_amount')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN original_amount INTEGER;');
  }
  if (!expenseColumns.some((column) => column.name === 'split_percentage')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN split_percentage REAL;');
  }
  if (!expenseColumns.some((column) => column.name === 'payment_method_id')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN payment_method_id INTEGER;');
  }
  if (!expenseColumns.some((column) => column.name === 'recurring_expense_id')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN recurring_expense_id INTEGER;');
  }
  if (!expenseColumns.some((column) => column.name === 'debt_plan_id')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN debt_plan_id INTEGER;');
  }
  if (!expenseColumns.some((column) => column.name === 'debt_installment_id')) {
    await db.execAsync('ALTER TABLE expenses ADD COLUMN debt_installment_id INTEGER;');
  }
  if (!expenseColumns.some((column) => column.name === 'credit_payment_target_id')) {
    await db.execAsync(
      'ALTER TABLE expenses ADD COLUMN credit_payment_target_id INTEGER REFERENCES payment_methods(id) ON DELETE RESTRICT;'
    );
  }
  const incomeColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(incomes)');
  if (!incomeColumns.some((column) => column.name === 'recurring_income_id')) {
    await db.execAsync('ALTER TABLE incomes ADD COLUMN recurring_income_id INTEGER;');
  }

  const categoryColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(categories)'
  );
  if (!categoryColumns.some((column) => column.name === 'purpose')) {
    await db.execAsync(
      "ALTER TABLE categories ADD COLUMN purpose TEXT NOT NULL DEFAULT 'general' CHECK (purpose IN ('general', 'savings'));"
    );
  }
  if (!incomeColumns.some((column) => column.name === 'payment_method_id')) {
    await db.execAsync(
      'ALTER TABLE incomes ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL;'
    );
  }
  if (!categoryColumns.some((column) => column.name === 'system_key')) {
    await db.execAsync(
      "ALTER TABLE categories ADD COLUMN system_key TEXT CHECK (system_key IS NULL OR system_key IN ('savings', 'credit_payment'));"
    );
  }
  await db.execAsync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_system_key ON categories(system_key) WHERE system_key IS NOT NULL;'
  );
  await db.runAsync(
    "UPDATE categories SET purpose = 'savings' WHERE purpose = 'general' AND lower(trim(name)) = lower(?)",
    t('database.defaultCategories.savings')
  );
  await db.runAsync("UPDATE categories SET system_key = 'savings' WHERE purpose = 'savings'");
  await db.runAsync("UPDATE categories SET period_limit = NULL WHERE purpose = 'savings'");

  const savingsGoalColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(savings_goals)'
  );
  if (!savingsGoalColumns.some((column) => column.name === 'archived_at')) {
    await db.execAsync('ALTER TABLE savings_goals ADD COLUMN archived_at TEXT;');
  }
  await db.runAsync(
    "UPDATE savings_goals SET archived_at = COALESCE(archived_at, updated_at) WHERE status = 'archived'"
  );
  await db.runAsync(`
    DELETE FROM savings_goal_movements
    WHERE (expense_id IS NULL AND income_id IS NULL)
      OR (expense_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM expenses WHERE expenses.id = savings_goal_movements.expense_id
      ))
      OR (income_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM incomes WHERE incomes.id = savings_goal_movements.income_id
      ))
  `);

  const recurringExpenseColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(recurring_expenses)'
  );
  if (!recurringExpenseColumns.some((column) => column.name === 'savings_goal_id')) {
    await db.execAsync(
      'ALTER TABLE recurring_expenses ADD COLUMN savings_goal_id INTEGER REFERENCES savings_goals(id) ON DELETE SET NULL;'
    );
  }
  if (!recurringExpenseColumns.some((column) => column.name === 'savings_kind')) {
    await db.execAsync(
      "ALTER TABLE recurring_expenses ADD COLUMN savings_kind TEXT CHECK (savings_kind IS NULL OR savings_kind = 'contribution');"
    );
  }

  const recurringOccurrenceColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(recurring_expense_occurrences)'
  );
  if (!recurringOccurrenceColumns.some((column) => column.name === 'dismissed')) {
    await db.execAsync(
      'ALTER TABLE recurring_expense_occurrences ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0;'
    );
  }

  const recurringIncomeColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(recurring_incomes)'
  );
  if (!recurringIncomeColumns.some((column) => column.name === 'registration_mode')) {
    await db.execAsync(
      "ALTER TABLE recurring_incomes ADD COLUMN registration_mode TEXT NOT NULL DEFAULT 'automatic';"
    );
  }
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS recurring_income_occurrences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recurring_income_id INTEGER NOT NULL,
      scheduled_date TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('scheduled', 'pending', 'generated', 'skipped')),
      income_id INTEGER,
      dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(recurring_income_id, scheduled_date),
      FOREIGN KEY(recurring_income_id) REFERENCES recurring_incomes(id) ON DELETE CASCADE,
      FOREIGN KEY(income_id) REFERENCES incomes(id) ON DELETE SET NULL
    );
  `);

  const debtInstallmentColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(debt_installments)'
  );
  if (!debtInstallmentColumns.some((column) => column.name === 'manually_removed')) {
    await db.execAsync('ALTER TABLE debt_installments ADD COLUMN manually_removed INTEGER NOT NULL DEFAULT 0;');
  }

  const paymentMethodColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(payment_methods)'
  );
  if (!paymentMethodColumns.some((column) => column.name === 'system_key')) {
    await db.execAsync("ALTER TABLE payment_methods ADD COLUMN system_key TEXT CHECK (system_key IS NULL OR system_key = 'cash');");
  }
  if (!savingsGoalColumns.some((column) => column.name === 'allow_withdrawals')) {
    await db.execAsync('ALTER TABLE savings_goals ADD COLUMN allow_withdrawals INTEGER NOT NULL DEFAULT 1;');
  }
  await db.execAsync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_methods_system_key ON payment_methods(system_key) WHERE system_key IS NOT NULL;'
  );
  if (!paymentMethodColumns.some((column) => column.name === 'color')) {
    await db.execAsync("ALTER TABLE payment_methods ADD COLUMN color TEXT NOT NULL DEFAULT '#0a7ea4';");
  }
  if (!recurringIncomeColumns.some((column) => column.name === 'payment_method_id')) {
    await db.execAsync(
      'ALTER TABLE recurring_incomes ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id) ON DELETE SET NULL;'
    );
  }
  if (!paymentMethodColumns.some((column) => column.name === 'credit_limit')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN credit_limit INTEGER;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'reported_balance')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN reported_balance INTEGER;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_updated_at')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_updated_at TEXT;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_expense_anchor_id')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_expense_anchor_id INTEGER NOT NULL DEFAULT 0;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_payment_anchor_id')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_payment_anchor_id INTEGER NOT NULL DEFAULT 0;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_income_anchor_id')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_income_anchor_id INTEGER NOT NULL DEFAULT 0;');
    await db.execAsync(`
      UPDATE payment_methods
      SET balance_income_anchor_id = COALESCE((
        SELECT MAX(income.id)
        FROM incomes income
        WHERE income.payment_method_id = payment_methods.id
          AND income.date <= payment_methods.balance_updated_at
      ), 0)
      WHERE balance_updated_at IS NOT NULL;
    `);
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_debt_plan_anchor_id')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_debt_plan_anchor_id INTEGER NOT NULL DEFAULT 0;');
    await db.execAsync(`
      UPDATE payment_methods
      SET balance_debt_plan_anchor_id = COALESCE((
        SELECT MAX(plan.id)
        FROM debt_plans plan
        WHERE plan.payment_method_id = payment_methods.id
          AND plan.purchase_date <= payment_methods.balance_updated_at
      ), 0)
      WHERE balance_updated_at IS NOT NULL;
    `);
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_transfer_anchor_id')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_transfer_anchor_id INTEGER NOT NULL DEFAULT 0;');
    await db.execAsync(`
      UPDATE payment_methods
      SET balance_transfer_anchor_id = COALESCE((
        SELECT MAX(transfer.id)
        FROM account_transfers transfer
        WHERE (transfer.source_payment_method_id = payment_methods.id
          OR transfer.destination_payment_method_id = payment_methods.id)
          AND transfer.date <= payment_methods.balance_updated_at
      ), 0)
      WHERE balance_updated_at IS NOT NULL;
    `);
  }
  if (!paymentMethodColumns.some((column) => column.name === 'balance_synced_at')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN balance_synced_at TEXT;');
  }
  if (!paymentMethodColumns.some((column) => column.name === 'payment_due_day')) {
    await db.execAsync('ALTER TABLE payment_methods ADD COLUMN payment_due_day INTEGER;');
  }

  const creditCardCycleColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(credit_card_cycles)'
  );
  if (!creditCardCycleColumns.some((column) => column.name === 'bank_charge_expense_id')) {
    await db.execAsync('ALTER TABLE credit_card_cycles ADD COLUMN bank_charge_expense_id INTEGER;');
  }
  if (!creditCardCycleColumns.some((column) => column.name === 'adjustment_expense_id')) {
    await db.execAsync('ALTER TABLE credit_card_cycles ADD COLUMN adjustment_expense_id INTEGER;');
  }
  if (!creditCardCycleColumns.some((column) => column.name === 'reconciled_at')) {
    await db.execAsync('ALTER TABLE credit_card_cycles ADD COLUMN reconciled_at TEXT;');
  }

  const currentSettingsColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(settings)'
  );
  if (!currentSettingsColumns.some((column) => column.name === 'default_payment_method_id')) {
    await db.execAsync('ALTER TABLE settings ADD COLUMN default_payment_method_id INTEGER;');
  }
  if (!currentSettingsColumns.some((column) => column.name === 'movement_reminder_enabled')) {
    await db.execAsync("ALTER TABLE settings ADD COLUMN movement_reminder_enabled INTEGER NOT NULL DEFAULT 0;");
    await db.execAsync("ALTER TABLE settings ADD COLUMN movement_reminder_frequency TEXT NOT NULL DEFAULT 'daily';");
    await db.execAsync("ALTER TABLE settings ADD COLUMN movement_reminder_weekday INTEGER NOT NULL DEFAULT 1;");
    await db.execAsync("ALTER TABLE settings ADD COLUMN movement_reminder_hour INTEGER NOT NULL DEFAULT 21;");
    await db.execAsync("ALTER TABLE settings ADD COLUMN movement_reminder_minute INTEGER NOT NULL DEFAULT 0;");
  }

  await db.runAsync(
    "UPDATE recurring_expenses SET execution_basis = 'calendar' WHERE execution_basis != 'calendar'"
  );

  await syncRecurringSourceExpenses(db);

  await db.runAsync(`
    UPDATE recurring_expense_occurrences
    SET status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'generated'
      AND expense_id IS NULL
      AND EXISTS (
        SELECT 1 FROM recurring_expenses recurring
        WHERE recurring.id = recurring_expense_occurrences.recurring_expense_id
          AND recurring.source_expense_id IS NOT NULL
          AND recurring.registration_mode = 'confirmation'
      )
  `);
  await db.runAsync(`
    DELETE FROM recurring_expense_occurrences
    WHERE status = 'generated'
      AND expense_id IS NULL
      AND EXISTS (
        SELECT 1 FROM recurring_expenses recurring
        WHERE recurring.id = recurring_expense_occurrences.recurring_expense_id
          AND recurring.source_expense_id IS NOT NULL
          AND recurring.registration_mode = 'automatic'
      )
  `);

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period ON expenses(period_id);
    CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
    CREATE INDEX IF NOT EXISTS idx_incomes_period ON incomes(period_id);
    CREATE INDEX IF NOT EXISTS idx_incomes_payment_method ON incomes(payment_method_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period_category ON expenses(period_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period_date ON expenses(period_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_credit_payment_target ON expenses(credit_payment_target_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(recurring_expense_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_debt_plan ON expenses(debt_plan_id);
    CREATE INDEX IF NOT EXISTS idx_credit_cycles_method_end ON credit_card_cycles(payment_method_id, end_date);
    CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_expenses(active);
    CREATE INDEX IF NOT EXISTS idx_recurring_occurrence_date ON recurring_expense_occurrences(recurring_expense_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_debt_installments_due ON debt_installments(debt_plan_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_incomes_recurring ON incomes(recurring_income_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_income_occurrence_date ON recurring_income_occurrences(recurring_income_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_recurring_incomes_next ON recurring_incomes(active, next_date);
    CREATE INDEX IF NOT EXISTS idx_savings_goals_status ON savings_goals(status, deadline);
    CREATE INDEX IF NOT EXISTS idx_savings_movements_goal ON savings_goal_movements(goal_id);
    CREATE INDEX IF NOT EXISTS idx_savings_adjustments_goal ON savings_goal_adjustments(goal_id, date);
    CREATE INDEX IF NOT EXISTS idx_recurring_savings_goal ON recurring_expenses(savings_goal_id);
    CREATE INDEX IF NOT EXISTS idx_manual_debt_entries_debt ON manual_debt_entries(debt_id, date);
    CREATE INDEX IF NOT EXISTS idx_manual_debt_entries_expense ON manual_debt_entries(expense_id);
    CREATE INDEX IF NOT EXISTS idx_account_transfers_source_date ON account_transfers(source_payment_method_id, date);
    CREATE INDEX IF NOT EXISTS idx_account_transfers_destination_date ON account_transfers(destination_payment_method_id, date);

    INSERT OR IGNORE INTO periods (id, start_date, end_date)
    VALUES (
      1,
      date('now', '-1 month'),
      date('now')
    );

    INSERT OR IGNORE INTO settings (id, current_period_id)
    VALUES (
      1,
      1
    );
  `);

  let cashMethod = await db.getFirstAsync<{ id: number; reported_balance: number | null }>(
    "SELECT id, reported_balance FROM payment_methods WHERE system_key = 'cash' LIMIT 1"
  );
  if (!cashMethod) {
    cashMethod = await db.getFirstAsync<{ id: number; reported_balance: number | null }>(
      "SELECT id, reported_balance FROM payment_methods WHERE type = 'cash' ORDER BY id LIMIT 1"
    );
    if (cashMethod) {
      await db.runAsync("UPDATE payment_methods SET system_key = 'cash', active = 1 WHERE id = ?", cashMethod.id);
    } else {
      const result = await db.runAsync(
        `INSERT INTO payment_methods (
           name, type, system_key, billing_day, color, active,
           reported_balance, balance_updated_at, balance_synced_at
         ) VALUES (?, 'cash', 'cash', NULL, '#27ae60', 1, 0, DATE('now', 'localtime'), CURRENT_TIMESTAMP)`,
        t('paymentMethods.cash')
      );
      cashMethod = { id: result.lastInsertRowId, reported_balance: 0 };
    }
  }
  if (cashMethod.reported_balance == null) {
    const [expenseAnchor, incomeAnchor] = await Promise.all([
      db.getFirstAsync<{ id: number }>(
        "SELECT COALESCE(MAX(id), 0) AS id FROM expenses WHERE payment_method_id = ? AND date <= DATE('now', 'localtime')",
        cashMethod.id
      ),
      db.getFirstAsync<{ id: number }>(
        "SELECT COALESCE(MAX(id), 0) AS id FROM incomes WHERE payment_method_id = ? AND date <= DATE('now', 'localtime')",
        cashMethod.id
      ),
    ]);
    await db.runAsync(
      `UPDATE payment_methods
       SET active = 1, reported_balance = 0,
           balance_updated_at = DATE('now', 'localtime'), balance_synced_at = CURRENT_TIMESTAMP,
           balance_expense_anchor_id = ?, balance_income_anchor_id = ?
       WHERE id = ?`,
      Number(expenseAnchor?.id ?? 0),
      Number(incomeAnchor?.id ?? 0),
      cashMethod.id
    );
  } else {
    await db.runAsync('UPDATE payment_methods SET active = 1 WHERE id = ?', cashMethod.id);
  }
  await db.runAsync(
    'UPDATE recurring_incomes SET payment_method_id = ? WHERE payment_method_id IS NULL',
    cashMethod.id
  );
  await db.runAsync(
    `UPDATE settings
     SET default_payment_method_id = ?
     WHERE id = 1 AND (
       default_payment_method_id IS NULL OR NOT EXISTS (
         SELECT 1 FROM payment_methods method
         WHERE method.id = settings.default_payment_method_id AND method.active = 1
       )
     )`,
    cashMethod.id
  );

  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if ((row?.count ?? 0) === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      // Validamos aquí también para evitar cargar por defecto un color prohibido
      if (!RESERVED_COLORS.map(normalizeColor).includes(normalizeColor(category.color))) {
        await db.runAsync(
          'INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, ?, ?, ?)',
          category.name,
          category.color,
          category.periodLimit,
          category.purpose ?? 'general',
          category.systemKey ?? (category.purpose === 'savings' ? 'savings' : null)
        );
      }
    }
  }

  const savingsCategory = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE purpose = 'savings' ORDER BY id LIMIT 1"
  );
  if (!savingsCategory) {
    const existingSavingsName = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1',
      t('database.defaultCategories.savings')
    );
    if (existingSavingsName) {
      await db.runAsync("UPDATE categories SET purpose = 'savings', system_key = 'savings' WHERE id = ?", existingSavingsName.id);
    } else {
      const usedColors = new Set(
        (await db.getAllAsync<{ color: string }>('SELECT color FROM categories'))
          .map((item) => normalizeColor(item.color))
      );
      const reservedColors = new Set(RESERVED_COLORS.map(normalizeColor));
      let savingsColor = '#27ae60';
      for (let index = 0; index < 0x1000000; index += 1) {
        const value = (0x27ae60 + index * 0x1f123b) & 0xffffff;
        const candidate = `#${value.toString(16).padStart(6, '0')}`;
        if (!usedColors.has(candidate) && !reservedColors.has(candidate)) {
          savingsColor = candidate;
          break;
        }
      }
      await db.runAsync(
        "INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, NULL, 'savings', 'savings')",
        t('database.defaultCategories.savings'),
        savingsColor
      );
    }
  }

  const creditPaymentCategory = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM categories WHERE system_key = 'credit_payment' LIMIT 1"
  );
  if (!creditPaymentCategory) {
    const existingPaymentName = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE name = ? COLLATE NOCASE LIMIT 1',
      t('database.defaultCategories.creditPayment')
    );
    if (existingPaymentName) {
      await db.runAsync(
        "UPDATE categories SET period_limit = NULL, system_key = 'credit_payment' WHERE id = ?",
        existingPaymentName.id
      );
    } else {
      const usedColors = new Set(
        (await db.getAllAsync<{ color: string }>('SELECT color FROM categories'))
          .map((item) => normalizeColor(item.color))
      );
      let paymentColor = '#D88916';
      for (let index = 0; index < 0x1000000; index += 1) {
        const value = (0xd88916 + index * 0x1f123b) & 0xffffff;
        const candidate = `#${value.toString(16).padStart(6, '0')}`;
        if (!usedColors.has(candidate)) {
          paymentColor = candidate;
          break;
        }
      }
      await db.runAsync(
        "INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, NULL, 'general', 'credit_payment')",
        t('database.defaultCategories.creditPayment'),
        paymentColor
      );
    }
  }
  await recordAppliedSchema(db);
}

/**
 * Initializes and migrates each cached connection exactly once. React can run
 * mount effects more than once in development, so all callers share the same
 * work instead of competing for SQLite's schema lock.
 */
export function initDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = initializeDatabase().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }
  return initializationPromise;
}

export async function resetLocalData(): Promise<void> {
  const database = await getDb();
  await withExclusiveTransaction(database, async (transaction) => {
    await transaction.execAsync(`
      DELETE FROM savings_goal_movements;
      DELETE FROM savings_goal_adjustments;
      DELETE FROM manual_debt_entries;
      DELETE FROM recurring_expense_occurrences;
      DELETE FROM recurring_income_occurrences;
      DELETE FROM credit_card_cycles;
      DELETE FROM debt_installments;
      DELETE FROM account_transfers;
      DELETE FROM expenses;
      DELETE FROM incomes;
      DELETE FROM recurring_expenses;
      DELETE FROM recurring_incomes;
      DELETE FROM debt_plans;
      DELETE FROM manual_debts;
      DELETE FROM savings_goals;
      DELETE FROM settings;
      DELETE FROM categories;
      DELETE FROM payment_methods;
      DELETE FROM periods;
      DELETE FROM sqlite_sequence;

      INSERT INTO periods (start_date, end_date)
      VALUES (date('now', '-1 month'), date('now'));

      INSERT INTO settings (id, current_period_id)
      VALUES (1, last_insert_rowid());
    `);

    await transaction.runAsync(
      `INSERT INTO payment_methods (
         name, type, system_key, billing_day, color, active,
         reported_balance, balance_updated_at, balance_synced_at
       ) VALUES (?, 'cash', 'cash', NULL, '#27ae60', 1, 0, DATE('now', 'localtime'), CURRENT_TIMESTAMP)`,
      t('paymentMethods.cash')
    );
    await transaction.runAsync(
      "UPDATE settings SET default_payment_method_id = (SELECT id FROM payment_methods WHERE system_key = 'cash') WHERE id = 1"
    );
    for (const category of DEFAULT_CATEGORIES) {
      await transaction.runAsync(
        'INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, ?, ?, ?)',
        category.name,
        category.color,
        category.periodLimit,
        category.purpose ?? 'general',
        category.systemKey ?? (category.purpose === 'savings' ? 'savings' : null)
      );
    }
  });
}

export async function getPeriods(): Promise<Period[]> {
  const db = await getDb();

  const rows =
    await db.getAllAsync<{
      id:number;
      start_date:string;
      end_date:string;
    }>(
      `
      SELECT *
      FROM periods
      ORDER BY start_date DESC,
               id DESC
      `
    );

  return rows.map(row => ({
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
  }));
}

export async function createPeriod(data: NewPeriod): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO periods (start_date, end_date) VALUES (?, ?)', data.startDate, data.endDate);
}

export async function updatePeriod(id: number, data: NewPeriod): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE periods SET start_date = ?, end_date = ? WHERE id = ?', data.startDate, data.endDate, id);
}

async function assertDateBelongsToPeriod(
  db: SQLite.SQLiteDatabase,
  periodId: number,
  date: string
): Promise<void> {
  const period = await db.getFirstAsync<{ start_date: string; end_date: string }>(
    'SELECT start_date, end_date FROM periods WHERE id = ?',
    periodId
  );
  if (!period) throw new Error(t('database.periodMissing'));
  if (date < period.start_date || date > period.end_date) {
    throw new Error(t('database.movementOutsidePeriod'));
  }
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    periodLimit: row.period_limit != null ? (row.period_limit as number) : null,
    purpose: row.purpose === 'savings' ? 'savings' : 'general',
    systemKey: row.system_key === 'savings' || row.system_key === 'credit_payment'
      ? row.system_key
      : null,
  };
}

export async function getCategories(): Promise<Category[]> {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM categories ORDER BY name ASC');
  return rows.map((row) => mapCategory(row as Record<string, unknown>));
}

export async function createCategory(data: NewCategory): Promise<Category> {
  const db = await getDb();
  const normalized = {
    name: data.name.trim(),
    color: data.color.toLowerCase(),
    periodLimit: data.periodLimit,
    purpose: data.purpose ?? 'general',
    systemKey: data.systemKey ?? null,
  };

  await assertUniqueCategoryFields(db, normalized);

  const result = await db.runAsync(
    'INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, ?, ?, ?)',
    normalized.name,
    normalized.color,
    normalized.periodLimit,
    normalized.purpose,
    normalized.systemKey
  );
  return {
    id: result.lastInsertRowId,
    name: normalized.name,
    color: normalized.color,
    periodLimit: normalized.periodLimit,
    purpose: normalized.purpose,
    systemKey: normalized.systemKey,
  };
}

export async function updateCategory(
  id: number,
  data: NewCategory
): Promise<void> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{
    name: string;
    purpose: Category['purpose'];
    system_key: Category['systemKey'];
  }>(
    'SELECT name, purpose, system_key FROM categories WHERE id = ?',
    id
  );
  const protectedCategory = existing?.system_key != null || existing?.purpose === 'savings';
  if (protectedCategory && data.name.trim() !== existing.name) {
    throw new Error(t('database.protectedCategoryNameLocked'));
  }
  const normalized = {
    name: protectedCategory ? existing.name : data.name.trim(),
    color: data.color.toLowerCase(),
    periodLimit: protectedCategory ? null : data.periodLimit,
    purpose: existing?.purpose === 'savings' ? 'savings' as const : data.purpose,
  };

  await assertUniqueCategoryFields(db, normalized, id);

  await db.runAsync(
    `UPDATE categories
     SET name = ?, color = ?, period_limit = ?, purpose = COALESCE(?, purpose)
     WHERE id = ?`,
    normalized.name,
    normalized.color,
    normalized.periodLimit,
    normalized.purpose ?? null,
    id
  );
}

export async function deleteCategory(
  id: number,
  detachExpenses = false
): Promise<void> {
  const db = await getDb();
  const category = await db.getFirstAsync<{ purpose: string; system_key: string | null }>(
    'SELECT purpose, system_key FROM categories WHERE id = ?',
    id
  );
  if (category?.purpose === 'savings' || category?.system_key != null) {
    throw new Error(t('database.protectedCategoryRequired'));
  }
  if (!detachExpenses) {
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    return;
  }

  await withExclusiveTransaction(db, async (transaction) => {
    await transaction.runAsync(
      'UPDATE expenses SET category_id = NULL WHERE category_id = ?',
      id
    );
    await transaction.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}

type SavingsMovementLink = {
  id: number;
  goal_id: number;
  kind: 'contribution' | 'withdrawal' | 'funded_expense';
};

async function isSavingsCategory(
  db: SQLite.SQLiteDatabase,
  categoryId: number | null
): Promise<boolean> {
  if (categoryId == null) return false;
  const category = await db.getFirstAsync<{ purpose: string }>(
    'SELECT purpose FROM categories WHERE id = ?',
    categoryId
  );
  return category?.purpose === 'savings';
}

async function assertSavingsSelectionMatchesCategory(
  db: SQLite.SQLiteDatabase,
  categoryId: number | null,
  selection: { goalId: number; kind: SavingsExpenseKind } | null
): Promise<void> {
  if (!selection) return;
  const savingsCategory = await isSavingsCategory(db, categoryId);
  if (selection.kind === 'contribution' && !savingsCategory) {
    throw new Error(t('database.contributionRequiresSavings'));
  }
  if (selection.kind === 'funded_expense' && savingsCategory) {
    throw new Error(t('database.contributionCannotBeFunded'));
  }
}

async function assertSavingsPaymentMethodAllowed(
  db: SQLite.SQLiteDatabase,
  categoryId: number | null,
  selection: { goalId: number; kind: SavingsExpenseKind } | null,
  paymentMethodId: number | null
): Promise<void> {
  if (!selection && !await isSavingsCategory(db, categoryId)) return;
  if (paymentMethodId == null) return;
  const method = await db.getFirstAsync<{ type: PaymentMethod['type'] }>(
    'SELECT type FROM payment_methods WHERE id = ?',
    paymentMethodId
  );
  if (!method) throw new Error(t('database.paymentMissing'));
  if (method.type === 'credit') {
    throw new Error(t('database.savingsCreditNotAllowed'));
  }

}

function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validateSavingsGoal(data: NewSavingsGoal): void {
  if (!data.name.trim()) throw new Error(t('database.savingsGoalNameRequired'));
  if (!Number.isInteger(data.targetAmount) || data.targetAmount <= 0) {
    throw new Error(t('database.savingsTargetInvalid'));
  }
  if (!Number.isInteger(data.initialAmount) || data.initialAmount < 0) {
    throw new Error(t('database.savingsInitialInvalid'));
  }
  if (data.initialAmount > data.targetAmount) {
    throw new Error(t('database.savingsInitialAboveTarget'));
  }
  if (typeof data.allowWithdrawals !== 'boolean') {
    throw new Error(t('database.savingsWithdrawalPolicyInvalid'));
  }
  if (!isValidIsoDate(data.deadline)) throw new Error(t('database.savingsDeadlineInvalid'));
  if (!/^#[0-9a-f]{6}$/i.test(data.color)) throw new Error(t('database.savingsColorInvalid'));
}

async function assertUniqueSavingsGoalName(
  db: SQLite.SQLiteDatabase,
  name: string,
  excludeId?: number
): Promise<void> {
  const existing = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM savings_goals WHERE name = ? COLLATE NOCASE AND id != ?',
    name.trim(),
    excludeId ?? -1
  );
  if (existing) throw new Error(t('database.savingsGoalExists'));
}

async function getSavingsGoalBalance(
  db: SQLite.SQLiteDatabase,
  goalId: number,
  excludeMovementId?: number
): Promise<{
  balance: number;
  initialAmount: number;
  status: SavingsGoal['status'];
  createdDate: string;
} | null> {
  const row = await db.getFirstAsync<{
    balance: number;
    initial_amount: number;
    status: SavingsGoal['status'];
    created_date: string;
  }>(
    `SELECT
       g.initial_amount + COALESCE(SUM(CASE
         WHEN movement.id = ? THEN 0
         WHEN movement.kind = 'contribution' THEN COALESCE(expense.amount, 0)
         WHEN movement.kind = 'withdrawal' THEN -COALESCE(income.amount, 0)
         WHEN movement.kind = 'funded_expense' THEN -COALESCE(expense.amount, 0)
         ELSE 0
       END), 0)
       + COALESCE((
         SELECT SUM(adjustment.amount)
         FROM savings_goal_adjustments adjustment
         WHERE adjustment.goal_id = g.id
       ), 0) AS balance,
       g.initial_amount,
       g.status,
       date(g.created_at, 'localtime') AS created_date
     FROM savings_goals g
     LEFT JOIN savings_goal_movements movement ON movement.goal_id = g.id
     LEFT JOIN expenses expense ON expense.id = movement.expense_id
     LEFT JOIN incomes income ON income.id = movement.income_id
     WHERE g.id = ?
     GROUP BY g.id`,
    excludeMovementId ?? -1,
    goalId
  );
  return row
    ? {
        balance: Number(row.balance),
        initialAmount: Number(row.initial_amount),
        status: row.status,
        createdDate: row.created_date,
      }
    : null;
}

async function getSavingsGoalBalanceAtDate(
  db: SQLite.SQLiteDatabase,
  goalId: number,
  throughDate: string,
  excludeMovementId?: number
): Promise<number | null> {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT
       goal.initial_amount
       + COALESCE(SUM(CASE
         WHEN movement.id = ? THEN 0
         WHEN movement.kind = 'contribution' AND expense.date <= ? THEN COALESCE(expense.amount, 0)
         WHEN movement.kind = 'withdrawal' AND income.date <= ? THEN -COALESCE(income.amount, 0)
         WHEN movement.kind = 'funded_expense' AND expense.date <= ? THEN -COALESCE(expense.amount, 0)
         ELSE 0
       END), 0)
       + COALESCE((
         SELECT SUM(adjustment.amount)
         FROM savings_goal_adjustments adjustment
         WHERE adjustment.goal_id = goal.id AND adjustment.date <= ?
       ), 0) AS balance
     FROM savings_goals goal
     LEFT JOIN savings_goal_movements movement ON movement.goal_id = goal.id
     LEFT JOIN expenses expense ON expense.id = movement.expense_id
     LEFT JOIN incomes income ON income.id = movement.income_id
     WHERE goal.id = ?
     GROUP BY goal.id`,
    excludeMovementId ?? -1,
    throughDate,
    throughDate,
    throughDate,
    throughDate,
    goalId
  );
  return row ? Number(row.balance) : null;
}

async function assertSavingsGoalCanReceiveMovement(
  db: SQLite.SQLiteDatabase,
  goalId: number,
  existingMovement?: SavingsMovementLink | null
): Promise<void> {
  const goal = await getSavingsGoalBalance(db, goalId);
  if (!goal) throw new Error(t('database.savingsGoalMissing'));
  const keepsExistingArchivedLink = existingMovement?.goal_id === goalId;
  if (goal.status === 'archived' && !keepsExistingArchivedLink) {
    throw new Error(t('database.savingsGoalArchived'));
  }
}

async function assertSavingsGoalAllowsWithdrawal(
  db: SQLite.SQLiteDatabase,
  goalId: number,
  existingMovement?: SavingsMovementLink | null
): Promise<void> {
  const goal = await db.getFirstAsync<{ allow_withdrawals: number }>(
    'SELECT allow_withdrawals FROM savings_goals WHERE id = ?',
    goalId
  );
  if (!goal) throw new Error(t('database.savingsGoalMissing'));
  const keepsExistingWithdrawal = existingMovement?.goal_id === goalId;
  if (Number(goal.allow_withdrawals) !== 1 && !keepsExistingWithdrawal) {
    throw new Error(t('database.savingsWithdrawalsDisabled'));
  }
}

async function assertSavingsGoalIsActive(
  db: SQLite.SQLiteDatabase,
  goalId: number
): Promise<void> {
  const goal = await getSavingsGoalBalance(db, goalId);
  if (!goal) throw new Error(t('database.savingsGoalMissing'));
  if (goal.status === 'archived') {
    throw new Error(t('database.reactivateSavingsGoal'));
  }
}

async function getExpenseSavingsMovement(
  db: SQLite.SQLiteDatabase,
  expenseId: number
): Promise<SavingsMovementLink | null> {
  return db.getFirstAsync<SavingsMovementLink>(
    'SELECT id, goal_id, kind FROM savings_goal_movements WHERE expense_id = ?',
    expenseId
  );
}

async function getIncomeSavingsMovement(
  db: SQLite.SQLiteDatabase,
  incomeId: number
): Promise<SavingsMovementLink | null> {
  return db.getFirstAsync<SavingsMovementLink>(
    'SELECT id, goal_id, kind FROM savings_goal_movements WHERE income_id = ?',
    incomeId
  );
}

async function assertSavingsGoalBalanceIsNotNegative(
  db: SQLite.SQLiteDatabase,
  goalId: number
): Promise<void> {
  const goal = await getSavingsGoalBalance(db, goalId);
  if (!goal) return;
  const movements = await db.getAllAsync<{
    kind: SavingsGoalMovement['kind'];
    amount: number;
    movement_date: string;
  }>(
    `SELECT kind, amount, movement_date
     FROM (
       SELECT
         movement.kind,
         CASE
           WHEN movement.kind = 'contribution' THEN COALESCE(expense.amount, 0)
           ELSE -COALESCE(expense.amount, income.amount, 0)
         END AS amount,
         COALESCE(expense.date, income.date) AS movement_date,
         movement.id AS sort_id
       FROM savings_goal_movements movement
       LEFT JOIN expenses expense ON expense.id = movement.expense_id
       LEFT JOIN incomes income ON income.id = movement.income_id
       WHERE movement.goal_id = ?
       UNION ALL
       SELECT 'adjustment', adjustment.amount, adjustment.date, adjustment.id
       FROM savings_goal_adjustments adjustment
       WHERE adjustment.goal_id = ?
     )
     WHERE movement_date IS NOT NULL
     ORDER BY movement_date ASC,
       CASE kind WHEN 'contribution' THEN 0 WHEN 'adjustment' THEN 1 ELSE 2 END,
       sort_id ASC`,
    goalId,
    goalId
  );
  let runningBalance = goal.initialAmount;
  for (const movement of movements) {
    runningBalance += movement.amount;
    if (runningBalance < 0) {
      throw new Error(t('database.usedSavingsContribution'));
    }
  }
}

async function setExpenseSavingsMovement(
  db: SQLite.SQLiteDatabase,
  expenseId: number,
  amount: number,
  selection: { goalId: number; kind: SavingsExpenseKind } | null
): Promise<void> {
  const existing = await getExpenseSavingsMovement(db, expenseId);
  if (!selection) {
    if (!existing) return;
    await db.runAsync('DELETE FROM savings_goal_movements WHERE id = ?', existing.id);
    if (existing.kind === 'contribution') {
      await assertSavingsGoalBalanceIsNotNegative(db, existing.goal_id);
    }
    return;
  }

  const expense = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM expenses WHERE id = ?',
    expenseId
  );
  if (!expense) throw new Error(t('database.savingsExpenseMissing'));
  await assertSavingsGoalCanReceiveMovement(db, selection.goalId, existing);
  if (selection.kind === 'funded_expense') {
    await assertSavingsGoalAllowsWithdrawal(db, selection.goalId, existing);
    const balance = await getSavingsGoalBalanceAtDate(
      db,
      selection.goalId,
      expense.date,
      existing?.id
    );
    if (balance == null || amount > balance) {
      throw new Error(t('database.insufficientSavingsFund'));
    }
  }

  await db.runAsync(
    `INSERT INTO savings_goal_movements (goal_id, kind, expense_id, income_id)
     VALUES (?, ?, ?, NULL)
     ON CONFLICT(expense_id) DO UPDATE SET
       goal_id = excluded.goal_id,
       kind = excluded.kind,
       updated_at = CURRENT_TIMESTAMP`,
    selection.goalId,
    selection.kind,
    expenseId
  );

  if (existing?.kind === 'contribution') {
    await assertSavingsGoalBalanceIsNotNegative(db, existing.goal_id);
  }
}

async function setIncomeSavingsMovement(
  db: SQLite.SQLiteDatabase,
  incomeId: number,
  amount: number,
  goalId: number | null
): Promise<void> {
  const existing = await getIncomeSavingsMovement(db, incomeId);
  if (goalId == null) {
    if (existing) await db.runAsync('DELETE FROM savings_goal_movements WHERE id = ?', existing.id);
    return;
  }

  const income = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM incomes WHERE id = ?',
    incomeId
  );
  if (!income) throw new Error(t('database.savingsWithdrawalMissing'));
  await assertSavingsGoalCanReceiveMovement(db, goalId, existing);
  await assertSavingsGoalAllowsWithdrawal(db, goalId, existing);
  const balance = await getSavingsGoalBalanceAtDate(db, goalId, income.date, existing?.id);
  if (balance == null || amount > balance) {
    throw new Error(t('database.insufficientSavingsWithdrawal'));
  }
  await db.runAsync(
    `INSERT INTO savings_goal_movements (goal_id, kind, expense_id, income_id)
     VALUES (?, 'withdrawal', NULL, ?)
     ON CONFLICT(income_id) DO UPDATE SET
       goal_id = excluded.goal_id,
       kind = 'withdrawal',
       updated_at = CURRENT_TIMESTAMP`,
    goalId,
    incomeId
  );
}

function resolveExpenseSavingsSelection(
  data: Pick<NewExpense, 'savingsGoalId' | 'savingsKind'>,
  existing: SavingsMovementLink | null,
  preserveWhenOmitted: boolean
): { goalId: number; kind: SavingsExpenseKind } | null {
  const wasOmitted = data.savingsGoalId === undefined && data.savingsKind === undefined;
  if (preserveWhenOmitted && wasOmitted) {
    if (!existing) return null;
    if (existing.kind !== 'contribution' && existing.kind !== 'funded_expense') {
      throw new Error(t('database.invalidSavingsLink'));
    }
    return { goalId: existing.goal_id, kind: existing.kind };
  }

  const goalId = data.savingsGoalId === undefined
    ? (preserveWhenOmitted ? existing?.goal_id ?? null : null)
    : data.savingsGoalId;
  if (goalId == null) {
    if (data.savingsKind != null) throw new Error(t('database.selectSavingsGoal'));
    return null;
  }
  const requestedKind = data.savingsKind === undefined || data.savingsKind === null
    ? (existing?.goal_id === goalId ? existing.kind : 'contribution')
    : data.savingsKind;
  if (requestedKind !== 'contribution' && requestedKind !== 'funded_expense') {
    throw new Error(t('database.invalidExpenseSavingsLink'));
  }
  return { goalId, kind: requestedKind };
}

function validateExpense(data: NewExpense): void {
  if (!data.name.trim()) throw new Error(t('validation.invalidExpenseName'));
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(t('validation.invalidAmount'));
  }
  const hasOriginalAmount = data.originalAmount != null;
  const hasSplitPercentage = data.splitPercentage != null;
  if (hasOriginalAmount !== hasSplitPercentage) {
    throw new Error(t('validation.invalidSplitAmount'));
  }
  if (data.originalAmount != null && data.splitPercentage != null && (
    !Number.isInteger(data.originalAmount)
    || data.originalAmount <= 0
    || data.amount > data.originalAmount
    || !Number.isFinite(data.splitPercentage)
    || data.splitPercentage <= 0
    || data.splitPercentage > 100
  )) {
    throw new Error(t('validation.invalidSplitAmount'));
  }
}

function mapSavingsGoal(row: Record<string, unknown>): SavingsGoal {
  return {
    id: Number(row.id),
    name: String(row.name),
    targetAmount: Number(row.target_amount),
    initialAmount: Number(row.initial_amount),
    allowWithdrawals: Number(row.allow_withdrawals) === 1,
    deadline: String(row.deadline),
    color: String(row.color),
    status: row.status as SavingsGoal['status'],
    currentAmount: Number(row.current_amount),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getSavingsGoals(includeArchived = false): Promise<SavingsGoal[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
       goal.*,
       goal.initial_amount + COALESCE(SUM(CASE
         WHEN movement.kind = 'contribution' THEN COALESCE(expense.amount, 0)
         WHEN movement.kind = 'withdrawal' THEN -COALESCE(income.amount, 0)
         WHEN movement.kind = 'funded_expense' THEN -COALESCE(expense.amount, 0)
         ELSE 0
       END), 0)
       + COALESCE((
         SELECT SUM(adjustment.amount)
         FROM savings_goal_adjustments adjustment
         WHERE adjustment.goal_id = goal.id
       ), 0) AS current_amount
     FROM savings_goals goal
     LEFT JOIN savings_goal_movements movement ON movement.goal_id = goal.id
     LEFT JOIN expenses expense ON expense.id = movement.expense_id
     LEFT JOIN incomes income ON income.id = movement.income_id
     ${includeArchived ? '' : "WHERE goal.status = 'active'"}
     GROUP BY goal.id
     ORDER BY goal.status ASC, goal.deadline ASC, goal.name COLLATE NOCASE ASC`
  );
  return rows.map(mapSavingsGoal);
}

export async function getSavingsGoalMovements(goalId: number): Promise<SavingsGoalMovement[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM (
       SELECT
         movement.id,
         movement.goal_id,
         movement.kind,
         movement.expense_id,
         movement.income_id,
         COALESCE(expense.name, income.name) AS movement_name,
         COALESCE(expense.amount, income.amount) AS amount,
         COALESCE(expense.date, income.date) AS movement_date,
         NULL AS note,
         'movement' AS source
       FROM savings_goal_movements movement
       LEFT JOIN expenses expense ON expense.id = movement.expense_id
       LEFT JOIN incomes income ON income.id = movement.income_id
       WHERE movement.goal_id = ?
         AND COALESCE(expense.date, income.date) IS NOT NULL
       UNION ALL
       SELECT
         adjustment.id,
         adjustment.goal_id,
         'adjustment',
         NULL,
         NULL,
         NULL,
         adjustment.amount,
         adjustment.date,
         adjustment.note,
         'adjustment'
       FROM savings_goal_adjustments adjustment
       WHERE adjustment.goal_id = ?
     )
     ORDER BY movement_date DESC, id DESC`,
    goalId,
    goalId
  );
  return rows.map((row) => ({
    id: row.source === 'adjustment' ? -Number(row.id) : Number(row.id),
    goalId: Number(row.goal_id),
    kind: row.kind as SavingsGoalMovement['kind'],
    name: row.kind === 'adjustment'
      ? String(row.note || t('savings.balanceAdjustment'))
      : String(row.movement_name),
    amount: Number(row.amount),
    date: String(row.movement_date),
    expenseId: row.expense_id == null ? null : Number(row.expense_id),
    incomeId: row.income_id == null ? null : Number(row.income_id),
  }));
}

async function assertCreditPaymentSelection(
  db: SQLite.SQLiteDatabase,
  categoryId: number | null,
  paymentMethodId: number | null,
  creditPaymentTargetId: number | null
): Promise<void> {
  const category = categoryId == null
    ? null
    : await db.getFirstAsync<{ system_key: string | null }>(
        'SELECT system_key FROM categories WHERE id = ?',
        categoryId
      );
  const isCreditPayment = category?.system_key === 'credit_payment';
  if (isCreditPayment !== (creditPaymentTargetId != null)) {
    throw new Error(t('database.creditPaymentTargetRequired'));
  }
  if (!isCreditPayment) return;
  if (paymentMethodId == null) {
    throw new Error(t('database.creditPaymentSourceRequired'));
  }
  const [source, target] = await Promise.all([
    db.getFirstAsync<{ type: PaymentMethod['type'] }>(
      'SELECT type FROM payment_methods WHERE id = ?', paymentMethodId
    ),
    db.getFirstAsync<{ type: PaymentMethod['type'] }>(
      'SELECT type FROM payment_methods WHERE id = ?', creditPaymentTargetId
    ),
  ]);
  if (!source || !target) throw new Error(t('database.paymentMissing'));
  if (source.type === 'credit') throw new Error(t('database.creditPaymentSourceInvalid'));
  if (target.type !== 'credit') throw new Error(t('database.creditPaymentTargetInvalid'));
}

export async function addSavingsGoalBalanceAdjustment(
  goalId: number,
  data: NewSavingsGoalBalance
): Promise<void> {
  if (!Number.isInteger(data.balance) || data.balance < 0) {
    throw new Error(t('database.savingsBalanceInvalid'));
  }
  if (!isValidIsoDate(data.date)) throw new Error(t('database.savingsAdjustmentDateInvalid'));
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const goal = await getSavingsGoalBalance(transaction, goalId);
    if (!goal) throw new Error(t('database.savingsGoalMissing'));
    if (goal.status === 'archived') throw new Error(t('database.savingsGoalArchived'));
    const difference = data.balance - goal.balance;
    if (difference === 0) throw new Error(t('database.savingsBalanceUnchanged'));
    await transaction.runAsync(
      `INSERT INTO savings_goal_adjustments (goal_id, amount, date, note)
       VALUES (?, ?, ?, ?)`,
      goalId,
      difference,
      data.date,
      data.note?.trim() || null
    );
    await assertSavingsGoalBalanceIsNotNegative(transaction, goalId);
    await transaction.runAsync(
      'UPDATE savings_goals SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      goalId
    );
  });
}

export async function createSavingsGoal(data: NewSavingsGoal): Promise<number> {
  validateSavingsGoal(data);
  const db = await getDb();
  await assertUniqueSavingsGoalName(db, data.name);
  const result = await db.runAsync(
    `INSERT INTO savings_goals
      (name, target_amount, initial_amount, allow_withdrawals, deadline, color, status)
     VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    data.name.trim(),
    data.targetAmount,
    data.initialAmount,
    data.allowWithdrawals ? 1 : 0,
    data.deadline,
    data.color.toLowerCase()
  );
  return result.lastInsertRowId;
}

export async function updateSavingsGoal(id: number, data: NewSavingsGoal): Promise<void> {
  validateSavingsGoal(data);
  const db = await getDb();
  await assertUniqueSavingsGoalName(db, data.name, id);
  await withExclusiveTransaction(db, async (transaction) => {
    const current = await getSavingsGoalBalance(transaction, id);
    if (!current) throw new Error(t('database.savingsGoalMissing'));
    const movementBalance = current.balance - current.initialAmount;
    if (data.initialAmount + movementBalance < 0) {
      throw new Error(t('database.initialSavingsNegative'));
    }
    await transaction.runAsync(
      `UPDATE savings_goals SET
         name = ?, target_amount = ?, initial_amount = ?, allow_withdrawals = ?, deadline = ?, color = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.name.trim(),
      data.targetAmount,
      data.initialAmount,
      data.allowWithdrawals ? 1 : 0,
      data.deadline,
      data.color.toLowerCase(),
      id
    );
    await assertSavingsGoalBalanceIsNotNegative(transaction, id);
  });
}

export async function setSavingsGoalArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE savings_goals
       SET status = ?, archived_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      archived ? 'archived' : 'active',
      archived ? 1 : 0,
      id
    );
    if (result.changes === 0) throw new Error(t('database.savingsGoalMissing'));
    if (archived) {
      await transaction.runAsync(
        'UPDATE recurring_expenses SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE savings_goal_id = ?',
        id
      );
      await transaction.runAsync(
        `DELETE FROM recurring_expense_occurrences
         WHERE recurring_expense_id IN (
           SELECT id FROM recurring_expenses WHERE savings_goal_id = ?
         ) AND status IN ('scheduled', 'pending')`,
        id
      );
    }
  });
}

export async function deleteSavingsGoal(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const usage = await transaction.getFirstAsync<{ movement_count: number; adjustment_count: number; recurring_count: number }>(
      `SELECT
         (SELECT COUNT(*) FROM savings_goal_movements WHERE goal_id = ?) AS movement_count,
         (SELECT COUNT(*) FROM savings_goal_adjustments WHERE goal_id = ?) AS adjustment_count,
         (SELECT COUNT(*) FROM recurring_expenses WHERE savings_goal_id = ?) AS recurring_count`,
      id,
      id,
      id
    );
    if ((usage?.movement_count ?? 0) > 0 || (usage?.adjustment_count ?? 0) > 0 || (usage?.recurring_count ?? 0) > 0) {
      throw new Error(t('database.savingsGoalInUse'));
    }
    const result = await transaction.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
    if (result.changes === 0) throw new Error(t('database.savingsGoalMissing'));
  });
}

export async function getPeriodSavingsGoalActivity(
  periodId: number
): Promise<SavingsGoalPeriodActivity[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
       goal.id AS goal_id,
       goal.name,
       goal.target_amount,
       goal.initial_amount,
       goal.allow_withdrawals,
       goal.deadline,
       goal.color,
       CASE
         WHEN goal.archived_at IS NOT NULL
           AND date(goal.archived_at, 'localtime') <= period.end_date
         THEN 'archived'
         ELSE 'active'
       END AS status,
       CASE WHEN date(goal.created_at, 'localtime') < period.start_date THEN goal.initial_amount ELSE 0 END
         + COALESCE(SUM(CASE
           WHEN expense.date < period.start_date AND movement.kind = 'contribution' THEN expense.amount
           WHEN income.date < period.start_date AND movement.kind = 'withdrawal' THEN -income.amount
           WHEN expense.date < period.start_date AND movement.kind = 'funded_expense' THEN -expense.amount
           ELSE 0
         END), 0)
         + COALESCE((
           SELECT SUM(adjustment.amount)
           FROM savings_goal_adjustments adjustment
           WHERE adjustment.goal_id = goal.id AND adjustment.date < period.start_date
         ), 0) AS opening_amount,
       CASE WHEN date(goal.created_at, 'localtime') <= period.end_date THEN goal.initial_amount ELSE 0 END
         + COALESCE(SUM(CASE
           WHEN expense.date <= period.end_date AND movement.kind = 'contribution' THEN expense.amount
           WHEN income.date <= period.end_date AND movement.kind = 'withdrawal' THEN -income.amount
           WHEN expense.date <= period.end_date AND movement.kind = 'funded_expense' THEN -expense.amount
           ELSE 0
         END), 0)
         + COALESCE((
           SELECT SUM(adjustment.amount)
           FROM savings_goal_adjustments adjustment
           WHERE adjustment.goal_id = goal.id AND adjustment.date <= period.end_date
         ), 0) AS balance_at_period_end,
       COALESCE(SUM(CASE
         WHEN movement.kind = 'contribution' AND expense.period_id = period.id THEN expense.amount
         ELSE 0 END), 0) AS contributed_amount,
       COALESCE(SUM(CASE
         WHEN movement.kind = 'withdrawal' AND income.period_id = period.id THEN income.amount
         ELSE 0 END), 0) AS withdrawn_amount,
       COALESCE(SUM(CASE
         WHEN movement.kind = 'funded_expense' AND expense.period_id = period.id THEN expense.amount
         ELSE 0 END), 0) AS funded_expense_amount,
       COALESCE((
         SELECT SUM(adjustment.amount)
         FROM savings_goal_adjustments adjustment
         WHERE adjustment.goal_id = goal.id
           AND adjustment.date BETWEEN period.start_date AND period.end_date
       ), 0) AS adjustment_amount
     FROM periods period
     CROSS JOIN savings_goals goal
     LEFT JOIN savings_goal_movements movement ON movement.goal_id = goal.id
     LEFT JOIN expenses expense ON expense.id = movement.expense_id
     LEFT JOIN incomes income ON income.id = movement.income_id
     WHERE period.id = ?
     GROUP BY goal.id, period.id
     HAVING date(goal.created_at, 'localtime') <= period.end_date
       OR COALESCE(SUM(CASE
         WHEN expense.period_id = period.id OR income.period_id = period.id THEN 1
         ELSE 0 END), 0) > 0
       OR EXISTS (
         SELECT 1 FROM savings_goal_adjustments adjustment
         WHERE adjustment.goal_id = goal.id
           AND adjustment.date BETWEEN period.start_date AND period.end_date
       )
     ORDER BY goal.status ASC, goal.deadline ASC, goal.name COLLATE NOCASE ASC`,
    periodId
  );
  return rows.map((row) => {
    const contributedAmount = Number(row.contributed_amount);
    const withdrawnAmount = Number(row.withdrawn_amount);
    const fundedExpenseAmount = Number(row.funded_expense_amount);
    const adjustmentAmount = Number(row.adjustment_amount);
    return {
      goalId: Number(row.goal_id),
      goalName: String(row.name),
      goalColor: String(row.color),
      targetAmount: Number(row.target_amount),
      initialAmount: Number(row.initial_amount),
      allowWithdrawals: Number(row.allow_withdrawals) === 1,
      deadline: String(row.deadline),
      status: row.status as SavingsGoal['status'],
      openingAmount: Number(row.opening_amount),
      contributions: contributedAmount,
      withdrawals: withdrawnAmount,
      fundedExpenses: fundedExpenseAmount,
      adjustments: adjustmentAmount,
      closingAmount: Number(row.balance_at_period_end),
      balanceAtPeriodEnd: Number(row.balance_at_period_end),
      contributedAmount,
      withdrawnAmount,
      fundedExpenseAmount,
      adjustmentAmount,
      netActivity: contributedAmount - withdrawnAmount - fundedExpenseAmount + adjustmentAmount,
    };
  });
}

export async function getPeriodSavingsFundingTotal(periodId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(expense.amount), 0) AS total
     FROM savings_goal_movements movement
     INNER JOIN expenses expense ON expense.id = movement.expense_id
     WHERE movement.kind = 'funded_expense' AND expense.period_id = ?`,
    periodId
  );
  return Number(row?.total ?? 0);
}

function mapPaymentMethod(row: Record<string, unknown>): PaymentMethod {
  const creditLimit = row.credit_limit == null ? null : Number(row.credit_limit);
  const reportedBalance = row.reported_balance == null ? null : Number(row.reported_balance);
  const registeredCharges = Number(row.registered_charges ?? 0);
  const registeredPayments = Number(row.registered_payments ?? 0);
  const registeredIncomes = Number(row.registered_incomes ?? 0);
  const registeredTransfersIn = Number(row.registered_transfers_in ?? 0);
  const registeredTransfersOut = Number(row.registered_transfers_out ?? 0);
  const installmentCommitments = Number(row.installment_commitments ?? 0);
  const availableBalance = reportedBalance == null
    ? null
    : calculateAvailableBalance(
        reportedBalance,
        registeredCharges,
        registeredPayments,
        installmentCommitments,
        registeredIncomes,
        registeredTransfersIn,
        registeredTransfersOut
      );
  return {
    id: row.id as number,
    name: row.name as string,
    type: row.type as PaymentMethod['type'],
    systemKey: row.system_key == null ? null : row.system_key as PaymentMethod['systemKey'],
    billingDay: row.billing_day == null ? null : Number(row.billing_day),
    color: row.color as string,
    active: Number(row.active) === 1,
    creditLimit,
    reportedBalance,
    balanceUpdatedAt: row.balance_updated_at == null ? null : String(row.balance_updated_at),
    balanceSyncedAt: row.balance_synced_at == null ? null : String(row.balance_synced_at),
    availableBalance,
    usedAmount: creditLimit == null || availableBalance == null
      ? null
      : Math.max(0, creditLimit - availableBalance),
    registeredCharges,
    registeredPayments,
    registeredIncomes,
    registeredTransfersIn,
    registeredTransfersOut,
    installmentCommitments,
    paymentDueDay: row.payment_due_day == null ? null : Number(row.payment_due_day),
    billedAmount: Math.max(0, Number(row.billed_amount ?? 0)),
    statementDate: row.statement_date == null ? null : String(row.statement_date),
  };
}

export async function getPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT method.*,
       COALESCE((
         SELECT SUM(charge.amount) FROM expenses charge
         WHERE charge.payment_method_id = method.id
           AND charge.debt_plan_id IS NULL
           AND charge.date <= DATE('now', 'localtime')
           AND (charge.date > method.balance_updated_at
             OR (charge.date = method.balance_updated_at AND charge.id > method.balance_expense_anchor_id))
       ), 0) AS registered_charges,
       COALESCE((
         SELECT SUM(payment.amount) FROM expenses payment
         WHERE payment.credit_payment_target_id = method.id
           AND payment.date <= DATE('now', 'localtime')
           AND (payment.date > method.balance_updated_at
             OR (payment.date = method.balance_updated_at AND payment.id > method.balance_payment_anchor_id))
       ), 0) AS registered_payments,
       COALESCE((
         SELECT SUM(income.amount) FROM incomes income
         WHERE income.payment_method_id = method.id
           AND income.date <= DATE('now', 'localtime')
           AND (income.date > method.balance_updated_at
             OR (income.date = method.balance_updated_at AND income.id > method.balance_income_anchor_id))
       ), 0) AS registered_incomes,
       COALESCE((
         SELECT SUM(transfer.amount) FROM account_transfers transfer
         WHERE transfer.destination_payment_method_id = method.id
           AND transfer.date <= DATE('now', 'localtime')
           AND (transfer.date > method.balance_updated_at
             OR (transfer.date = method.balance_updated_at AND transfer.id > method.balance_transfer_anchor_id))
       ), 0) AS registered_transfers_in,
       COALESCE((
         SELECT SUM(transfer.amount) FROM account_transfers transfer
         WHERE transfer.source_payment_method_id = method.id
           AND transfer.date <= DATE('now', 'localtime')
           AND (transfer.date > method.balance_updated_at
             OR (transfer.date = method.balance_updated_at AND transfer.id > method.balance_transfer_anchor_id))
       ), 0) AS registered_transfers_out,
       COALESCE((
         SELECT SUM(plan.total_amount) FROM debt_plans plan
         WHERE plan.payment_method_id = method.id
           AND plan.status != 'cancelled'
           AND plan.purchase_date <= DATE('now', 'localtime')
           AND (plan.purchase_date > method.balance_updated_at
             OR (plan.purchase_date = method.balance_updated_at AND plan.id > method.balance_debt_plan_anchor_id))
       ), 0) AS installment_commitments,
       (SELECT cycle.end_date FROM credit_card_cycles cycle
        WHERE cycle.payment_method_id = method.id
        ORDER BY cycle.end_date DESC LIMIT 1) AS statement_date,
       MAX(0,
         COALESCE((SELECT cycle.statement_amount FROM credit_card_cycles cycle
           WHERE cycle.payment_method_id = method.id
           ORDER BY cycle.end_date DESC LIMIT 1), 0)
         - COALESCE((SELECT SUM(payment.amount) FROM expenses payment
           WHERE payment.credit_payment_target_id = method.id
             AND payment.date >= COALESCE((SELECT cycle.end_date FROM credit_card_cycles cycle
               WHERE cycle.payment_method_id = method.id
               ORDER BY cycle.end_date DESC LIMIT 1), '9999-12-31')), 0)
       ) AS billed_amount
     FROM payment_methods method
     ${includeInactive ? '' : 'WHERE method.active = 1'}
     ORDER BY method.active DESC, method.type ASC, method.name COLLATE NOCASE ASC`
  );
  return rows.map(mapPaymentMethod);
}

export async function getPaymentMethodMovements(
  paymentMethodId: number,
  limit = 50
): Promise<PaymentMethodMovement[]> {
  const db = await getDb();
  const safeLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  const rows = await db.getAllAsync<{
    id: number;
    name: string;
    amount: number;
    date: string;
    kind: PaymentMethodMovement['kind'];
    category_name: string | null;
    related_payment_method_name: string | null;
  }>(
    `SELECT * FROM (
       SELECT
         expense.id,
         expense.name,
         expense.amount,
         expense.date,
         CASE
           WHEN expense.credit_payment_target_id = ? THEN 'credit_payment'
           ELSE 'expense'
         END AS kind,
         category.name AS category_name,
         CASE
           WHEN expense.credit_payment_target_id = ? THEN source_method.name
           ELSE target_method.name
         END AS related_payment_method_name
       FROM expenses expense
       LEFT JOIN categories category ON category.id = expense.category_id
       LEFT JOIN payment_methods source_method ON source_method.id = expense.payment_method_id
       LEFT JOIN payment_methods target_method ON target_method.id = expense.credit_payment_target_id
       WHERE (expense.payment_method_id = ? AND expense.debt_plan_id IS NULL)
          OR expense.credit_payment_target_id = ?

       UNION ALL

       SELECT
         plan.id,
         plan.name,
         plan.total_amount AS amount,
         plan.purchase_date AS date,
         'installment_purchase' AS kind,
         category.name AS category_name,
         NULL AS related_payment_method_name
       FROM debt_plans plan
       LEFT JOIN categories category ON category.id = plan.category_id
       WHERE plan.payment_method_id = ? AND plan.status != 'cancelled'

       UNION ALL

       SELECT
         income.id,
         income.name,
         income.amount,
         income.date,
         CASE WHEN savings_movement.kind = 'withdrawal' THEN 'savings_withdrawal' ELSE 'income' END AS kind,
         NULL AS category_name,
         savings_goal.name AS related_payment_method_name
       FROM incomes income
       LEFT JOIN savings_goal_movements savings_movement ON savings_movement.income_id = income.id
       LEFT JOIN savings_goals savings_goal ON savings_goal.id = savings_movement.goal_id
       WHERE income.payment_method_id = ?

       UNION ALL

       SELECT
         transfer.id,
         COALESCE(NULLIF(TRIM(transfer.note), ''), '') AS name,
         transfer.amount,
         transfer.date,
         'transfer_out' AS kind,
         NULL AS category_name,
         destination.name AS related_payment_method_name
       FROM account_transfers transfer
       INNER JOIN payment_methods destination ON destination.id = transfer.destination_payment_method_id
       WHERE transfer.source_payment_method_id = ?

       UNION ALL

       SELECT
         transfer.id,
         COALESCE(NULLIF(TRIM(transfer.note), ''), '') AS name,
         transfer.amount,
         transfer.date,
         'transfer_in' AS kind,
         NULL AS category_name,
         source.name AS related_payment_method_name
       FROM account_transfers transfer
       INNER JOIN payment_methods source ON source.id = transfer.source_payment_method_id
       WHERE transfer.destination_payment_method_id = ?
     )
     ORDER BY date DESC, id DESC
     LIMIT ?`,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    paymentMethodId,
    safeLimit
  );
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    amount: Number(row.amount),
    date: String(row.date),
    kind: row.kind,
    categoryName: row.category_name == null ? null : String(row.category_name),
    relatedPaymentMethodName: row.related_payment_method_name == null
      ? null
      : String(row.related_payment_method_name),
  }));
}

function mapAccountTransfer(row: Record<string, unknown>): AccountTransfer {
  return {
    id: Number(row.id),
    sourcePaymentMethodId: Number(row.source_payment_method_id),
    sourcePaymentMethodName: String(row.source_payment_method_name),
    sourcePaymentMethodColor: String(row.source_payment_method_color),
    destinationPaymentMethodId: Number(row.destination_payment_method_id),
    destinationPaymentMethodName: String(row.destination_payment_method_name),
    destinationPaymentMethodColor: String(row.destination_payment_method_color),
    amount: Number(row.amount),
    date: String(row.date),
    note: row.note == null ? null : String(row.note),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

const ACCOUNT_TRANSFER_SELECT = `
  SELECT transfer.*,
    source.name AS source_payment_method_name,
    source.color AS source_payment_method_color,
    destination.name AS destination_payment_method_name,
    destination.color AS destination_payment_method_color
  FROM account_transfers transfer
  INNER JOIN payment_methods source ON source.id = transfer.source_payment_method_id
  INNER JOIN payment_methods destination ON destination.id = transfer.destination_payment_method_id`;

export async function getAccountTransfer(id: number): Promise<AccountTransfer | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `${ACCOUNT_TRANSFER_SELECT} WHERE transfer.id = ?`,
    id
  );
  return row ? mapAccountTransfer(row) : null;
}

export async function getAccountTransfersForPeriod(periodId: number): Promise<AccountTransfer[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `${ACCOUNT_TRANSFER_SELECT}
     INNER JOIN periods period ON period.id = ?
     WHERE transfer.date BETWEEN period.start_date AND period.end_date
     ORDER BY transfer.date DESC, transfer.id DESC`,
    periodId
  );
  return rows.map(mapAccountTransfer);
}

async function validateAccountTransfer(
  db: SQLite.SQLiteDatabase,
  data: NewAccountTransfer,
  requireActive: boolean
): Promise<void> {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(t('database.transferAmountInvalid'));
  }
  if (!isValidIsoDate(data.date)) throw new Error(t('database.transferDateInvalid'));
  if (data.sourcePaymentMethodId === data.destinationPaymentMethodId) {
    throw new Error(t('database.transferSameAccount'));
  }
  const methods = await db.getAllAsync<{ id: number; type: PaymentMethod['type']; active: number }>(
    `SELECT id, type, active FROM payment_methods WHERE id IN (?, ?)`,
    data.sourcePaymentMethodId,
    data.destinationPaymentMethodId
  );
  if (methods.length !== 2) throw new Error(t('database.transferAccountMissing'));
  if (methods.some((method) => method.type === 'credit')) {
    throw new Error(t('database.transferCreditUnsupported'));
  }
  if (requireActive && methods.some((method) => Number(method.active) !== 1)) {
    throw new Error(t('database.transferActiveAccountRequired'));
  }
}

export async function createAccountTransfer(data: NewAccountTransfer): Promise<number> {
  const db = await getDb();
  let transferId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    await validateAccountTransfer(transaction, data, true);
    const result = await transaction.runAsync(
      `INSERT INTO account_transfers (
         source_payment_method_id, destination_payment_method_id, amount, date, note
       ) VALUES (?, ?, ?, ?, ?)`,
      data.sourcePaymentMethodId,
      data.destinationPaymentMethodId,
      data.amount,
      data.date,
      data.note?.trim() || null
    );
    transferId = result.lastInsertRowId;
  });
  return transferId;
}

export async function updateAccountTransfer(id: number, data: NewAccountTransfer): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const current = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM account_transfers WHERE id = ?',
      id
    );
    if (!current) throw new Error(t('database.transferMissing'));
    await validateAccountTransfer(transaction, data, false);
    await transaction.runAsync(
      `UPDATE account_transfers
       SET source_payment_method_id = ?, destination_payment_method_id = ?, amount = ?,
           date = ?, note = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.sourcePaymentMethodId,
      data.destinationPaymentMethodId,
      data.amount,
      data.date,
      data.note?.trim() || null,
      id
    );
  });
}

export async function deleteAccountTransfer(id: number): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync('DELETE FROM account_transfers WHERE id = ?', id);
  if (result.changes === 0) throw new Error(t('database.transferMissing'));
}

function validatePaymentMethod(data: NewPaymentMethod) {
  if (!data.name.trim()) throw new Error(t('database.paymentNameRequired'));
  if (!/^#[0-9a-f]{6}$/i.test(data.color)) throw new Error(t('database.invalidColor'));
  if (data.type === 'credit') {
    if (data.billingDay == null || data.billingDay < 1 || data.billingDay > 31) {
      throw new Error(t('database.invalidBillingDay'));
    }
    if (data.creditLimit == null || !Number.isInteger(data.creditLimit) || data.creditLimit <= 0) {
      throw new Error(t('database.creditLimitRequired'));
    }
    if (data.paymentDueDay == null || data.paymentDueDay < 1 || data.paymentDueDay > 31) {
      throw new Error(t('database.invalidPaymentDueDay'));
    }
  }
  if (data.reportedBalance != null && (!Number.isInteger(data.reportedBalance) || data.reportedBalance < 0)) {
    throw new Error(t('database.paymentBalanceInvalid'));
  }
  if (data.type !== 'cash' && data.reportedBalance != null && !data.balanceDate) {
    throw new Error(t('database.paymentBalanceDateRequired'));
  }
}

export async function createPaymentMethod(data: NewPaymentMethod): Promise<void> {
  validatePaymentMethod(data);
  const db = await getDb();
  if (data.type === 'cash') throw new Error(t('database.cashAccountAlreadyProvided'));
  await db.runAsync(
    `INSERT INTO payment_methods (
       name, type, billing_day, color, active, credit_limit, reported_balance,
       balance_updated_at, balance_synced_at, payment_due_day
     ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
    data.name.trim(),
    data.type,
    data.type === 'credit' ? data.billingDay : null,
    data.color.toLowerCase(),
    data.type === 'credit' ? data.creditLimit : null,
    data.reportedBalance,
    data.balanceDate,
    data.reportedBalance == null ? null : new Date().toISOString(),
    data.type === 'credit' ? data.paymentDueDay : null
  );
}

export async function updatePaymentMethod(id: number, data: NewPaymentMethod): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ type: PaymentMethod['type'] }>(
    'SELECT type FROM payment_methods WHERE id = ?',
    id
  );
  if (!current) throw new Error(t('database.paymentMissing'));
  const immutableTypeData = { ...data, type: current.type };
  validatePaymentMethod(immutableTypeData);
  await db.runAsync(
    `UPDATE payment_methods
     SET name = ?, billing_day = ?, color = ?, credit_limit = ?, payment_due_day = ?
     WHERE id = ?`,
    data.name.trim(),
    current.type === 'credit' ? data.billingDay : null,
    data.color.toLowerCase(),
    current.type === 'credit' ? data.creditLimit : null,
    current.type === 'credit' ? data.paymentDueDay : null,
    id
  );
}

export async function updatePaymentMethodBalance(
  id: number,
  data: NewPaymentMethodBalance
): Promise<void> {
  if (!Number.isInteger(data.balance) || data.balance < 0) {
    throw new Error(t('database.paymentBalanceInvalid'));
  }
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const method = await transaction.getFirstAsync<{ type: PaymentMethod['type'] }>(
      'SELECT type FROM payment_methods WHERE id = ?',
      id
    );
    if (!method) throw new Error(t('database.paymentMissing'));
    const chargeAnchor = await transaction.getFirstAsync<{ id: number }>(
      'SELECT COALESCE(MAX(id), 0) AS id FROM expenses WHERE payment_method_id = ? AND date <= ?',
      id,
      data.date
    );
    const paymentAnchor = await transaction.getFirstAsync<{ id: number }>(
      'SELECT COALESCE(MAX(id), 0) AS id FROM expenses WHERE credit_payment_target_id = ? AND date <= ?',
      id,
      data.date
    );
    const debtPlanAnchor = await transaction.getFirstAsync<{ id: number }>(
      'SELECT COALESCE(MAX(id), 0) AS id FROM debt_plans WHERE payment_method_id = ? AND purchase_date <= ?',
      id,
      data.date
    );
    const incomeAnchor = await transaction.getFirstAsync<{ id: number }>(
      'SELECT COALESCE(MAX(id), 0) AS id FROM incomes WHERE payment_method_id = ? AND date <= ?',
      id,
      data.date
    );
    const transferAnchor = await transaction.getFirstAsync<{ id: number }>(
      `SELECT COALESCE(MAX(id), 0) AS id FROM account_transfers
       WHERE (source_payment_method_id = ? OR destination_payment_method_id = ?) AND date <= ?`,
      id,
      id,
      data.date
    );
    await transaction.runAsync(
      `UPDATE payment_methods
       SET reported_balance = ?, balance_updated_at = ?,
           balance_synced_at = ?,
           balance_expense_anchor_id = ?, balance_payment_anchor_id = ?, balance_income_anchor_id = ?,
           balance_debt_plan_anchor_id = ?, balance_transfer_anchor_id = ?
       WHERE id = ?`,
      data.balance,
      data.date,
      new Date().toISOString(),
      Number(chargeAnchor?.id ?? 0),
      Number(paymentAnchor?.id ?? 0),
      Number(incomeAnchor?.id ?? 0),
      Number(debtPlanAnchor?.id ?? 0),
      Number(transferAnchor?.id ?? 0),
      id
    );
  });
}

export async function setPaymentMethodActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const current = await transaction.getFirstAsync<{ id: number; system_key: string | null }>(
      'SELECT id, system_key FROM payment_methods WHERE id = ?',
      id
    );
    if (!current) throw new Error(t('database.paymentMissing'));
    if (current.system_key === 'cash' && !active) {
      throw new Error(t('database.cashAccountRequired'));
    }
    await transaction.runAsync('UPDATE payment_methods SET active = ? WHERE id = ?', active ? 1 : 0, id);
    if (!active) {
      await transaction.runAsync(
        `UPDATE settings
         SET default_payment_method_id = (SELECT id FROM payment_methods WHERE system_key = 'cash' LIMIT 1)
         WHERE default_payment_method_id = ?`,
        id
      );
    }
  });
}

export async function setDefaultPaymentMethod(id: number | null): Promise<void> {
  const db = await getDb();
  if (id == null) {
    const cash = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM payment_methods WHERE system_key = 'cash' AND active = 1 LIMIT 1"
    );
    if (!cash) throw new Error(t('database.cashAccountRequired'));
    id = cash.id;
  }
  if (id != null) {
    const method = await db.getFirstAsync<{ active: number }>(
      'SELECT active FROM payment_methods WHERE id = ?',
      id
    );
    if (!method || Number(method.active) !== 1) {
      throw new Error(t('database.activePaymentOnly'));
    }
  }
  await db.runAsync('UPDATE settings SET default_payment_method_id = ? WHERE id = 1', id);
}

export async function getPaymentMethodDeletionInfo(id: number): Promise<{
  expenseCount: number;
  debtPlanCount: number;
  receivedPaymentCount: number;
  transferCount: number;
}> {
  const db = await getDb();
  const row = await db.getFirstAsync<{
    expense_count: number;
    debt_plan_count: number;
    received_payment_count: number;
    transfer_count: number;
  }>(
    `SELECT
      (SELECT COUNT(*) FROM expenses WHERE payment_method_id = ?) AS expense_count,
      (SELECT COUNT(*) FROM debt_plans WHERE payment_method_id = ?) AS debt_plan_count,
      (SELECT COUNT(*) FROM expenses WHERE credit_payment_target_id = ?) AS received_payment_count,
      (SELECT COUNT(*) FROM account_transfers
       WHERE source_payment_method_id = ? OR destination_payment_method_id = ?) AS transfer_count`,
    id, id, id, id, id
  );
  return {
    expenseCount: Number(row?.expense_count ?? 0),
    debtPlanCount: Number(row?.debt_plan_count ?? 0),
    receivedPaymentCount: Number(row?.received_payment_count ?? 0),
    transferCount: Number(row?.transfer_count ?? 0),
  };
}

export async function deletePaymentMethod(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const method = await transaction.getFirstAsync<{ id: number; system_key: string | null }>(
      'SELECT id, system_key FROM payment_methods WHERE id = ?', id
    );
    if (!method) throw new Error(t('database.paymentMissing'));
    if (method.system_key === 'cash') throw new Error(t('database.cashAccountRequired'));
    const favorite = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM settings WHERE default_payment_method_id = ?', id
    );
    if (favorite) {
      throw new Error(t('database.favoritePaymentDelete'));
    }
    const plans = await transaction.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM debt_plans WHERE payment_method_id = ?', id
    );
    if (Number(plans?.count ?? 0) > 0) {
      throw new Error(t('database.paymentDebtDelete'));
    }
    const receivedPayments = await transaction.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM expenses WHERE credit_payment_target_id = ?', id
    );
    if (Number(receivedPayments?.count ?? 0) > 0) {
      throw new Error(t('database.paymentReceivedPaymentsDelete'));
    }
    const transfers = await transaction.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM account_transfers
       WHERE source_payment_method_id = ? OR destination_payment_method_id = ?`,
      id,
      id
    );
    if (Number(transfers?.count ?? 0) > 0) {
      throw new Error(t('database.paymentTransferDelete'));
    }
    await transaction.runAsync('UPDATE expenses SET payment_method_id = NULL WHERE payment_method_id = ?', id);
    await transaction.runAsync('UPDATE recurring_expenses SET payment_method_id = NULL WHERE payment_method_id = ?', id);
    await transaction.runAsync('UPDATE incomes SET payment_method_id = NULL WHERE payment_method_id = ?', id);
    await transaction.runAsync('UPDATE recurring_incomes SET payment_method_id = NULL WHERE payment_method_id = ?', id);
    await transaction.runAsync('DELETE FROM payment_methods WHERE id = ?', id);
  });
}

export async function getPaymentMethodTotals(periodId: number): Promise<PaymentMethodTotal[]> {
  const db = await getDb();
  return db.getAllAsync<PaymentMethodTotal>(
    `SELECT paymentMethodId, paymentMethodName, paymentMethodType, paymentMethodColor,
       SUM(amount) AS total
     FROM (
       SELECT e.amount,
         CASE WHEN savingsMovement.kind = 'funded_expense' THEN ? ELSE e.payment_method_id END AS paymentMethodId,
         CASE WHEN savingsMovement.kind = 'funded_expense' THEN ? ELSE COALESCE(pm.name, ?) END AS paymentMethodName,
         CASE WHEN savingsMovement.kind = 'funded_expense' THEN NULL ELSE pm.type END AS paymentMethodType,
         CASE WHEN savingsMovement.kind = 'funded_expense' THEN '#8e44ad' ELSE pm.color END AS paymentMethodColor
       FROM expenses e
       LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
       LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.expense_id = e.id
       WHERE e.period_id = ?
     )
     GROUP BY paymentMethodId, paymentMethodName, paymentMethodType, paymentMethodColor
     ORDER BY total DESC`,
    VIRTUAL_SAVINGS_PAYMENT_METHOD_ID,
    t('savings.withdrawalPaymentMethod'),
    t('common.notSpecified'),
    periodId
  );
}

function addDaysToIso(value: string, days: number): string {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function firstCycleStart(endDate: string): string {
  const [year, month, day] = endDate.split('-').map(Number);
  const previousMonthLastDay = new Date(year, month - 1, 0).getDate();
  const previousClose = new Date(year, month - 2, Math.min(day, previousMonthLastDay), 12);
  const iso = `${previousClose.getFullYear()}-${String(previousClose.getMonth() + 1).padStart(2, '0')}-${String(previousClose.getDate()).padStart(2, '0')}`;
  return addDaysToIso(iso, 1);
}

export async function getCreditCardCycles(paymentMethodId: number): Promise<CreditCardCycle[]> {
  const db = await getDb();
  return db.getAllAsync<CreditCardCycle>(
    `SELECT
       cc.id,
       cc.payment_method_id AS paymentMethodId,
       cc.start_date AS startDate,
       cc.end_date AS endDate,
       cc.statement_amount AS statementAmount,
       cc.status,
       COALESCE(bank_charge.amount, 0) AS bankChargeAmount,
       COALESCE(adjustment.amount, 0) AS adjustmentAmount,
       COALESCE(SUM(e.amount), 0) AS recordedTotal
     FROM credit_card_cycles cc
     LEFT JOIN expenses bank_charge ON bank_charge.id = cc.bank_charge_expense_id
     LEFT JOIN expenses adjustment ON adjustment.id = cc.adjustment_expense_id
     LEFT JOIN expenses e
       ON e.payment_method_id = cc.payment_method_id
      AND e.date >= cc.start_date
      AND e.date <= cc.end_date
     WHERE cc.payment_method_id = ?
     GROUP BY cc.id
     ORDER BY cc.end_date DESC`,
    paymentMethodId
  );
}

export async function createCreditCardCycle(data: NewCreditCardCycle): Promise<void> {
  const db = await getDb();
  const method = await db.getFirstAsync<{ type: string }>(
    'SELECT type FROM payment_methods WHERE id = ?',
    data.paymentMethodId
  );
  if (method?.type !== 'credit') throw new Error(t('database.notCreditCard'));
  const latest = await db.getFirstAsync<{ end_date: string }>(
    `SELECT end_date FROM credit_card_cycles
     WHERE payment_method_id = ? ORDER BY end_date DESC LIMIT 1`,
    data.paymentMethodId
  );
  if (latest && data.endDate <= latest.end_date) {
    throw new Error(t('database.billingAfterLast'));
  }
  const previous = await db.getFirstAsync<{ end_date: string }>(
    `SELECT end_date FROM credit_card_cycles
     WHERE payment_method_id = ? AND end_date < ?
     ORDER BY end_date DESC LIMIT 1`,
    data.paymentMethodId,
    data.endDate
  );
  const startDate = previous ? addDaysToIso(previous.end_date, 1) : firstCycleStart(data.endDate);
  if (startDate > data.endDate) throw new Error(t('database.invalidBillingDate'));
  await db.runAsync(
    `INSERT INTO credit_card_cycles
      (payment_method_id, start_date, end_date, statement_amount, status)
     VALUES (?, ?, ?, ?, ?)`,
    data.paymentMethodId,
    startDate,
    data.endDate,
    data.statementAmount,
    data.status
  );
}

export async function updateCreditCardCycle(
  id: number,
  statementAmount: number | null,
  status: CreditCardCycle['status']
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE credit_card_cycles SET statement_amount = ?, status = ? WHERE id = ?',
    statementAmount,
    status,
    id
  );
}

async function getOrCreateBankFeesCategory(transaction: SQLite.SQLiteDatabase): Promise<number> {
  const existing = await transaction.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ?',
    t('database.bankFeesCategory')
  );
  if (existing) return existing.id;
  const palette = ['#7c3aed', '#6d28d9', '#5b21b6', '#4338ca', '#3730a3'];
  let color = palette[0];
  for (const candidate of palette) {
    const used = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM categories WHERE color = ?',
      candidate
    );
    if (!used) {
      color = candidate;
      break;
    }
  }
  const result = await transaction.runAsync(
    `INSERT INTO categories (name, color, period_limit)
     VALUES (?, ?, NULL)`,
    t('database.bankFeesCategory'),
    color
  );
  return result.lastInsertRowId;
}

export async function reconcileCreditCardCycle(
  id: number,
  data: ReconcileCreditCardCycle
): Promise<void> {
  if (!Number.isFinite(data.statementAmount) || data.statementAmount < 0) {
    throw new Error(t('database.actualBillingRequired'));
  }
  if (!Number.isFinite(data.bankChargeAmount) || data.bankChargeAmount < 0) {
    throw new Error(t('database.invalidBankCharge'));
  }
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const cycle = await transaction.getFirstAsync<{
      id: number;
      payment_method_id: number;
      end_date: string;
      status: CreditCardCycle['status'];
      recorded_total: number;
    }>(
      `SELECT
        cycle.id,
        cycle.payment_method_id,
        cycle.end_date,
        cycle.status,
        COALESCE(SUM(expense.amount), 0) AS recorded_total
       FROM credit_card_cycles cycle
       LEFT JOIN expenses expense
         ON expense.payment_method_id = cycle.payment_method_id
        AND expense.date >= cycle.start_date
        AND expense.date <= cycle.end_date
       WHERE cycle.id = ?
       GROUP BY cycle.id`,
      id
    );
    if (!cycle) throw new Error(t('database.cycleMissing'));
    if (cycle.status === 'reconciled') throw new Error(t('database.cycleReconciled'));

    const period = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
      cycle.end_date,
      cycle.end_date
    );
    if (!period) throw new Error(t('database.noBillingPeriod'));
    const categoryId = await getOrCreateBankFeesCategory(transaction);
    let bankChargeExpenseId: number | null = null;
    if (data.bankChargeAmount > 0) {
      const result = await transaction.runAsync(
        `INSERT INTO expenses
          (name, amount, category_id, period_id, date, original_amount, split_percentage,
           payment_method_id, recurring_expense_id)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
        t('database.maintenance'),
        data.bankChargeAmount,
        categoryId,
        period.id,
        cycle.end_date,
        cycle.payment_method_id
      );
      bankChargeExpenseId = result.lastInsertRowId;
    }

    const adjustmentAmount = data.statementAmount - cycle.recorded_total - data.bankChargeAmount;
    let adjustmentExpenseId: number | null = null;
    if (adjustmentAmount !== 0) {
      const result = await transaction.runAsync(
        `INSERT INTO expenses
          (name, amount, category_id, period_id, date, original_amount, split_percentage,
           payment_method_id, recurring_expense_id)
         VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
        t('database.billingDifference'),
        adjustmentAmount,
        categoryId,
        period.id,
        cycle.end_date,
        cycle.payment_method_id
      );
      adjustmentExpenseId = result.lastInsertRowId;
    }

    await transaction.runAsync(
      `UPDATE credit_card_cycles
       SET statement_amount = ?, status = 'reconciled', bank_charge_expense_id = ?,
           adjustment_expense_id = ?, reconciled_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.statementAmount,
      bankChargeExpenseId,
      adjustmentExpenseId,
      id
    );
  });
}

export async function unreconcileCreditCardCycle(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const cycle = await transaction.getFirstAsync<{
      status: CreditCardCycle['status'];
      bank_charge_expense_id: number | null;
      adjustment_expense_id: number | null;
    }>(
      `SELECT status, bank_charge_expense_id, adjustment_expense_id
       FROM credit_card_cycles WHERE id = ?`,
      id
    );
    if (!cycle) throw new Error(t('database.statementMissing'));
    if (cycle.status !== 'reconciled') return;

    await transaction.runAsync(
      `UPDATE credit_card_cycles
       SET status = 'pending', bank_charge_expense_id = NULL,
           adjustment_expense_id = NULL, reconciled_at = NULL
       WHERE id = ?`,
      id
    );
    if (cycle.bank_charge_expense_id != null) {
      await transaction.runAsync('DELETE FROM expenses WHERE id = ?', cycle.bank_charge_expense_id);
    }
    if (cycle.adjustment_expense_id != null) {
      await transaction.runAsync('DELETE FROM expenses WHERE id = ?', cycle.adjustment_expense_id);
    }
  });
}

export async function createInstallmentPurchase(data: NewInstallmentPurchase): Promise<number> {
  if (!data.name.trim()) throw new Error(t('database.purchaseNameRequired'));
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) throw new Error(t('database.invalidTotal'));
  if (!Number.isInteger(data.totalInstallments) || data.totalInstallments < 2 || data.totalInstallments > 600) {
    throw new Error(t('installments.invalidCount'));
  }
  const db = await getDb();
  const method = await db.getFirstAsync<{ type: string }>('SELECT type FROM payment_methods WHERE id = ?', data.paymentMethodId);
  if (method?.type !== 'credit') throw new Error(t('database.installmentRequiresCredit'));
  let planId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const amounts = calculateInstallmentAmounts(data.totalAmount, data.totalInstallments);
    const result = await transaction.runAsync(
      `INSERT INTO debt_plans
        (kind, name, total_amount, category_id, payment_method_id, purchase_date,
         first_due_date, total_installments, installment_amount, status)
       VALUES ('credit_installment', ?, ?, ?, ?, ?, ?, ?, ?, 'projected')`,
      data.name.trim(), data.totalAmount, data.categoryId, data.paymentMethodId,
      data.purchaseDate, data.firstDueDate, data.totalInstallments,
      amounts[0]
    );
    planId = result.lastInsertRowId;
    const preferredDay = Number(data.firstDueDate.slice(8, 10));
    for (let index = 0; index < data.totalInstallments; index += 1) {
      await transaction.runAsync(
        `INSERT INTO debt_installments
          (debt_plan_id, installment_number, due_date, projected_amount, status)
         VALUES (?, ?, ?, ?, 'projected')`,
        planId, index + 1, addIsoMonths(data.firstDueDate, index, preferredDay), amounts[index]
      );
    }
  });
  return planId;
}

export async function getDebtPlans(paymentMethodId?: number): Promise<DebtPlan[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT p.*, pm.name AS payment_method_name, pm.color AS payment_method_color,
      c.name AS category_name, c.color AS category_color,
      SUM(CASE WHEN i.status = 'posted' THEN 1 ELSE 0 END) AS posted_installments,
      (SELECT COUNT(*) FROM expenses e WHERE e.debt_plan_id = p.id) AS linked_expense_count,
      (SELECT e.id FROM expenses e
       WHERE e.debt_plan_id = p.id AND e.debt_installment_id IS NULL
       ORDER BY e.id DESC LIMIT 1) AS settlement_expense_id,
      COALESCE(SUM(CASE WHEN i.status = 'projected' THEN i.projected_amount ELSE 0 END), 0) AS remaining_amount
     FROM debt_plans p
     INNER JOIN payment_methods pm ON pm.id = p.payment_method_id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN debt_installments i ON i.debt_plan_id = p.id
     WHERE (? IS NULL OR p.payment_method_id = ?)
     GROUP BY p.id
     ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'projected' THEN 1 ELSE 2 END, p.created_at DESC`,
    paymentMethodId ?? null, paymentMethodId ?? null
  );
  return rows.map((row) => ({
    id: Number(row.id), kind: 'credit_installment', name: String(row.name),
    totalAmount: Number(row.total_amount), categoryId: row.category_id == null ? null : Number(row.category_id),
    paymentMethodId: Number(row.payment_method_id), purchaseDate: String(row.purchase_date),
    firstDueDate: String(row.first_due_date), totalInstallments: Number(row.total_installments),
    installmentAmount: Number(row.installment_amount), status: row.status as DebtPlan['status'],
    paymentMethodName: String(row.payment_method_name), paymentMethodColor: String(row.payment_method_color),
    categoryName: row.category_name == null ? null : String(row.category_name),
    categoryColor: row.category_color == null ? null : String(row.category_color),
    postedInstallments: Number(row.posted_installments),
    linkedExpenseCount: Number(row.linked_expense_count),
    settlementExpenseId: row.settlement_expense_id == null ? null : Number(row.settlement_expense_id),
    remainingAmount: Number(row.remaining_amount),
  }));
}

export async function getDebtPlan(id: number): Promise<DebtPlan | null> {
  const plans = await getDebtPlans();
  const plan = plans.find((item) => item.id === id);
  if (!plan) return null;
  const db = await getDb();
  const installments = await db.getAllAsync<{
    id: number; number: number; dueDate: string; projectedAmount: number; expenseId: number | null; status: DebtPlan['status']; manuallyRemoved: number;
  }>(
    `SELECT i.id, i.installment_number AS number, i.due_date AS dueDate,
      COALESCE(e.amount, i.projected_amount) AS projectedAmount,
      i.expense_id AS expenseId, i.status, i.manually_removed AS manuallyRemoved
     FROM debt_installments i LEFT JOIN expenses e ON e.id = i.expense_id
     WHERE i.debt_plan_id = ? ORDER BY i.installment_number`, id
  );
  return {
    ...plan,
    installments: installments.map((item) => ({
      ...item,
      manuallyRemoved: item.manuallyRemoved === 1,
    })) as DebtPlan['installments'],
  };
}

function validateDebt(data: NewDebt): void {
  if (!data.name.trim()) throw new Error(t('database.debtNameRequired'));
  if (!Number.isInteger(data.initialAmount) || data.initialAmount <= 0) {
    throw new Error(t('database.debtInitialAmountRequired'));
  }
  if (data.installmentAmount != null && data.installmentAmount > data.initialAmount) {
    throw new Error(t('database.debtInstallmentTooHigh'));
  }
  if (data.type === 'fixed') {
    if (data.installmentAmount == null || !Number.isInteger(data.installmentAmount) || data.installmentAmount <= 0) {
      throw new Error(t('database.debtInstallmentRequired'));
    }
    if (!data.frequency || !data.firstDueDate) {
      throw new Error(t('database.debtScheduleRequired'));
    }
  } else if (data.installmentAmount != null && (!Number.isInteger(data.installmentAmount) || data.installmentAmount <= 0 || !data.firstDueDate)) {
    throw new Error(t('database.debtVariableEstimateInvalid'));
  }
}

function nextDebtDueDate(
  firstDueDate: string | null,
  frequency: Debt['frequency'],
  paymentCount: number
): string | null {
  if (!firstDueDate || !frequency) return null;
  if (frequency === 'weekly') return addIsoDays(firstDueDate, paymentCount * 7);
  if (frequency === 'annual') return addIsoMonths(firstDueDate, paymentCount * 12);
  return addIsoMonths(firstDueDate, paymentCount);
}

function mapDebt(row: Record<string, unknown>): Debt {
  const initialAmount = Number(row.initial_amount);
  const currentBalance = Math.max(0, Number(row.current_balance));
  const installmentAmount = row.installment_amount == null ? null : Number(row.installment_amount);
  const paymentCount = Number(row.payment_count);
  const storedStatus = String(row.status) as Debt['status'];
  const status = storedStatus === 'archived' ? 'archived' : currentBalance === 0 ? 'paid' : 'active';
  return {
    id: Number(row.id),
    type: row.type as Debt['type'],
    name: String(row.name),
    creditor: row.creditor == null ? null : String(row.creditor),
    initialAmount,
    installmentAmount,
    frequency: row.frequency == null ? null : row.frequency as Debt['frequency'],
    firstDueDate: row.first_due_date == null ? null : String(row.first_due_date),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    paymentMethodId: row.payment_method_id == null ? null : Number(row.payment_method_id),
    notes: row.notes == null ? null : String(row.notes),
    status,
    currentBalance,
    paidAmount: Number(row.paid_amount),
    paymentCount,
    entryCount: Number(row.entry_count),
    totalInstallments: row.type === 'fixed' && installmentAmount != null ? Math.ceil(initialAmount / installmentAmount) : null,
    nextDueDate: status === 'active'
      ? nextDebtDueDate(
          row.first_due_date == null ? null : String(row.first_due_date),
          row.frequency == null ? null : row.frequency as Debt['frequency'],
          paymentCount
        )
      : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function getDebts(): Promise<Debt[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(`
    SELECT d.*,
      COUNT(entry.id) AS entry_count,
      COALESCE(SUM(CASE WHEN entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0) AS paid_amount,
      COALESCE(SUM(CASE WHEN entry.kind = 'payment' THEN 1 ELSE 0 END), 0) AS payment_count,
      d.initial_amount
        + COALESCE(SUM(CASE WHEN entry.kind = 'adjustment' THEN entry.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0)
        AS current_balance
    FROM manual_debts d
    LEFT JOIN manual_debt_entries entry ON entry.debt_id = d.id
    GROUP BY d.id
    ORDER BY CASE d.status WHEN 'archived' THEN 2 ELSE 0 END, d.updated_at DESC, d.id DESC
  `);
  return rows.map(mapDebt);
}

export async function getDebt(id: number): Promise<Debt | null> {
  const debt = (await getDebts()).find((item) => item.id === id);
  if (!debt) return null;
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT entry.*, expense.category_id, category.name AS category_name,
      expense.payment_method_id, payment.name AS payment_method_name
     FROM manual_debt_entries entry
     LEFT JOIN expenses expense ON expense.id = entry.expense_id
     LEFT JOIN categories category ON category.id = expense.category_id
     LEFT JOIN payment_methods payment ON payment.id = expense.payment_method_id
     WHERE entry.debt_id = ?
     ORDER BY entry.date DESC, entry.id DESC`,
    id
  );
  const entries: DebtEntry[] = rows.map((row) => ({
    id: Number(row.id), debtId: Number(row.debt_id), kind: row.kind as DebtEntry['kind'],
    amount: Number(row.amount), date: String(row.date),
    periodId: row.period_id == null ? null : Number(row.period_id),
    expenseId: row.expense_id == null ? null : Number(row.expense_id),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    categoryName: row.category_name == null ? null : String(row.category_name),
    paymentMethodId: row.payment_method_id == null ? null : Number(row.payment_method_id),
    paymentMethodName: row.payment_method_name == null ? null : String(row.payment_method_name),
    note: row.note == null ? null : String(row.note),
  }));
  return { ...debt, entries };
}

export async function createDebt(data: NewDebt): Promise<number> {
  validateDebt(data);
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT INTO manual_debts
      (type, name, creditor, initial_amount, installment_amount, frequency,
       first_due_date, category_id, payment_method_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.type, data.name.trim(), data.creditor?.trim() || null, data.initialAmount,
    data.installmentAmount,
    data.type === 'fixed' ? data.frequency : data.installmentAmount != null ? 'monthly' : null,
    data.installmentAmount != null ? data.firstDueDate : null,
    data.categoryId, data.paymentMethodId, data.notes?.trim() || null
  );
  return result.lastInsertRowId;
}

export async function updateDebt(id: number, data: NewDebt): Promise<void> {
  validateDebt(data);
  const db = await getDb();
  const existing = await db.getFirstAsync<{ type: string; initial_amount: number; entry_count: number }>(
    `SELECT d.type, d.initial_amount, COUNT(entry.id) AS entry_count
     FROM manual_debts d LEFT JOIN manual_debt_entries entry ON entry.debt_id = d.id
     WHERE d.id = ? GROUP BY d.id`, id
  );
  if (!existing) throw new Error(t('database.debtMissing'));
  if (existing.type !== data.type) throw new Error(t('database.debtTypeLocked'));
  if (existing.entry_count > 0 && existing.initial_amount !== data.initialAmount) {
    throw new Error(t('database.debtInitialLocked'));
  }
  await db.runAsync(
    `UPDATE manual_debts SET name = ?, creditor = ?, initial_amount = ?, installment_amount = ?,
      frequency = ?, first_due_date = ?, category_id = ?, payment_method_id = ?, notes = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    data.name.trim(), data.creditor?.trim() || null, data.initialAmount,
    data.installmentAmount,
    data.type === 'fixed' ? data.frequency : data.installmentAmount != null ? 'monthly' : null,
    data.installmentAmount != null ? data.firstDueDate : null,
    data.categoryId, data.paymentMethodId, data.notes?.trim() || null, id
  );
}

async function getDebtBalance(db: SQLite.SQLiteDatabase, id: number): Promise<number> {
  const row = await db.getFirstAsync<{ balance: number }>(
    `SELECT d.initial_amount
      + COALESCE(SUM(CASE WHEN entry.kind = 'adjustment' THEN entry.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0) AS balance
     FROM manual_debts d LEFT JOIN manual_debt_entries entry ON entry.debt_id = d.id
     WHERE d.id = ? GROUP BY d.id`, id
  );
  if (!row) throw new Error(t('database.debtMissing'));
  return Math.max(0, Number(row.balance));
}

async function assertDebtPaymentMethodExists(db: SQLite.SQLiteDatabase, id: number | null): Promise<void> {
  if (id == null) return;
  const method = await db.getFirstAsync<{ id: number }>('SELECT id FROM payment_methods WHERE id = ?', id);
  if (!method) throw new Error(t('database.paymentMethodMissing'));
}

export async function createDebtPayment(debtId: number, data: NewDebtPayment): Promise<void> {
  if (!Number.isInteger(data.amount) || data.amount <= 0) throw new Error(t('validation.invalidAmount'));
  const db = await getDb();
  await assertDateBelongsToPeriod(db, data.periodId, data.date);
  await assertDebtPaymentMethodExists(db, data.paymentMethodId);
  await assertCreditPaymentSelection(db, data.categoryId, data.paymentMethodId, null);
  await assertCreditCardCycleIsEditable(db, data.paymentMethodId, data.date);
  await withExclusiveTransaction(db, async (transaction) => {
    const debt = await transaction.getFirstAsync<{ name: string }>('SELECT name FROM manual_debts WHERE id = ?', debtId);
    if (!debt) throw new Error(t('database.debtMissing'));
    const balance = await getDebtBalance(transaction, debtId);
    if (data.amount > balance) throw new Error(t('database.debtPaymentTooHigh'));
    const expense = await transaction.runAsync(
      `INSERT INTO expenses
        (name, amount, category_id, period_id, date, original_amount, split_percentage, payment_method_id)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?)`,
      t('database.debtPayment', { name: debt.name }), data.amount, data.categoryId,
      data.periodId, data.date, data.paymentMethodId
    );
    await transaction.runAsync(
      `INSERT INTO manual_debt_entries (debt_id, kind, amount, date, period_id, expense_id, note)
       VALUES (?, 'payment', ?, ?, ?, ?, ?)`,
      debtId, data.amount, data.date, data.periodId, expense.lastInsertRowId, data.note?.trim() || null
    );
    await transaction.runAsync('UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', debtId);
  });
}

export async function updateDebtPayment(entryId: number, data: NewDebtPayment): Promise<void> {
  if (!Number.isInteger(data.amount) || data.amount <= 0) throw new Error(t('validation.invalidAmount'));
  const db = await getDb();
  await assertDateBelongsToPeriod(db, data.periodId, data.date);
  await assertDebtPaymentMethodExists(db, data.paymentMethodId);
  await assertCreditPaymentSelection(db, data.categoryId, data.paymentMethodId, null);
  await withExclusiveTransaction(db, async (transaction) => {
    const entry = await transaction.getFirstAsync<{
      debt_id: number;
      expense_id: number;
      amount: number;
      name: string;
      payment_method_id: number | null;
      expense_date: string;
    }>(
      `SELECT entry.debt_id, entry.expense_id, entry.amount, debt.name,
        expense.payment_method_id, expense.date AS expense_date
       FROM manual_debt_entries entry INNER JOIN manual_debts debt ON debt.id = entry.debt_id
       INNER JOIN expenses expense ON expense.id = entry.expense_id
       WHERE entry.id = ? AND entry.kind = 'payment'`, entryId
    );
    if (!entry) throw new Error(t('database.debtPaymentMissing'));
    await assertCreditCardCycleIsEditable(transaction, entry.payment_method_id, entry.expense_date);
    await assertCreditCardCycleIsEditable(transaction, data.paymentMethodId, data.date);
    const available = await getDebtBalance(transaction, entry.debt_id) + entry.amount;
    if (data.amount > available) throw new Error(t('database.debtPaymentTooHigh'));
    await transaction.runAsync(
      `UPDATE expenses SET name = ?, amount = ?, category_id = ?, period_id = ?, date = ?,
       payment_method_id = ? WHERE id = ?`,
      t('database.debtPayment', { name: entry.name }), data.amount, data.categoryId,
      data.periodId, data.date, data.paymentMethodId, entry.expense_id
    );
    await transaction.runAsync(
      `UPDATE manual_debt_entries SET amount = ?, date = ?, period_id = ?, note = ? WHERE id = ?`,
      data.amount, data.date, data.periodId, data.note?.trim() || null, entryId
    );
    await transaction.runAsync('UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', entry.debt_id);
  });
}

export async function deleteDebtPayment(entryId: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const entry = await transaction.getFirstAsync<{
      debt_id: number;
      expense_id: number | null;
      payment_method_id: number | null;
      expense_date: string | null;
    }>(
      `SELECT entry.debt_id, entry.expense_id, expense.payment_method_id,
        expense.date AS expense_date
       FROM manual_debt_entries entry
       LEFT JOIN expenses expense ON expense.id = entry.expense_id
       WHERE entry.id = ? AND entry.kind = 'payment'`,
      entryId
    );
    if (!entry) return;
    if (entry.expense_date != null) {
      await assertCreditCardCycleIsEditable(
        transaction,
        entry.payment_method_id,
        entry.expense_date
      );
    }
    await transaction.runAsync('DELETE FROM manual_debt_entries WHERE id = ?', entryId);
    if (entry.expense_id != null) await transaction.runAsync('DELETE FROM expenses WHERE id = ?', entry.expense_id);
    await transaction.runAsync('UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', entry.debt_id);
  });
}

export async function addDebtBalanceAdjustment(debtId: number, data: NewDebtBalance): Promise<void> {
  if (!Number.isInteger(data.balance) || data.balance < 0) throw new Error(t('database.debtBalanceInvalid'));
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const debt = await transaction.getFirstAsync<{ type: string }>('SELECT type FROM manual_debts WHERE id = ?', debtId);
    if (!debt) throw new Error(t('database.debtMissing'));
    if (debt.type !== 'variable') throw new Error(t('database.debtAdjustmentFixed'));
    const current = await getDebtBalance(transaction, debtId);
    const difference = data.balance - current;
    if (difference === 0) throw new Error(t('database.debtBalanceUnchanged'));
    await transaction.runAsync(
      `INSERT INTO manual_debt_entries (debt_id, kind, amount, date, note)
       VALUES (?, 'adjustment', ?, ?, ?)`,
      debtId, difference, data.date, data.note?.trim() || null
    );
    await transaction.runAsync('UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', debtId);
  });
}

export async function setDebtArchived(id: number, archived: boolean): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    "UPDATE manual_debts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    archived ? 'archived' : 'active', id
  );
  if (result.changes === 0) throw new Error(t('database.debtMissing'));
}

export async function deleteDebt(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const entries = await transaction.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM manual_debt_entries WHERE debt_id = ?', id
    );
    if (Number(entries?.count ?? 0) > 0) throw new Error(t('database.debtHasHistory'));
    const result = await transaction.runAsync('DELETE FROM manual_debts WHERE id = ?', id);
    if (result.changes === 0) throw new Error(t('database.debtMissing'));
  });
}

async function postInstallment(
  transaction: SQLite.SQLiteDatabase,
  plan: { id: number; name: string; category_id: number | null; payment_method_id: number; total_installments: number },
  installment: { id: number; installment_number: number; due_date: string; projected_amount: number },
  period: { id: number; start_date: string; end_date: string }
) {
  const date = installment.due_date < period.start_date
    ? period.start_date
    : installment.due_date > period.end_date ? period.end_date : installment.due_date;
  const locked = await transaction.getFirstAsync(
    `SELECT id FROM credit_card_cycles WHERE payment_method_id = ? AND status = 'reconciled'
     AND start_date <= ? AND end_date >= ?`, plan.payment_method_id, date, date
  );
  if (locked) return false;
  const result = await transaction.runAsync(
    `INSERT INTO expenses
      (name, amount, category_id, period_id, date, original_amount, split_percentage,
       payment_method_id, recurring_expense_id, debt_plan_id, debt_installment_id)
     VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)`,
    t('database.installment', { name: plan.name, number: installment.installment_number, total: plan.total_installments }),
    installment.projected_amount, plan.category_id, period.id, date,
    plan.payment_method_id, plan.id, installment.id
  );
  await transaction.runAsync(
    `UPDATE debt_installments SET status = 'posted', expense_id = ?, due_date = ? WHERE id = ?`,
    result.lastInsertRowId, date, installment.id
  );
  return true;
}

export async function activateInstallmentPlan(id: number, periodId: number, actualAmount: number): Promise<void> {
  if (!Number.isInteger(actualAmount) || actualAmount <= 0) throw new Error(t('database.actualInstallmentRequired'));
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const plan = await transaction.getFirstAsync<{
      id: number; name: string; total_amount: number; category_id: number | null; payment_method_id: number;
      total_installments: number; status: string;
    }>('SELECT * FROM debt_plans WHERE id = ?', id);
    if (!plan) throw new Error(t('database.planMissing'));
    if (plan.status !== 'projected') throw new Error(t('database.planAlreadyActive'));
    if (plan.total_installments === 1 && actualAmount !== plan.total_amount) {
      throw new Error(t('database.singleInstallmentMismatch'));
    }
    const lastAmount = plan.total_amount - actualAmount * (plan.total_installments - 1);
    if (lastAmount <= 0) throw new Error(t('database.installmentAmountTooHigh'));
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE id = ?', periodId
    );
    if (!period) throw new Error(t('database.periodMissing'));
    const originalFirst = await transaction.getFirstAsync<{ due_date: string }>(
      'SELECT due_date FROM debt_installments WHERE debt_plan_id = ? AND installment_number = 1', id
    );
    if (!originalFirst) throw new Error(t('database.firstInstallmentMissing'));
    const anchorDate = originalFirst.due_date >= period.start_date && originalFirst.due_date <= period.end_date
      ? originalFirst.due_date
      : period.end_date;
    const preferredDay = Number(anchorDate.slice(8, 10));
    for (let index = 0; index < plan.total_installments; index += 1) {
      await transaction.runAsync(
        'UPDATE debt_installments SET due_date = ? WHERE debt_plan_id = ? AND installment_number = ?',
        addIsoMonths(anchorDate, index, preferredDay), id, index + 1
      );
    }
    await transaction.runAsync(
      `UPDATE debt_installments SET projected_amount = CASE
        WHEN installment_number = ? THEN ? ELSE ? END WHERE debt_plan_id = ?`,
      plan.total_installments, lastAmount, actualAmount, id
    );
    const first = await transaction.getFirstAsync<{ id: number; installment_number: number; due_date: string; projected_amount: number }>(
      'SELECT id, installment_number, due_date, projected_amount FROM debt_installments WHERE debt_plan_id = ? AND installment_number = 1', id
    );
    if (!first) throw new Error(t('database.firstInstallmentMissing'));
    const posted = await postInstallment(transaction, plan, { ...first, projected_amount: actualAmount }, period);
    if (!posted) throw new Error(t('database.consolidatedActivation'));
    await transaction.runAsync(
      `UPDATE debt_plans SET status = 'active', installment_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      actualAmount, id
    );
  });
  await processProjectedInstallments();
}

export async function processProjectedInstallments(): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const installments = await transaction.getAllAsync<{
      id: number; debt_plan_id: number; installment_number: number; due_date: string; projected_amount: number;
      name: string; category_id: number | null; payment_method_id: number; total_installments: number;
      period_id: number; start_date: string; end_date: string;
    }>(
      `SELECT i.*, p.name, p.category_id, p.payment_method_id, p.total_installments,
        period.id AS period_id, period.start_date, period.end_date
       FROM debt_installments i
       INNER JOIN debt_plans p ON p.id = i.debt_plan_id AND p.status = 'active'
       INNER JOIN periods period ON i.due_date BETWEEN period.start_date AND period.end_date
       WHERE i.status = 'projected' AND i.manually_removed = 0
       ORDER BY i.due_date, i.installment_number`
    );
    for (const item of installments) {
      await postInstallment(
        transaction,
        { id: item.debt_plan_id, name: item.name, category_id: item.category_id, payment_method_id: item.payment_method_id, total_installments: item.total_installments },
        item,
        { id: item.period_id, start_date: item.start_date, end_date: item.end_date }
      );
    }
    await transaction.runAsync(
      `UPDATE debt_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND NOT EXISTS (
         SELECT 1 FROM debt_installments i WHERE i.debt_plan_id = debt_plans.id AND i.status = 'projected'
       )`
    );
  });
}

export async function restoreRemovedInstallment(installmentId: number, periodId: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const installment = await transaction.getFirstAsync<{
      id: number; debt_plan_id: number; installment_number: number; due_date: string; projected_amount: number;
      name: string; category_id: number | null; payment_method_id: number; total_installments: number;
    }>(
      `SELECT i.*, p.name, p.category_id, p.payment_method_id, p.total_installments
       FROM debt_installments i INNER JOIN debt_plans p ON p.id = i.debt_plan_id
       WHERE i.id = ? AND i.status = 'projected' AND i.manually_removed = 1`,
      installmentId
    );
    if (!installment) throw new Error(t('database.installmentUnavailable'));
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE id = ?',
      periodId
    );
    if (!period) throw new Error(t('database.periodMissing'));
    const posted = await postInstallment(
      transaction,
      { id: installment.debt_plan_id, name: installment.name, category_id: installment.category_id, payment_method_id: installment.payment_method_id, total_installments: installment.total_installments },
      installment,
      period
    );
    if (!posted) throw new Error(t('database.consolidatedRestore'));
    await transaction.runAsync('UPDATE debt_installments SET manually_removed = 0 WHERE id = ?', installmentId);
    await transaction.runAsync(
      `UPDATE debt_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND NOT EXISTS (
         SELECT 1 FROM debt_installments WHERE debt_plan_id = ? AND status = 'projected'
       )`,
      installment.debt_plan_id, installment.debt_plan_id
    );
  });
}

export async function deleteInstallmentPlan(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const plan = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM debt_plans WHERE id = ?', id
    );
    if (!plan) throw new Error(t('database.planMissing'));
    const expenses = await transaction.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM expenses WHERE debt_plan_id = ?', id
    );
    if (Number(expenses?.count ?? 0) > 0) {
      throw new Error(t('database.planHasExpenses'));
    }
    await transaction.runAsync('DELETE FROM debt_plans WHERE id = ?', id);
  });
}

export async function settleInstallmentPlan(id: number, periodId: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const plan = await transaction.getFirstAsync<{ id: number; name: string; category_id: number | null; payment_method_id: number }>(
      "SELECT id, name, category_id, payment_method_id FROM debt_plans WHERE id = ? AND status = 'active'", id
    );
    if (!plan) throw new Error(t('database.noActiveInstallments'));
    const remaining = await transaction.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(projected_amount), 0) AS total FROM debt_installments WHERE debt_plan_id = ? AND status = 'projected'", id
    );
    if (!remaining || remaining.total <= 0) throw new Error(t('database.noRemainingBalance'));
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE id = ?', periodId
    );
    if (!period) throw new Error(t('database.periodMissing'));
    await assertCreditCardCycleIsEditable(transaction, plan.payment_method_id, period.end_date);
    await transaction.runAsync(
      `INSERT INTO expenses
        (name, amount, category_id, period_id, date, original_amount, split_percentage,
         payment_method_id, recurring_expense_id, debt_plan_id, debt_installment_id)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, NULL)`,
      t('database.settlement', { name: plan.name }), remaining.total, plan.category_id,
      period.id, period.end_date, plan.payment_method_id, id
    );
    await transaction.runAsync("UPDATE debt_installments SET status = 'cancelled', manually_removed = 0 WHERE debt_plan_id = ? AND status = 'projected'", id);
    await transaction.runAsync("UPDATE debt_plans SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?", id);
  });
}

export async function getExpenses(periodId?: number): Promise<ExpenseWithCategory[]> {
  const targetPeriodId = periodId ?? await getCurrentPeriodId();
  const db = await getDb();

  const rows =
    await db.getAllAsync(
      `
      SELECT
        e.id,
        e.name,
        e.amount,
        e.category_id AS categoryId,
        e.period_id AS periodId,
        e.date,
        e.original_amount AS originalAmount,
        e.split_percentage AS splitPercentage,
        e.payment_method_id AS paymentMethodId,
        e.credit_payment_target_id AS creditPaymentTargetId,
        e.recurring_expense_id AS recurringExpenseId,
        e.debt_plan_id AS debtPlanId,
        debtEntry.debt_id AS debtId,
        debtEntry.id AS debtEntryId,
        (SELECT entry.debt_id FROM manual_debt_entries entry WHERE entry.expense_id = e.id) AS debtId,
        (SELECT entry.id FROM manual_debt_entries entry WHERE entry.expense_id = e.id) AS debtEntryId,
        installment.installment_number AS installmentNumber,
        plan.total_installments AS totalInstallments,
        savingsGoal.id AS savingsGoalId,
        savingsMovement.kind AS savingsKind,

        c.name AS categoryName,
        c.color AS categoryColor,
        pm.name AS paymentMethodName,
        pm.type AS paymentMethodType,
        pm.color AS paymentMethodColor,
        savingsGoal.name AS savingsGoalName,
        savingsGoal.color AS savingsGoalColor

      FROM expenses e

      LEFT JOIN categories c
        ON c.id = e.category_id

      LEFT JOIN payment_methods pm
        ON pm.id = e.payment_method_id
      LEFT JOIN debt_installments installment ON installment.id = e.debt_installment_id
      LEFT JOIN debt_plans plan ON plan.id = e.debt_plan_id
      LEFT JOIN manual_debt_entries debtEntry ON debtEntry.expense_id = e.id
      LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.expense_id = e.id
      LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id

      WHERE e.period_id = ?

      ORDER BY
        e.date DESC,
        e.id DESC
      `,
      targetPeriodId
    );

  return (rows as ExpenseWithCategory[]).map((expense) => (
    expense.savingsKind === 'funded_expense'
      ? {
          ...expense,
          paymentMethodId: VIRTUAL_SAVINGS_PAYMENT_METHOD_ID,
          paymentMethodName: t('savings.withdrawalPaymentMethod'),
          paymentMethodType: null,
          paymentMethodColor: '#8e44ad',
        }
      : expense
  ));
}

export async function getExpenseById(id: number): Promise<ExpenseWithCategory | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<ExpenseWithCategory>(
    `SELECT
      e.id,
      e.name,
      e.amount,
      e.category_id AS categoryId,
      e.period_id AS periodId,
      e.date,
      e.original_amount AS originalAmount,
      e.split_percentage AS splitPercentage,
      e.payment_method_id AS paymentMethodId,
      e.credit_payment_target_id AS creditPaymentTargetId,
      e.recurring_expense_id AS recurringExpenseId,
      e.debt_plan_id AS debtPlanId,
      (SELECT entry.debt_id FROM manual_debt_entries entry WHERE entry.expense_id = e.id) AS debtId,
      (SELECT entry.id FROM manual_debt_entries entry WHERE entry.expense_id = e.id) AS debtEntryId,
      installment.installment_number AS installmentNumber,
      plan.total_installments AS totalInstallments,
      savingsGoal.id AS savingsGoalId,
      savingsMovement.kind AS savingsKind,
      c.name AS categoryName,
      c.color AS categoryColor,
      pm.name AS paymentMethodName,
      pm.type AS paymentMethodType,
      pm.color AS paymentMethodColor,
      savingsGoal.name AS savingsGoalName,
      savingsGoal.color AS savingsGoalColor
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     LEFT JOIN debt_installments installment ON installment.id = e.debt_installment_id
     LEFT JOIN debt_plans plan ON plan.id = e.debt_plan_id
     LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.expense_id = e.id
     LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id
     WHERE e.id = ?`,
    id
  );
  if (!row) return null;
  return row.savingsKind === 'funded_expense'
    ? {
        ...row,
        paymentMethodId: VIRTUAL_SAVINGS_PAYMENT_METHOD_ID,
        paymentMethodName: t('savings.withdrawalPaymentMethod'),
        paymentMethodType: null,
        paymentMethodColor: '#8e44ad',
      }
    : row;
}

export async function getExpenseNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `
    SELECT name
    FROM expenses
    ORDER BY date DESC, id DESC
    `
  );

  return rows.map((row) => row.name);
}

async function assertCreditCardCycleIsEditable(
  db: SQLite.SQLiteDatabase,
  paymentMethodId: number | null,
  date: string
): Promise<void> {
  if (paymentMethodId == null) return;
  const reconciledCycle = await db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM credit_card_cycles
     WHERE payment_method_id = ?
       AND status = 'reconciled'
       AND start_date <= ?
       AND end_date >= ?
     LIMIT 1`,
    paymentMethodId,
    date,
    date
  );
  if (reconciledCycle) {
    throw new Error(t('database.reconciledExpense'));
  }
}

export async function createExpense(
  data: NewExpense,
  periodId?: number
): Promise<number> {
  validateExpense(data);
  const targetPeriodId = periodId ?? await getCurrentPeriodId();

  const db = await getDb();
  const selection = resolveExpenseSavingsSelection(data, null, false);
  const effectivePaymentMethodId = selection?.kind === 'funded_expense'
    ? null
    : data.paymentMethodId;
  await assertSavingsSelectionMatchesCategory(db, data.categoryId, selection);
  await assertSavingsPaymentMethodAllowed(db, data.categoryId, selection, effectivePaymentMethodId);
  await assertCreditPaymentSelection(
    db,
    data.categoryId,
    effectivePaymentMethodId,
    data.creditPaymentTargetId ?? null
  );
  await assertDateBelongsToPeriod(db, targetPeriodId, data.date);
  await assertCreditCardCycleIsEditable(db, effectivePaymentMethodId, data.date);

  let createdId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      `INSERT INTO expenses (
        name, amount, category_id, period_id, date, original_amount,
        split_percentage, payment_method_id, credit_payment_target_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.name.trim(),
      data.amount,
      data.categoryId,
      targetPeriodId,
      data.date,
      data.originalAmount,
      data.splitPercentage,
      effectivePaymentMethodId,
      data.creditPaymentTargetId ?? null
    );
    createdId = result.lastInsertRowId;
    await setExpenseSavingsMovement(transaction, createdId, data.amount, selection);
  });
  return createdId;
}

export async function updateExpense(
  id: number,
  data: NewExpense
): Promise<void> {
  validateExpense(data);
  const db = await getDb();
  const expense = await db.getFirstAsync<{
    period_id: number;
    date: string;
    payment_method_id: number | null;
    recurring_expense_id: number | null;
    credit_payment_target_id: number | null;
  }>(
    `SELECT period_id, date, payment_method_id, recurring_expense_id,
       credit_payment_target_id FROM expenses WHERE id = ?`,
    id
  );
  if (!expense) throw new Error(t('database.expenseMissing'));
  const debtEntry = await db.getFirstAsync<{ id: number; debt_id: number; amount: number }>(
    "SELECT id, debt_id, amount FROM manual_debt_entries WHERE expense_id = ? AND kind = 'payment'",
    id
  );
  const existingMovement = await getExpenseSavingsMovement(db, id);
  const selection = resolveExpenseSavingsSelection(data, existingMovement, true);
  const effectivePaymentMethodId = selection?.kind === 'funded_expense'
    ? null
    : data.paymentMethodId;
  await assertDateBelongsToPeriod(db, expense.period_id, data.date);
  await assertCreditCardCycleIsEditable(db, expense.payment_method_id, expense.date);
  await assertCreditCardCycleIsEditable(db, effectivePaymentMethodId, data.date);
  const creditPaymentTargetId = data.creditPaymentTargetId === undefined
    ? expense.credit_payment_target_id
    : data.creditPaymentTargetId;
  await assertCreditPaymentSelection(
    db,
    data.categoryId,
    effectivePaymentMethodId,
    creditPaymentTargetId
  );
  if (debtEntry) {
    await assertDebtPaymentMethodExists(db, effectivePaymentMethodId);
    const available = await getDebtBalance(db, debtEntry.debt_id) + debtEntry.amount;
    if (data.amount > available) throw new Error(t('database.debtPaymentTooHigh'));
  }

  await withExclusiveTransaction(db, async (transaction) => {
    await assertSavingsSelectionMatchesCategory(transaction, data.categoryId, selection);
    await assertSavingsPaymentMethodAllowed(
      transaction,
      data.categoryId,
      selection,
      effectivePaymentMethodId
    );
    await transaction.runAsync(
      `UPDATE expenses SET
        name = ?, amount = ?, category_id = ?, date = ?,
        original_amount = ?, split_percentage = ?, payment_method_id = ?,
        credit_payment_target_id = ?
       WHERE id = ?`,
      data.name.trim(),
      data.amount,
      data.categoryId,
      data.date,
      data.originalAmount,
      data.splitPercentage,
      effectivePaymentMethodId,
      creditPaymentTargetId,
      id
    );

    await setExpenseSavingsMovement(transaction, id, data.amount, selection);

    if (debtEntry) {
      await transaction.runAsync(
        'UPDATE manual_debt_entries SET amount = ?, date = ? WHERE id = ?',
        data.amount, data.date, debtEntry.id
      );
      await transaction.runAsync(
        'UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        debtEntry.debt_id
      );
    }

    if (expense.recurring_expense_id == null) return;
    const recurring = await transaction.getFirstAsync<{
      id: number;
      frequency: RecurringExpense['frequency'];
      source_expense_id: number | null;
    }>(
      `SELECT id, frequency, source_expense_id
       FROM recurring_expenses
       WHERE id = ? AND (
         source_expense_id = ? OR (
           source_expense_id IS NULL AND EXISTS (
             SELECT 1 FROM recurring_expense_occurrences
             WHERE recurring_expense_id = recurring_expenses.id
               AND expense_id = ?
               AND scheduled_date = recurring_expenses.start_date
           )
         )
       )`,
      expense.recurring_expense_id,
      id,
      id
    );
    if (!recurring) return;
    if (selection?.kind === 'funded_expense') {
      throw new Error(t('database.fundedExpenseCannotRecur'));
    }

    if (data.date !== expense.date) {
      const collision = await transaction.getFirstAsync(
        `SELECT id FROM recurring_expense_occurrences
         WHERE recurring_expense_id = ? AND scheduled_date = ? AND expense_id != ?`,
        recurring.id,
        data.date,
        id
      );
      if (collision) {
        throw new Error(t('database.duplicateRecurrenceDate'));
      }
      await transaction.runAsync(
        `UPDATE recurring_expense_occurrences
         SET scheduled_date = ?, updated_at = CURRENT_TIMESTAMP
         WHERE recurring_expense_id = ? AND expense_id = ?`,
        data.date,
        recurring.id,
        id
      );
      await transaction.runAsync(
        `DELETE FROM recurring_expense_occurrences
         WHERE recurring_expense_id = ? AND status != 'generated'`,
        recurring.id
      );
    }

    await transaction.runAsync(
      `UPDATE recurring_expenses SET
        name = ?, amount = ?, original_amount = ?, split_percentage = ?,
        category_id = ?, payment_method_id = ?, savings_goal_id = ?, savings_kind = ?,
        start_date = ?, execution_day = ?,
        end_date = CASE WHEN end_date IS NOT NULL AND end_date < ? THEN ? ELSE end_date END,
        source_expense_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.name.trim(),
      data.amount,
      data.originalAmount,
      data.splitPercentage,
      data.categoryId,
      effectivePaymentMethodId,
      selection?.kind === 'contribution' ? selection.goalId : null,
      selection?.kind === 'contribution' ? 'contribution' : null,
      data.date,
      recurringExecutionDay(data.date, recurring.frequency),
      data.date,
      data.date,
      id,
      recurring.id
    );
  });
}

export async function deleteExpense(
  id:number
): Promise<void> {
  const db = await getDb();
  const expense = await db.getFirstAsync<{
    date: string;
    payment_method_id: number | null;
    debt_plan_id: number | null;
    debt_installment_id: number | null;
  }>(
    'SELECT date, payment_method_id, debt_plan_id, debt_installment_id FROM expenses WHERE id = ?',
    id
  );
  if (!expense) return;
  const debtEntry = await db.getFirstAsync<{ debt_id: number }>(
    "SELECT debt_id FROM manual_debt_entries WHERE expense_id = ? AND kind = 'payment'",
    id
  );
  await assertCreditCardCycleIsEditable(db, expense.payment_method_id, expense.date);
  await withExclusiveTransaction(db, async (transaction) => {
    const savingsMovement = await getExpenseSavingsMovement(transaction, id);
    const recurringOccurrence = await transaction.getFirstAsync<{
      occurrence_id: number;
      recurring_expense_id: number;
      source_expense_id: number | null;
      registration_mode: RecurringExpense['registrationMode'];
    }>(
      `SELECT
        occurrence.id AS occurrence_id,
        occurrence.recurring_expense_id,
        recurring.source_expense_id,
        recurring.registration_mode
       FROM recurring_expense_occurrences occurrence
       INNER JOIN recurring_expenses recurring ON recurring.id = occurrence.recurring_expense_id
       WHERE occurrence.expense_id = ? AND occurrence.status = 'generated'
       LIMIT 1`,
      id
    );

    await transaction.runAsync('DELETE FROM savings_goal_movements WHERE expense_id = ?', id);
    await transaction.runAsync('DELETE FROM manual_debt_entries WHERE expense_id = ?', id);
    await transaction.runAsync('DELETE FROM expenses WHERE id = ?', id);
    if (debtEntry) {
      await transaction.runAsync(
        'UPDATE manual_debts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        debtEntry.debt_id
      );
    }

    if (savingsMovement?.kind === 'contribution') {
      await assertSavingsGoalBalanceIsNotNegative(transaction, savingsMovement.goal_id);
    }

    if (expense.debt_installment_id != null) {
      await transaction.runAsync(
        `UPDATE debt_installments
         SET status = 'projected', expense_id = NULL, manually_removed = 1
         WHERE id = ?`,
        expense.debt_installment_id
      );
      await transaction.runAsync(
        `UPDATE debt_plans SET status = 'active', updated_at = CURRENT_TIMESTAMP
         WHERE id = (SELECT debt_plan_id FROM debt_installments WHERE id = ?)
           AND status = 'completed'`,
        expense.debt_installment_id
      );
    } else if (expense.debt_plan_id != null) {
      await transaction.runAsync(
        `UPDATE debt_installments
         SET status = 'projected', expense_id = NULL, manually_removed = 0
         WHERE debt_plan_id = ? AND status = 'cancelled'`,
        expense.debt_plan_id
      );
      await transaction.runAsync(
        `UPDATE debt_plans
         SET status = CASE
           WHEN EXISTS (
             SELECT 1 FROM debt_installments
             WHERE debt_plan_id = ? AND status = 'posted'
           ) THEN 'active'
           ELSE 'projected'
         END,
         updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND status = 'completed'`,
        expense.debt_plan_id,
        expense.debt_plan_id
      );
    }

    if (!recurringOccurrence || recurringOccurrence.source_expense_id === id) return;
    if (recurringOccurrence.registration_mode === 'confirmation') {
      await transaction.runAsync(
        `UPDATE recurring_expense_occurrences
         SET status = 'pending', expense_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        recurringOccurrence.occurrence_id
      );
    } else {
      await transaction.runAsync(
        'DELETE FROM recurring_expense_occurrences WHERE id = ?',
        recurringOccurrence.occurrence_id
      );
    }
  });
}

function validateRecurringExpense(data: NewRecurringExpense): void {
  if (!data.name.trim()) throw new Error(t('database.recurringExpenseName'));
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error(t('validation.invalidAmount'));
  if (data.frequency === 'custom' && (!Number.isInteger(data.intervalMonths) || data.intervalMonths < 1)) {
    throw new Error(t('database.customInterval'));
  }
  if (
    (data.frequency === 'monthly' || data.frequency === 'custom') &&
    (data.executionDay == null || !Number.isInteger(data.executionDay) || data.executionDay < 1 || data.executionDay > 31)
  ) {
    throw new Error(t('database.invalidExecutionDay'));
  }
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error(t('database.endBeforeStart'));
  }
}

function mapRecurringExpense(row: Record<string, unknown>): RecurringExpense {
  return {
    id: Number(row.id),
    name: String(row.name),
    amount: Number(row.amount),
    originalAmount: row.original_amount == null ? null : Number(row.original_amount),
    splitPercentage: row.split_percentage == null ? null : Number(row.split_percentage),
    categoryId: row.category_id == null ? null : Number(row.category_id),
    paymentMethodId: row.payment_method_id == null ? null : Number(row.payment_method_id),
    frequency: row.frequency as RecurringExpense['frequency'],
    intervalMonths: Number(row.interval_months),
    executionDay: row.execution_day == null ? null : Number(row.execution_day),
    registrationMode: row.registration_mode as RecurringExpense['registrationMode'],
    startDate: String(row.start_date),
    endDate: row.end_date == null ? null : String(row.end_date),
    active: Number(row.active) === 1,
    sourceExpenseId: row.source_expense_id == null ? null : Number(row.source_expense_id),
    categoryName: row.category_name == null ? null : String(row.category_name),
    categoryColor: row.category_color == null ? null : String(row.category_color),
    paymentMethodName: row.payment_method_name == null ? null : String(row.payment_method_name),
    paymentMethodColor: row.payment_method_color == null ? null : String(row.payment_method_color),
    savingsGoalId: row.savings_goal_id == null ? null : Number(row.savings_goal_id),
    savingsKind: row.savings_kind === 'contribution' ? 'contribution' : null,
    nextDate: null,
    pendingCount: 0,
  };
}

async function getRecurringRows(db: SQLite.SQLiteDatabase): Promise<RecurringExpense[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT
       r.*,
       c.name AS category_name,
       c.color AS category_color,
       pm.name AS payment_method_name,
       pm.color AS payment_method_color
     FROM recurring_expenses r
     LEFT JOIN categories c ON c.id = r.category_id
     LEFT JOIN payment_methods pm ON pm.id = r.payment_method_id
     ORDER BY r.active DESC, r.name COLLATE NOCASE ASC`
  );
  return rows.map(mapRecurringExpense);
}

export async function getRecurringExpenses(): Promise<RecurringExpense[]> {
  const db = await getDb();
  const [rules, occurrences, periods] = await Promise.all([
    getRecurringRows(db),
    db.getAllAsync<{
      recurring_expense_id: number;
      scheduled_date: string;
      status: RecurringOccurrenceStatus;
    }>('SELECT recurring_expense_id, scheduled_date, status FROM recurring_expense_occurrences'),
    getPeriods(),
  ]);
  const today = toLocalIsoDate(new Date());
  const horizon = addIsoDays(today, 3660);

  return rules.map((rule) => {
    const ruleOccurrences = occurrences.filter((item) => item.recurring_expense_id === rule.id);
    const duePendingOccurrences = ruleOccurrences.filter(
      (item) => item.status === 'pending'
        && item.scheduled_date <= today
        && periods.some(
          (period) => item.scheduled_date >= period.startDate && item.scheduled_date <= period.endDate
        )
    );
    const statuses = new Map(ruleOccurrences.map((item) => [item.scheduled_date, item.status]));
    const overduePending = duePendingOccurrences
      .map((item) => item.scheduled_date)
      .sort()[0] ?? null;
    const nextDate = overduePending ?? getOccurrenceDates(rule, today, horizon, 5000)
      .find((date) => !['generated', 'skipped'].includes(statuses.get(date) ?? '')) ?? null;
    return {
      ...rule,
      nextDate,
      pendingCount: duePendingOccurrences.length,
    };
  });
}

export async function getRecurringDecisionItems(): Promise<RecurringDecisionItem[]> {
  const db = await getDb();
  const today = toLocalIsoDate(new Date());
  const rows = await db.getAllAsync<{
    kind: 'expense' | 'income';
    recurring_id: number;
    name: string;
    amount: number;
    scheduled_date: string;
    status: 'pending' | 'skipped';
  }>(
    `SELECT * FROM (
       SELECT 'expense' AS kind, o.recurring_expense_id AS recurring_id,
              r.name, r.amount, o.scheduled_date, o.status
       FROM recurring_expense_occurrences o
       INNER JOIN recurring_expenses r ON r.id = o.recurring_expense_id
       WHERE o.status IN ('pending', 'skipped') AND o.dismissed = 0
         AND o.scheduled_date <= ?
         AND EXISTS (
           SELECT 1 FROM periods p
           WHERE o.scheduled_date BETWEEN p.start_date AND p.end_date
         )
       UNION ALL
       SELECT 'income' AS kind, o.recurring_income_id AS recurring_id,
              r.name, r.amount, o.scheduled_date, o.status
       FROM recurring_income_occurrences o
       INNER JOIN recurring_incomes r ON r.id = o.recurring_income_id
       WHERE o.status IN ('pending', 'skipped') AND o.dismissed = 0
         AND o.scheduled_date <= ?
         AND EXISTS (
           SELECT 1 FROM periods p
           WHERE o.scheduled_date BETWEEN p.start_date AND p.end_date
         )
     )
     ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, scheduled_date DESC
     LIMIT 200`,
    today,
    today
  );
  return rows.map((row) => ({
    kind: row.kind,
    recurringId: row.recurring_id,
    name: row.name,
    amount: row.amount,
    scheduledDate: row.scheduled_date,
    status: row.status,
  }));
}

function recurringInsertValues(data: NewRecurringExpense) {
  return [
    data.name.trim(),
    data.amount,
    data.originalAmount,
    data.splitPercentage,
    data.categoryId,
    data.paymentMethodId,
    data.frequency,
    data.frequency === 'custom' ? data.intervalMonths : 1,
    'calendar',
    data.executionDay,
    data.registrationMode,
    data.startDate,
    data.endDate,
    data.active ? 1 : 0,
    data.sourceExpenseId ?? null,
    data.savingsGoalId ?? null,
    data.savingsKind === 'contribution' ? 'contribution' : null,
  ] as const;
}

const RECURRING_INSERT_SQL = `INSERT INTO recurring_expenses (
  name, amount, original_amount, split_percentage, category_id, payment_method_id,
  frequency, interval_months, execution_basis, execution_day, registration_mode,
  start_date, end_date, active, source_expense_id, savings_goal_id, savings_kind
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

type RecurringDateRule = Pick<
  RecurringExpense,
  'frequency' | 'intervalMonths' | 'executionDay' | 'startDate' | 'endDate'
>;

async function markPastSavingsOccurrencesSkipped(
  db: SQLite.SQLiteDatabase,
  recurringExpenseId: number,
  rule: RecurringDateRule
): Promise<void> {
  const today = toLocalIsoDate(new Date());
  for (const scheduledDate of getOccurrenceDates(rule, rule.startDate, today, 20000)) {
    await db.runAsync(
      `INSERT OR IGNORE INTO recurring_expense_occurrences
        (recurring_expense_id, scheduled_date, status, dismissed)
       VALUES (?, ?, 'skipped', 1)`,
      recurringExpenseId,
      scheduledDate
    );
  }
}

export async function createRecurringExpense(data: NewRecurringExpense): Promise<number> {
  validateRecurringExpense(data);
  const db = await getDb();
  await assertCreditPaymentSelection(db, data.categoryId, data.paymentMethodId, null);
  let createdId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    let sourceDate: string | null = null;
    let savingsGoalId = data.savingsGoalId ?? null;
    let savingsKind = data.savingsKind ?? null;
    if (data.sourceExpenseId != null) {
      const source = await transaction.getFirstAsync<{ date: string }>(
        'SELECT date FROM expenses WHERE id = ?',
        data.sourceExpenseId
      );
      if (!source) throw new Error(t('database.sourceExpenseMissing'));
      sourceDate = source.date;
      const sourceMovement = await getExpenseSavingsMovement(transaction, data.sourceExpenseId);
      if (sourceMovement?.kind === 'funded_expense') {
        throw new Error(t('database.fundedExpenseCannotRecur'));
      }
      if (sourceMovement?.kind === 'contribution') {
        savingsGoalId = sourceMovement.goal_id;
        savingsKind = 'contribution';
      }
    }
    const selection = savingsGoalId == null || savingsKind !== 'contribution'
      ? null
      : { goalId: savingsGoalId, kind: 'contribution' as const };
    await assertSavingsSelectionMatchesCategory(transaction, data.categoryId, selection);
    if (selection) {
      await assertSavingsGoalCanReceiveMovement(
        transaction,
        selection.goalId,
        undefined
      );
    }
    const paymentMethodId = data.paymentMethodId;
    await assertSavingsPaymentMethodAllowed(
      transaction,
      data.categoryId,
      selection,
      paymentMethodId
    );
    const effectiveData = { ...data, paymentMethodId, savingsGoalId, savingsKind };
    const result = await transaction.runAsync(RECURRING_INSERT_SQL, ...recurringInsertValues(effectiveData));
    createdId = result.lastInsertRowId;
    if (data.sourceExpenseId != null) {
      await transaction.runAsync(
        'UPDATE expenses SET recurring_expense_id = ? WHERE id = ?',
        result.lastInsertRowId,
        data.sourceExpenseId
      );
      if (sourceDate === data.startDate) {
        await transaction.runAsync(
          `INSERT INTO recurring_expense_occurrences
            (recurring_expense_id, scheduled_date, status, expense_id)
           VALUES (?, ?, 'generated', ?)`,
          result.lastInsertRowId,
          data.startDate,
          data.sourceExpenseId
        );
      }
    }
  });
  return createdId;
}

export async function createExpenseWithRecurrence(
  expense: NewExpense,
  schedule: NewRecurringSchedule,
  periodId: number
): Promise<number> {
  if (expense.creditPaymentTargetId != null) {
    throw new Error(t('database.creditPaymentCannotRecur'));
  }
  if (schedule.startDate !== expense.date) {
    throw new Error(t('database.recurrenceStartMismatch'));
  }
  const db = await getDb();
  const selection = resolveExpenseSavingsSelection(expense, null, false);
  if (selection?.kind === 'funded_expense') {
    throw new Error(t('database.fundedExpenseCannotRecur'));
  }
  await assertSavingsSelectionMatchesCategory(db, expense.categoryId, selection);
  if (selection) {
    await assertSavingsGoalCanReceiveMovement(db, selection.goalId);
  }
  const paymentMethodId = expense.paymentMethodId;
  await assertSavingsPaymentMethodAllowed(db, expense.categoryId, selection, paymentMethodId);
  const recurrence: NewRecurringExpense = {
    ...expense,
    ...schedule,
    paymentMethodId,
    sourceExpenseId: null,
    savingsGoalId: selection?.goalId ?? null,
    savingsKind: selection?.kind === 'contribution' ? 'contribution' : null,
  };
  validateRecurringExpense(recurrence);
  await assertDateBelongsToPeriod(db, periodId, expense.date);
  await assertCreditCardCycleIsEditable(db, paymentMethodId, expense.date);
  let createdExpenseId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const recurringResult = await transaction.runAsync(
      RECURRING_INSERT_SQL,
      ...recurringInsertValues(recurrence)
    );
    const expenseResult = await transaction.runAsync(
      `INSERT INTO expenses (
        name, amount, category_id, period_id, date, original_amount, split_percentage,
        payment_method_id, recurring_expense_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      expense.name.trim(),
      expense.amount,
      expense.categoryId,
      periodId,
      expense.date,
      expense.originalAmount,
      expense.splitPercentage,
      paymentMethodId,
      recurringResult.lastInsertRowId
    );
    createdExpenseId = expenseResult.lastInsertRowId;
    await setExpenseSavingsMovement(transaction, createdExpenseId, expense.amount, selection);
    await transaction.runAsync(
      `INSERT INTO recurring_expense_occurrences
        (recurring_expense_id, scheduled_date, status, expense_id)
       VALUES (?, ?, 'generated', ?)`,
      recurringResult.lastInsertRowId,
      expense.date,
      expenseResult.lastInsertRowId
    );
    await transaction.runAsync(
      'UPDATE recurring_expenses SET source_expense_id = ? WHERE id = ?',
      expenseResult.lastInsertRowId,
      recurringResult.lastInsertRowId
    );
  });
  return createdExpenseId;
}

export async function updateRecurringExpense(id: number, data: NewRecurringExpense): Promise<void> {
  validateRecurringExpense(data);
  const db = await getDb();
  await assertCreditPaymentSelection(db, data.categoryId, data.paymentMethodId, null);
  await withExclusiveTransaction(db, async (transaction) => {
    const current = await transaction.getFirstAsync<{
      id: number;
      savings_goal_id: number | null;
      savings_kind: string | null;
      active: number;
    }>('SELECT id, savings_goal_id, savings_kind, active FROM recurring_expenses WHERE id = ?', id);
    if (!current) throw new Error(t('database.recurringExpenseMissing'));
    const savingsGoalId = data.savingsGoalId === undefined
      ? current.savings_goal_id
      : data.savingsGoalId;
    const savingsKind = data.savingsKind === undefined
      ? current.savings_kind
      : data.savingsKind;
    if (savingsGoalId != null && savingsKind === 'contribution') {
      const existingLink = current.savings_goal_id == null
        ? null
        : {
            id: -1,
            goal_id: current.savings_goal_id,
            kind: 'contribution' as const,
          };
      await assertSavingsGoalCanReceiveMovement(
        transaction,
        savingsGoalId,
        existingLink
      );
      if (data.active) await assertSavingsGoalIsActive(transaction, savingsGoalId);
    }
    await transaction.runAsync(
      `UPDATE recurring_expenses SET
        frequency = ?, interval_months = ?, execution_basis = ?,
        execution_day = ?, registration_mode = ?, start_date = ?, end_date = ?, active = ?,
        savings_goal_id = ?, savings_kind = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.frequency,
      data.frequency === 'custom' ? data.intervalMonths : 1,
      'calendar',
      data.executionDay,
      data.registrationMode,
      data.startDate,
      data.endDate,
      data.active ? 1 : 0,
      savingsGoalId,
      savingsKind === 'contribution' ? 'contribution' : null,
      id
    );
    if (
      data.active
      && current.active !== 1
      && savingsGoalId != null
      && savingsKind === 'contribution'
    ) {
      await markPastSavingsOccurrencesSkipped(transaction, id, data);
    }
    await transaction.runAsync(
      `DELETE FROM recurring_expense_occurrences
       WHERE recurring_expense_id = ? AND status IN ('scheduled', 'pending')`,
      id
    );
  });
}

export async function setRecurringExpenseActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const recurring = await transaction.getFirstAsync<{
      active: number;
      savings_goal_id: number | null;
      savings_kind: string | null;
      frequency: RecurringExpense['frequency'];
      interval_months: number;
      execution_day: number | null;
      start_date: string;
      end_date: string | null;
    }>('SELECT * FROM recurring_expenses WHERE id = ?', id);
    if (!recurring) throw new Error(t('database.recurringExpenseMissing'));
    if (active && recurring.savings_goal_id != null && recurring.savings_kind === 'contribution') {
      await assertSavingsGoalIsActive(transaction, recurring.savings_goal_id);
      if (recurring.active !== 1) {
        await markPastSavingsOccurrencesSkipped(transaction, id, {
          frequency: recurring.frequency,
          intervalMonths: recurring.interval_months,
          executionDay: recurring.execution_day,
          startDate: recurring.start_date,
          endDate: recurring.end_date,
        });
      }
    }
    await transaction.runAsync(
      'UPDATE recurring_expenses SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      active ? 1 : 0,
      id
    );
  });
}

export async function deleteRecurringExpense(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    await transaction.runAsync(
      'UPDATE expenses SET recurring_expense_id = NULL WHERE recurring_expense_id = ?',
      id
    );
    await transaction.runAsync(
      'DELETE FROM recurring_expense_occurrences WHERE recurring_expense_id = ?',
      id
    );
    const result = await transaction.runAsync('DELETE FROM recurring_expenses WHERE id = ?', id);
    if (result.changes === 0) throw new Error(t('database.recurringExpenseMissing'));
  });
}

function toLocalIsoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

async function insertGeneratedRecurringExpense(
  transaction: SQLite.SQLiteDatabase,
  rule: RecurringExpense,
  scheduledDate: string,
  periodId: number
): Promise<number> {
  const result = await transaction.runAsync(
    `INSERT INTO expenses (
      name, amount, category_id, period_id, date, original_amount, split_percentage,
      payment_method_id, recurring_expense_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    rule.name,
    rule.amount,
    rule.categoryId,
    periodId,
    scheduledDate,
    rule.originalAmount,
    rule.splitPercentage,
    rule.paymentMethodId,
    rule.id
  );
  if (rule.savingsGoalId != null && rule.savingsKind === 'contribution') {
    await setExpenseSavingsMovement(transaction, result.lastInsertRowId, rule.amount, {
      goalId: rule.savingsGoalId,
      kind: 'contribution',
    });
  }
  return result.lastInsertRowId;
}

export async function processDueRecurringExpenses(
  today = toLocalIsoDate(new Date())
): Promise<GeneratedRecurringExpenseNotification[]> {
  const db = await getDb();
  const generatedExpenses: GeneratedRecurringExpenseNotification[] = [];
  const [rules, periods, occurrenceRows] = await Promise.all([
    getRecurringRows(db),
    getPeriods(),
    db.getAllAsync<{
      recurring_expense_id: number;
      scheduled_date: string;
      status: RecurringOccurrenceStatus;
    }>('SELECT recurring_expense_id, scheduled_date, status FROM recurring_expense_occurrences'),
  ]);

  for (const rule of rules.filter((item) => item.active)) {
    if (rule.savingsGoalId != null && rule.savingsKind === 'contribution') {
      const goal = await getSavingsGoalBalance(db, rule.savingsGoalId);
      if (!goal || goal.status === 'archived') {
        await db.runAsync(
          'UPDATE recurring_expenses SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          rule.id
        );
        continue;
      }
    }
    const dates = getOccurrenceDates(rule, rule.startDate, today, 5000);
    const existing = new Map(
      occurrenceRows
        .filter((item) => item.recurring_expense_id === rule.id)
        .map((item) => [item.scheduled_date, item.status])
    );
    for (const scheduledDate of dates) {
      const status = existing.get(scheduledDate);
      if (status === 'generated' || status === 'skipped') continue;
      const period = periods.find(
        (item) => scheduledDate >= item.startDate && scheduledDate <= item.endDate
      );
      if (!period) continue;
      if (rule.registrationMode === 'confirmation') {
        await db.runAsync(
          `INSERT INTO recurring_expense_occurrences
            (recurring_expense_id, scheduled_date, status)
           VALUES (?, ?, 'pending')
           ON CONFLICT(recurring_expense_id, scheduled_date)
           DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
           WHERE status = 'scheduled'`,
          rule.id,
          scheduledDate
        );
        continue;
      }
      let wasCreated = false;
      await withExclusiveTransaction(db, async (transaction) => {
        const current = await transaction.getFirstAsync<{ status: RecurringOccurrenceStatus }>(
          `SELECT status FROM recurring_expense_occurrences
           WHERE recurring_expense_id = ? AND scheduled_date = ?`,
          rule.id,
          scheduledDate
        );
        if (current?.status === 'generated' || current?.status === 'skipped') return;
        const expenseId = await insertGeneratedRecurringExpense(transaction, rule, scheduledDate, period.id);
        await transaction.runAsync(
          `INSERT INTO recurring_expense_occurrences
            (recurring_expense_id, scheduled_date, status, expense_id)
           VALUES (?, ?, 'generated', ?)
           ON CONFLICT(recurring_expense_id, scheduled_date)
           DO UPDATE SET status = 'generated', expense_id = excluded.expense_id,
                         updated_at = CURRENT_TIMESTAMP`,
          rule.id,
          scheduledDate,
          expenseId
        );
        wasCreated = true;
      });
      if (wasCreated) {
        generatedExpenses.push({
          recurringExpenseId: rule.id,
          name: rule.name,
          amount: rule.amount,
          scheduledDate,
        });
      }
    }
  }
  return generatedExpenses;
}

export async function approveRecurringOccurrence(
  recurringExpenseId: number,
  scheduledDate: string
): Promise<number> {
  const db = await getDb();
  const [rule, periods] = await Promise.all([
    getRecurringRows(db).then((items) => items.find((item) => item.id === recurringExpenseId)),
    getPeriods(),
  ]);
  if (!rule) throw new Error(t('database.recurringExpenseMissing'));
  const period = periods.find(
    (item) => scheduledDate >= item.startDate && scheduledDate <= item.endDate
  );
  if (!period) throw new Error(t('database.noScheduledPeriod'));
  let generatedExpenseId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const current = await transaction.getFirstAsync<{
      status: RecurringOccurrenceStatus;
      expense_id: number | null;
    }>(
      `SELECT status, expense_id FROM recurring_expense_occurrences
       WHERE recurring_expense_id = ? AND scheduled_date = ?`,
      recurringExpenseId,
      scheduledDate
    );
    if (current?.status === 'generated' && current.expense_id != null) {
      generatedExpenseId = current.expense_id;
      return;
    }
    if (current?.status === 'skipped') throw new Error(t('database.occurrenceSkipped'));
    const expenseId = await insertGeneratedRecurringExpense(transaction, rule, scheduledDate, period.id);
    generatedExpenseId = expenseId;
    await transaction.runAsync(
      `INSERT INTO recurring_expense_occurrences
        (recurring_expense_id, scheduled_date, status, expense_id)
       VALUES (?, ?, 'generated', ?)
       ON CONFLICT(recurring_expense_id, scheduled_date)
       DO UPDATE SET status = 'generated', expense_id = excluded.expense_id,
                     updated_at = CURRENT_TIMESTAMP`,
      recurringExpenseId,
      scheduledDate,
      expenseId
    );
  });
  return generatedExpenseId;
}

export async function skipRecurringOccurrence(
  recurringExpenseId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recurring_expense_occurrences
      (recurring_expense_id, scheduled_date, status)
     VALUES (?, ?, 'skipped')
     ON CONFLICT(recurring_expense_id, scheduled_date)
     DO UPDATE SET status = 'skipped', expense_id = NULL, dismissed = 0,
                   updated_at = CURRENT_TIMESTAMP
     WHERE status != 'generated'`,
    recurringExpenseId,
    scheduledDate
  );
}

export async function dismissSkippedOccurrence(
  recurringExpenseId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE recurring_expense_occurrences
     SET dismissed = 1, updated_at = CURRENT_TIMESTAMP
     WHERE recurring_expense_id = ? AND scheduled_date = ? AND status = 'skipped'`,
    recurringExpenseId,
    scheduledDate
  );
  if (result.changes === 0) {
    throw new Error(t('database.skippedNotificationMissing'));
  }
}

export async function markRecurringOccurrencePending(
  recurringExpenseId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recurring_expense_occurrences
      (recurring_expense_id, scheduled_date, status)
     VALUES (?, ?, 'pending')
     ON CONFLICT(recurring_expense_id, scheduled_date)
     DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'scheduled'`,
    recurringExpenseId,
    scheduledDate
  );
}

export async function restoreRecurringOccurrence(
  recurringExpenseId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE recurring_expense_occurrences
     SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE recurring_expense_id = ? AND scheduled_date = ? AND status = 'skipped'`,
    recurringExpenseId,
    scheduledDate
  );
  if (result.changes === 0) {
    throw new Error(t('database.skippedOccurrenceMissing'));
  }
}

export async function getUpcomingRecurringConfirmations(
  throughDate: string,
  today = toLocalIsoDate(new Date())
): Promise<RecurringConfirmationSchedule[]> {
  const db = await getDb();
  const [rules, occurrences] = await Promise.all([
    getRecurringRows(db),
    db.getAllAsync<{
      recurring_expense_id: number;
      scheduled_date: string;
      status: RecurringOccurrenceStatus;
    }>('SELECT recurring_expense_id, scheduled_date, status FROM recurring_expense_occurrences'),
  ]);
  const result: RecurringConfirmationSchedule[] = [];
  for (const rule of rules.filter((item) => item.active && item.registrationMode === 'confirmation')) {
    const statuses = new Map(
      occurrences
        .filter((item) => item.recurring_expense_id === rule.id)
        .map((item) => [item.scheduled_date, item.status])
    );
    for (const scheduledDate of getOccurrenceDates(rule, today, throughDate, 5000)) {
      const status = statuses.get(scheduledDate);
      if (status === 'generated' || status === 'skipped') continue;
      result.push({
        kind: 'expense',
        recurringId: rule.id,
        name: rule.name,
        amount: rule.amount,
        scheduledDate,
      });
    }
  }
  const [incomeRules, incomeOccurrences] = await Promise.all([
    getRecurringIncomes(),
    db.getAllAsync<{
      recurring_income_id: number;
      scheduled_date: string;
      status: RecurringOccurrenceStatus;
    }>('SELECT recurring_income_id, scheduled_date, status FROM recurring_income_occurrences'),
  ]);
  for (const rule of incomeRules.filter(
    (item) => item.active && item.registrationMode === 'confirmation'
  )) {
    const statuses = new Map(
      incomeOccurrences
        .filter((item) => item.recurring_income_id === rule.id)
        .map((item) => [item.scheduled_date, item.status])
    );
    for (const scheduledDate of getOccurrenceDates(rule, today, throughDate, 5000)) {
      const status = statuses.get(scheduledDate);
      if (status === 'generated' || status === 'skipped') continue;
      result.push({
        kind: 'income',
        recurringId: rule.id,
        name: rule.name,
        amount: rule.amount,
        scheduledDate,
      });
    }
  }
  return result;
}

export async function getIncomes(periodId?: number): Promise<Income[]> {
  const targetPeriodId = periodId ?? await getCurrentPeriodId();
  const db = await getDb();

  const rows = await db.getAllAsync(
    `
    SELECT
      income.id,
      income.name,
      income.amount,
      income.period_id AS periodId,
      income.date,
      income.recurring_income_id AS recurringIncomeId,
      paymentMethod.id AS paymentMethodId,
      paymentMethod.name AS paymentMethodName,
      paymentMethod.type AS paymentMethodType,
      paymentMethod.color AS paymentMethodColor,
      savingsGoal.id AS savingsGoalId,
      savingsGoal.name AS savingsGoalName,
      savingsGoal.color AS savingsGoalColor
    FROM incomes income
    LEFT JOIN payment_methods paymentMethod ON paymentMethod.id = income.payment_method_id
    LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.income_id = income.id
    LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id
    WHERE income.period_id = ?
    ORDER BY income.date DESC, income.id DESC
    `,
    targetPeriodId
  );

  return rows as Income[];
}

export async function getIncomeById(id: number): Promise<Income | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Income>(
    `SELECT
       income.id,
       income.name,
       income.amount,
       income.period_id AS periodId,
       income.date,
       income.recurring_income_id AS recurringIncomeId,
       paymentMethod.id AS paymentMethodId,
       paymentMethod.name AS paymentMethodName,
       paymentMethod.type AS paymentMethodType,
       paymentMethod.color AS paymentMethodColor,
       savingsGoal.id AS savingsGoalId,
       savingsGoal.name AS savingsGoalName,
       savingsGoal.color AS savingsGoalColor
     FROM incomes income
     LEFT JOIN payment_methods paymentMethod ON paymentMethod.id = income.payment_method_id
     LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.income_id = income.id
     LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id
     WHERE income.id = ?`,
    id
  );
  return row ?? null;
}

export async function getIncomeNames(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ name: string }>(
    `
    SELECT name
    FROM incomes
    ORDER BY date DESC, id DESC
    `
  );

  return rows.map((row) => row.name);
}

async function assertIncomePaymentMethod(
  database: SQLite.SQLiteDatabase,
  paymentMethodId: number | null,
  requireActive: boolean
): Promise<void> {
  if (paymentMethodId == null) throw new Error(t('database.incomePaymentMethodRequired'));
  const method = await database.getFirstAsync<{ type: PaymentMethod['type']; active: number }>(
    'SELECT type, active FROM payment_methods WHERE id = ?',
    paymentMethodId
  );
  if (!method) throw new Error(t('database.paymentMethodMissing'));
  if (method.type === 'credit') throw new Error(t('database.incomeCreditDestinationInvalid'));
  if (requireActive && Number(method.active) !== 1) throw new Error(t('database.activePaymentOnly'));
}


export async function createIncome(
  data: NewIncome,
  periodId?: number
): Promise<void> {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(t('database.incomeAmountPositive'));
  }
  const targetPeriodId = periodId ?? await getCurrentPeriodId();

  const db = await getDb();
  await assertDateBelongsToPeriod(db, targetPeriodId, data.date);
  await assertIncomePaymentMethod(db, data.paymentMethodId, true);

  await withExclusiveTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      `INSERT INTO incomes (name, amount, period_id, date, payment_method_id)
       VALUES (?, ?, ?, ?, ?)`,
      data.name.trim(),
      data.amount,
      targetPeriodId,
      data.date,
      data.paymentMethodId
    );
    await setIncomeSavingsMovement(
      transaction,
      result.lastInsertRowId,
      data.amount,
      data.savingsGoalId ?? null
    );
  });
}

export async function createIncomeWithRecurrence(
  data: NewIncome,
  schedule: Omit<NewRecurringIncome, 'name' | 'amount' | 'sourceIncomeId' | 'paymentMethodId'>,
  periodId: number
): Promise<void> {
  if (data.savingsGoalId != null) {
    throw new Error(t('database.withdrawalCannotRecur'));
  }
  const db = await getDb();
  await assertDateBelongsToPeriod(db, periodId, data.date);
  await assertIncomePaymentMethod(db, data.paymentMethodId, true);
  await withExclusiveTransaction(db, async (transaction) => {
    const incomeResult = await transaction.runAsync(
      'INSERT INTO incomes (name, amount, period_id, date, payment_method_id) VALUES (?, ?, ?, ?, ?)',
      data.name.trim(), data.amount, periodId, data.date, data.paymentMethodId
    );
    const rule = { ...schedule, name: data.name.trim(), amount: data.amount };
    const nextDate = getNextOccurrenceDate(rule, data.date);
    const recurringResult = await transaction.runAsync(
      `INSERT INTO recurring_incomes
        (name, amount, frequency, interval_months, execution_day, registration_mode, start_date,
         end_date, next_date, active, source_income_id, payment_method_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      rule.name, rule.amount, rule.frequency, rule.frequency === 'custom' ? rule.intervalMonths : 1,
      rule.executionDay, rule.registrationMode, data.date, rule.endDate, nextDate,
      incomeResult.lastInsertRowId, data.paymentMethodId
    );
    await transaction.runAsync(
      'UPDATE incomes SET recurring_income_id = ? WHERE id = ?',
      recurringResult.lastInsertRowId, incomeResult.lastInsertRowId
    );
    await transaction.runAsync(
      `INSERT INTO recurring_income_occurrences
        (recurring_income_id, scheduled_date, status, income_id)
       VALUES (?, ?, 'generated', ?)`,
      recurringResult.lastInsertRowId, data.date, incomeResult.lastInsertRowId
    );
  });
}

export async function createRecurringIncomeFromSource(
  sourceIncomeId: number,
  schedule: Omit<NewRecurringIncome, 'name' | 'amount' | 'sourceIncomeId' | 'paymentMethodId'>
): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const source = await transaction.getFirstAsync<{
      id: number;
      name: string;
      amount: number;
      date: string;
      recurring_income_id: number | null;
      payment_method_id: number | null;
    }>(
      'SELECT id, name, amount, date, recurring_income_id, payment_method_id FROM incomes WHERE id = ?', sourceIncomeId
    );
    if (!source) throw new Error(t('database.sourceIncomeMissing'));
    if (source.recurring_income_id != null) throw new Error(t('database.incomeAlreadyRecurring'));
    if (await getIncomeSavingsMovement(transaction, sourceIncomeId)) {
      throw new Error(t('database.withdrawalCannotRecur'));
    }
    const rule = { ...schedule, name: source.name, amount: source.amount, startDate: source.date };
    const nextDate = getNextOccurrenceDate(rule, source.date);
    const result = await transaction.runAsync(
      `INSERT INTO recurring_incomes
        (name, amount, frequency, interval_months, execution_day, registration_mode, start_date,
         end_date, next_date, active, source_income_id, payment_method_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      source.name, source.amount, rule.frequency, rule.frequency === 'custom' ? rule.intervalMonths : 1,
      rule.executionDay, rule.registrationMode, source.date, rule.endDate, nextDate, source.id,
      source.payment_method_id
    );
    await transaction.runAsync('UPDATE incomes SET recurring_income_id = ? WHERE id = ?', result.lastInsertRowId, source.id);
    await transaction.runAsync(
      `INSERT INTO recurring_income_occurrences
        (recurring_income_id, scheduled_date, status, income_id)
       VALUES (?, ?, 'generated', ?)`,
      result.lastInsertRowId, source.date, source.id
    );
  });
}

export async function getRecurringIncomes(): Promise<RecurringIncome[]> {
  const db = await getDb();
  const today = toLocalIsoDate(new Date());
  const rows = await db.getAllAsync<Record<string, unknown>>(`
    SELECT r.*,
      (SELECT COUNT(*) FROM recurring_income_occurrences o
       WHERE o.recurring_income_id = r.id AND o.status = 'pending'
         AND o.scheduled_date <= ?
         AND EXISTS (
           SELECT 1 FROM periods p
           WHERE o.scheduled_date BETWEEN p.start_date AND p.end_date
         )) AS pending_count,
      (SELECT MIN(o.scheduled_date) FROM recurring_income_occurrences o
       WHERE o.recurring_income_id = r.id AND o.status = 'pending'
         AND o.scheduled_date <= ?
         AND EXISTS (
           SELECT 1 FROM periods p
           WHERE o.scheduled_date BETWEEN p.start_date AND p.end_date
         )) AS pending_date
    FROM recurring_incomes r
    ORDER BY r.active DESC, r.next_date, r.id DESC
  `, today, today);
  return rows.map((row) => ({
    id: Number(row.id), name: String(row.name), amount: Number(row.amount),
    frequency: row.frequency as RecurringIncome['frequency'], intervalMonths: Number(row.interval_months),
    executionDay: row.execution_day == null ? null : Number(row.execution_day),
    registrationMode: row.registration_mode as RecurringIncome['registrationMode'],
    startDate: String(row.start_date), endDate: row.end_date == null ? null : String(row.end_date),
    nextDate: row.pending_date != null
      ? String(row.pending_date)
      : row.next_date == null ? null : String(row.next_date),
    active: Number(row.active) === 1,
    sourceIncomeId: row.source_income_id == null ? null : Number(row.source_income_id),
    paymentMethodId: row.payment_method_id == null ? null : Number(row.payment_method_id),
    pendingCount: Number(row.pending_count),
  }));
}

export async function createRecurringIncome(data: NewRecurringIncome): Promise<number> {
  if (!data.name.trim()) throw new Error(t('database.recurringIncomeName'));
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(t('database.incomeAmountPositive'));
  }
  if (data.frequency === 'custom' && (!Number.isInteger(data.intervalMonths) || data.intervalMonths < 1)) {
    throw new Error(t('database.customInterval'));
  }
  if (
    (data.frequency === 'monthly' || data.frequency === 'custom') &&
    (data.executionDay == null || !Number.isInteger(data.executionDay) || data.executionDay < 1 || data.executionDay > 31)
  ) {
    throw new Error(t('database.invalidExecutionDay'));
  }
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error(t('database.endBeforeStart'));
  }
  const db = await getDb();
  await assertIncomePaymentMethod(db, data.paymentMethodId, true);
  let createdId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const result = await transaction.runAsync(
      `INSERT INTO recurring_incomes
        (name, amount, frequency, interval_months, execution_day, registration_mode, start_date,
         end_date, next_date, active, source_income_id, payment_method_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
      data.name.trim(),
      data.amount,
      data.frequency,
      data.frequency === 'custom' ? data.intervalMonths : 1,
      data.executionDay,
      data.registrationMode,
      data.startDate,
      data.endDate,
      data.startDate,
      data.active ? 1 : 0,
      data.paymentMethodId
    );
    createdId = result.lastInsertRowId;
  });
  return createdId;
}

export async function updateRecurringIncome(id: number, data: NewRecurringIncome): Promise<void> {
  const db = await getDb();
  await assertIncomePaymentMethod(db, data.paymentMethodId, false);
  const last = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM incomes WHERE recurring_income_id = ? ORDER BY date DESC, id DESC LIMIT 1', id
  );
  const nextDate = getNextOccurrenceDate(data, last?.date ?? data.startDate);
  const result = await db.runAsync(
    `UPDATE recurring_incomes SET name = ?, amount = ?, frequency = ?, interval_months = ?,
      execution_day = ?, registration_mode = ?, start_date = ?, end_date = ?, next_date = ?, active = ?,
      payment_method_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    data.name.trim(), data.amount, data.frequency, data.frequency === 'custom' ? data.intervalMonths : 1,
    data.executionDay, data.registrationMode, data.startDate, data.endDate, nextDate, data.active ? 1 : 0,
    data.paymentMethodId, id
  );
  if (result.changes === 0) throw new Error(t('database.recurringIncomeMissing'));
  await db.runAsync(
    `DELETE FROM recurring_income_occurrences
     WHERE recurring_income_id = ? AND status IN ('scheduled', 'pending')`,
    id
  );
}

export async function setRecurringIncomeActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync('UPDATE recurring_incomes SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', active ? 1 : 0, id);
  if (result.changes === 0) throw new Error(t('database.recurringIncomeMissing'));
}

export async function deleteRecurringIncome(id: number): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    await transaction.runAsync('UPDATE incomes SET recurring_income_id = NULL WHERE recurring_income_id = ?', id);
    await transaction.runAsync('DELETE FROM recurring_income_occurrences WHERE recurring_income_id = ?', id);
    const result = await transaction.runAsync('DELETE FROM recurring_incomes WHERE id = ?', id);
    if (result.changes === 0) throw new Error(t('database.recurringIncomeMissing'));
  });
}

export async function processDueRecurringIncomes(
  today = toLocalIsoDate(new Date())
): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const futureGenerated = await transaction.getAllAsync<{
      occurrence_id: number;
      recurring_income_id: number;
      scheduled_date: string;
      income_id: number | null;
    }>(
      `SELECT o.id AS occurrence_id, o.recurring_income_id, o.scheduled_date, o.income_id
       FROM recurring_income_occurrences o
       INNER JOIN recurring_incomes r ON r.id = o.recurring_income_id
       WHERE o.status = 'generated' AND o.scheduled_date > ?
         AND o.scheduled_date != r.start_date
         AND (o.income_id IS NULL OR r.source_income_id IS NULL OR o.income_id != r.source_income_id)`,
      today
    );
    for (const item of futureGenerated) {
      if (item.income_id != null) {
        await transaction.runAsync('DELETE FROM incomes WHERE id = ?', item.income_id);
      }
      await transaction.runAsync('DELETE FROM recurring_income_occurrences WHERE id = ?', item.occurrence_id);
      await transaction.runAsync(
        `UPDATE recurring_incomes
         SET next_date = CASE
           WHEN next_date IS NULL OR next_date > ? THEN ? ELSE next_date END,
           active = CASE WHEN end_date IS NULL OR end_date >= ? THEN 1 ELSE active END,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        item.scheduled_date, item.scheduled_date, item.scheduled_date, item.recurring_income_id
      );
    }
    const rules = await transaction.getAllAsync<{
      id: number; name: string; amount: number; frequency: RecurringIncome['frequency']; interval_months: number;
      execution_day: number | null; registration_mode: RecurringIncome['registrationMode'];
      start_date: string; end_date: string | null; next_date: string;
      payment_method_id: number | null;
    }>("SELECT * FROM recurring_incomes WHERE active = 1 AND next_date IS NOT NULL");
    for (const rule of rules) {
      let nextDate: string | null = rule.next_date;
      for (let guard = 0; guard < 600 && nextDate && nextDate <= today; guard += 1) {
        const period = await transaction.getFirstAsync<{ id: number }>(
          'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1', nextDate, nextDate
        );
        if (!period) break;
        const existing = await transaction.getFirstAsync<{ status: RecurringOccurrenceStatus }>(
          `SELECT status FROM recurring_income_occurrences
           WHERE recurring_income_id = ? AND scheduled_date = ?`,
          rule.id, nextDate
        );
        if (existing?.status !== 'generated' && existing?.status !== 'skipped') {
          if (rule.registration_mode === 'confirmation') {
            await transaction.runAsync(
              `INSERT INTO recurring_income_occurrences
                (recurring_income_id, scheduled_date, status)
               VALUES (?, ?, 'pending')
               ON CONFLICT(recurring_income_id, scheduled_date)
               DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
               WHERE status = 'scheduled'`,
              rule.id, nextDate
            );
          } else {
            const income = await transaction.runAsync(
              'INSERT INTO incomes (name, amount, period_id, date, recurring_income_id, payment_method_id) VALUES (?, ?, ?, ?, ?, ?)',
              rule.name, rule.amount, period.id, nextDate, rule.id, rule.payment_method_id
            );
            await transaction.runAsync(
              `INSERT INTO recurring_income_occurrences
                (recurring_income_id, scheduled_date, status, income_id)
               VALUES (?, ?, 'generated', ?)
               ON CONFLICT(recurring_income_id, scheduled_date)
               DO UPDATE SET status = 'generated', income_id = excluded.income_id,
                             updated_at = CURRENT_TIMESTAMP`,
              rule.id, nextDate, income.lastInsertRowId
            );
          }
        }
        nextDate = getNextOccurrenceDate({
          frequency: rule.frequency, intervalMonths: rule.interval_months,
          executionDay: rule.execution_day, startDate: rule.start_date, endDate: rule.end_date,
        }, nextDate);
      }
      await transaction.runAsync(
        'UPDATE recurring_incomes SET next_date = ?, active = CASE WHEN ? IS NULL THEN 0 ELSE active END, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        nextDate, nextDate, rule.id
      );
    }
  });
}

export async function approveRecurringIncomeOccurrence(
  recurringIncomeId: number,
  scheduledDate: string
): Promise<number> {
  const db = await getDb();
  let generatedIncomeId = 0;
  await withExclusiveTransaction(db, async (transaction) => {
    const rule = await transaction.getFirstAsync<{ name: string; amount: number; payment_method_id: number | null }>(
      'SELECT name, amount, payment_method_id FROM recurring_incomes WHERE id = ?', recurringIncomeId
    );
    if (!rule) throw new Error(t('database.recurringIncomeMissing'));
    const period = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
      scheduledDate, scheduledDate
    );
    if (!period) throw new Error(t('database.noScheduledPeriod'));
    const current = await transaction.getFirstAsync<{
      status: RecurringOccurrenceStatus;
      income_id: number | null;
    }>(
      `SELECT status, income_id FROM recurring_income_occurrences
       WHERE recurring_income_id = ? AND scheduled_date = ?`,
      recurringIncomeId, scheduledDate
    );
    if (current?.status === 'generated' && current.income_id != null) {
      generatedIncomeId = current.income_id;
      return;
    }
    if (current?.status === 'skipped') throw new Error(t('database.occurrenceSkipped'));
    const income = await transaction.runAsync(
      'INSERT INTO incomes (name, amount, period_id, date, recurring_income_id, payment_method_id) VALUES (?, ?, ?, ?, ?, ?)',
      rule.name, rule.amount, period.id, scheduledDate, recurringIncomeId, rule.payment_method_id
    );
    generatedIncomeId = income.lastInsertRowId;
    await transaction.runAsync(
      `INSERT INTO recurring_income_occurrences
        (recurring_income_id, scheduled_date, status, income_id)
       VALUES (?, ?, 'generated', ?)
       ON CONFLICT(recurring_income_id, scheduled_date)
       DO UPDATE SET status = 'generated', income_id = excluded.income_id,
                     updated_at = CURRENT_TIMESTAMP`,
      recurringIncomeId, scheduledDate, generatedIncomeId
    );
  });
  return generatedIncomeId;
}

export async function skipRecurringIncomeOccurrence(
  recurringIncomeId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recurring_income_occurrences
      (recurring_income_id, scheduled_date, status)
     VALUES (?, ?, 'skipped')
     ON CONFLICT(recurring_income_id, scheduled_date)
     DO UPDATE SET status = 'skipped', income_id = NULL, dismissed = 0,
                   updated_at = CURRENT_TIMESTAMP
     WHERE status != 'generated'`,
    recurringIncomeId, scheduledDate
  );
}

export async function dismissSkippedIncomeOccurrence(
  recurringIncomeId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE recurring_income_occurrences
     SET dismissed = 1, updated_at = CURRENT_TIMESTAMP
     WHERE recurring_income_id = ? AND scheduled_date = ? AND status = 'skipped'`,
    recurringIncomeId, scheduledDate
  );
  if (result.changes === 0) throw new Error(t('database.skippedNotificationMissing'));
}

export async function markRecurringIncomeOccurrencePending(
  recurringIncomeId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO recurring_income_occurrences
      (recurring_income_id, scheduled_date, status)
     VALUES (?, ?, 'pending')
     ON CONFLICT(recurring_income_id, scheduled_date)
     DO UPDATE SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE status = 'scheduled'`,
    recurringIncomeId, scheduledDate
  );
}

export async function restoreRecurringIncomeOccurrence(
  recurringIncomeId: number,
  scheduledDate: string
): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    `UPDATE recurring_income_occurrences
     SET status = 'pending', updated_at = CURRENT_TIMESTAMP
     WHERE recurring_income_id = ? AND scheduled_date = ? AND status = 'skipped'`,
    recurringIncomeId, scheduledDate
  );
  if (result.changes === 0) throw new Error(t('database.skippedOccurrenceMissing'));
}

export async function updateIncome(
  id:number,
  data: NewIncome
): Promise<void> {

  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error(t('database.incomeAmountPositive'));
  }

  const db = await getDb();
  const income = await db.getFirstAsync<{ period_id: number }>(
    'SELECT period_id FROM incomes WHERE id = ?',
    id
  );
  if (!income) throw new Error(t('database.incomeMissing'));
  await assertDateBelongsToPeriod(db, income.period_id, data.date);
  await assertIncomePaymentMethod(db, data.paymentMethodId, false);

  await withExclusiveTransaction(db, async (transaction) => {
    const existingMovement = await getIncomeSavingsMovement(transaction, id);
    const goalId = data.savingsGoalId === undefined
      ? existingMovement?.goal_id ?? null
      : data.savingsGoalId;
    await transaction.runAsync(
      `UPDATE incomes SET name = ?, amount = ?, date = ?, payment_method_id = ? WHERE id = ?`,
      data.name.trim(),
      data.amount,
      data.date,
      data.paymentMethodId,
      id
    );
    await setIncomeSavingsMovement(transaction, id, data.amount, goalId);
  });
}

export async function deleteIncome(
  id:number
): Promise<void> {
  const db = await getDb();
  await withExclusiveTransaction(db, async (transaction) => {
    const occurrence = await transaction.getFirstAsync<{
      occurrence_id: number;
      recurring_income_id: number;
      scheduled_date: string;
      source_income_id: number | null;
      registration_mode: RecurringIncome['registrationMode'];
    }>(
      `SELECT o.id AS occurrence_id, o.recurring_income_id, o.scheduled_date,
              r.source_income_id, r.registration_mode
       FROM recurring_income_occurrences o
       INNER JOIN recurring_incomes r ON r.id = o.recurring_income_id
       WHERE o.income_id = ? AND o.status = 'generated'
       LIMIT 1`,
      id
    );
    await transaction.runAsync('DELETE FROM savings_goal_movements WHERE income_id = ?', id);
    await transaction.runAsync('DELETE FROM incomes WHERE id = ?', id);
    if (!occurrence || occurrence.source_income_id === id) return;
    if (occurrence.registration_mode === 'confirmation') {
      await transaction.runAsync(
        `UPDATE recurring_income_occurrences
         SET status = 'pending', income_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        occurrence.occurrence_id
      );
      return;
    }
    await transaction.runAsync(
      'DELETE FROM recurring_income_occurrences WHERE id = ?', occurrence.occurrence_id
    );
    await transaction.runAsync(
      `UPDATE recurring_incomes
       SET next_date = CASE WHEN next_date IS NULL OR next_date > ? THEN ? ELSE next_date END,
           active = CASE WHEN end_date IS NULL OR end_date >= ? THEN 1 ELSE active END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      occurrence.scheduled_date, occurrence.scheduled_date,
      occurrence.scheduled_date, occurrence.recurring_income_id
    );
  });
}

export async function getPeriodCategoryExpensesTotals(
  periodId: number
): Promise<PeriodCategoryExpensesTotals[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `
    WITH filtered_expenses AS (
      SELECT category_id, amount
      FROM expenses
      WHERE period_id = ?
    )
    SELECT
      c.id as categoryId,
      c.name as categoryName,
      c.color as categoryColor,
      c.period_limit as periodLimit,
      COALESCE(SUM(e.amount), 0) as total
    FROM categories c
    LEFT JOIN filtered_expenses e ON e.category_id = c.id
    GROUP BY c.id

    UNION ALL

    SELECT
      NULL as categoryId,
      ? as categoryName,
      '#95a5a6' as categoryColor,
      NULL as periodLimit,
      COALESCE(SUM(e.amount), 0) as total
    FROM filtered_expenses e
    WHERE e.category_id IS NULL

    ORDER BY total DESC, categoryName ASC
    `,
    periodId,
    t('common.notSpecified')
  );
  return rows as PeriodCategoryExpensesTotals[];
}

export async function getPeriodIncomesTotal(
  periodId: number
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `
    SELECT
      COALESCE(SUM(i.amount), 0) as total
    FROM incomes i
    WHERE i.period_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM savings_goal_movements movement
        WHERE movement.income_id = i.id AND movement.kind = 'withdrawal'
      )
    `,
    periodId
  );
  return row?.total ?? 0;
}

export async function getExpenseCountByCategory(categoryId: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM expenses WHERE category_id = ?',
    categoryId
  );
  return row?.count ?? 0;
}

export async function getSettings(): Promise<Settings> {
  const db = await getDb();

  const row = await db.getFirstAsync<{
    id: number;
    current_period_id: number | null;
    default_payment_method_id: number | null;
    movement_reminder_enabled: number;
    movement_reminder_frequency: 'daily' | 'weekly';
    movement_reminder_weekday: number;
    movement_reminder_hour: number;
    movement_reminder_minute: number;
    period_id: number | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `
    SELECT
      s.id,
      s.current_period_id,
      s.default_payment_method_id,
      s.movement_reminder_enabled,
      s.movement_reminder_frequency,
      s.movement_reminder_weekday,
      s.movement_reminder_hour,
      s.movement_reminder_minute,

      p.id AS period_id,
      p.start_date,
      p.end_date

    FROM settings s
    LEFT JOIN periods p
      ON p.id = s.current_period_id

    WHERE s.id = 1
    `
  );

  return {
    id: row?.id ?? 1,
    currentPeriodId: row?.current_period_id ?? null,
    defaultPaymentMethodId: row?.default_payment_method_id ?? null,
    movementReminderEnabled: (row?.movement_reminder_enabled ?? 0) === 1,
    movementReminderFrequency: row?.movement_reminder_frequency ?? 'daily',
    movementReminderWeekday: row?.movement_reminder_weekday ?? 1,
    movementReminderHour: row?.movement_reminder_hour ?? 21,
    movementReminderMinute: row?.movement_reminder_minute ?? 0,

    currentPeriod: row?.period_id
      ? {
          id: row.period_id,
          startDate: row.start_date!,
          endDate: row.end_date!,
        }
      : null,
  };
}

export async function updateMovementReminderSettings(data: import('./types').MovementReminderSettings): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE settings SET movement_reminder_enabled = ?, movement_reminder_frequency = ?,
      movement_reminder_weekday = ?, movement_reminder_hour = ?, movement_reminder_minute = ?
     WHERE id = 1`,
    data.movementReminderEnabled ? 1 : 0, data.movementReminderFrequency,
    data.movementReminderWeekday, data.movementReminderHour, data.movementReminderMinute
  );
}

async function getCurrentPeriodId(): Promise<number> {
  const settings = await getSettings();

  if (!settings.currentPeriodId) {
    throw new Error(t('database.noCurrentPeriod'));
  }

  return settings.currentPeriodId;
}

export async function setPeriodStartDate(
  id:number,
  startDate:string
) {
  const db = await getDb();

  const row =
    await db.getFirstAsync<{
      end_date:string;
    }>(
      `
      SELECT end_date
      FROM periods
      WHERE id = ?
      `,
      id
    );

  if (
    row &&
    startDate > row.end_date
  ) {
    throw new Error(
      t('database.startAfterEnd')
    );
  }

  await db.runAsync(
    `
    UPDATE periods
    SET start_date = ?
    WHERE id = ?
    `,
    startDate,
    id
  );
}

export async function setPeriodDates(
  id: number,
  startDate: string,
  endDate: string
): Promise<void> {
  if (startDate > endDate) {
    throw new Error(t('database.startAfterEnd'));
  }

  const database = await getDb();
  await withExclusiveTransaction(database, async (transaction) => {
    await transaction.runAsync(
      'UPDATE periods SET start_date = ?, end_date = ? WHERE id = ?',
      startDate,
      endDate,
      id
    );
  });
}

export async function setPeriodEndDate(
  id:number,
  endDate:string
) {
  const db = await getDb();

  const row =
    await db.getFirstAsync<{
      start_date:string;
    }>(
      `
      SELECT start_date
      FROM periods
      WHERE id = ?
      `,
      id
    );

  if (
    row &&
    endDate < row.start_date
  ) {
    throw new Error(
      t('database.endBeforeStartShort')
    );
  }

  await db.runAsync(
    `
    UPDATE periods
    SET end_date = ?
    WHERE id = ?
    `,
    endDate,
    id
  );
}

async function performCloseCurrentPeriod(): Promise<Period> {
  const db = await getDb();
  let nextPeriod: Period | null = null;

  await withExclusiveTransaction(db, async (transaction) => {
    const current = await transaction.getFirstAsync<{
      id: number;
      end_date: string;
    }>(`
      SELECT periods.id, periods.end_date
      FROM settings
      INNER JOIN periods ON periods.id = settings.current_period_id
      WHERE settings.id = 1
    `);

    if (!current) throw new Error(t('database.noCurrentPeriod'));

    const { startDate: nextStartStr, endDate: nextEndStr } =
      calculateNextPeriodDates(current.end_date);

    const result = await transaction.runAsync(
      'INSERT INTO periods (start_date, end_date) VALUES (?, ?)',
      nextStartStr,
      nextEndStr
    );
    await transaction.runAsync(
      'UPDATE settings SET current_period_id = ? WHERE id = 1',
      result.lastInsertRowId
    );

    nextPeriod = {
      id: result.lastInsertRowId,
      startDate: nextStartStr,
      endDate: nextEndStr,
    };
  });

  if (!nextPeriod) throw new Error(t('database.noCurrentPeriod'));
  return nextPeriod;
}

export function closeCurrentPeriod(): Promise<Period> {
  if (!closePeriodPromise) {
    closePeriodPromise = performCloseCurrentPeriod().finally(() => {
      closePeriodPromise = null;
    });
  }
  return closePeriodPromise;
}

export async function getPeriodHistory(): Promise<PeriodHistory[]> {
  const db = await getDb();

  // Get all periods
  const periods: {
    id: number;
    start_date: string;
    end_date: string;
  }[] = await db.getAllAsync(`
    SELECT id, start_date, end_date
    FROM periods
    ORDER BY start_date ASC
  `);

  // Get all categories
  const categories: {
    id: number;
    name: string;
    color: string;
    period_limit: number | null;
  }[] = await db.getAllAsync(`
    SELECT id, name, color, period_limit
    FROM categories
  `);

  const paymentMethods: {
    id: number;
    name: string;
    color: string;
    type: PaymentMethod['type'];
    billing_day: number | null;
    active: number;
  }[] = await db.getAllAsync(`
    SELECT id, name, color, type, billing_day, active
    FROM payment_methods
  `);

  // Get all expenses (including null category_id allowed)
  const expenses: {
    id: number;
    period_id: number;
    category_id: number | null;
    payment_method_id: number | null;
    amount: number;
  }[] = await db.getAllAsync(`
    SELECT id, period_id, category_id, payment_method_id, amount
    FROM expenses
  `);

  // Get all incomes
  const incomes: {
    id: number;
    period_id: number;
    amount: number;
    is_savings_withdrawal: number;
  }[] = await db.getAllAsync(`
    SELECT
      income.id,
      income.period_id,
      income.amount,
      CASE WHEN EXISTS (
        SELECT 1 FROM savings_goal_movements movement
        WHERE movement.income_id = income.id AND movement.kind = 'withdrawal'
      ) THEN 1 ELSE 0 END AS is_savings_withdrawal
    FROM incomes income
  `);

  const savingsFundingRows = await db.getAllAsync<{ period_id: number; total: number }>(`
    SELECT expense.period_id, COALESCE(SUM(expense.amount), 0) AS total
    FROM savings_goal_movements movement
    INNER JOIN expenses expense ON expense.id = movement.expense_id
    WHERE movement.kind = 'funded_expense'
    GROUP BY expense.period_id
  `);
  const savingsFundingByPeriod = new Map(
    savingsFundingRows.map((row) => [row.period_id, Number(row.total)])
  );

  // Organize expenses by period, by category
  const expensesByPeriodCategory = new Map<
    number,
    Map<number | null, number>
  >();
  const expensesByPeriodPaymentMethod = new Map<
    number,
    Map<number | null, number>
  >();

  for (const exp of expenses) {
    if (!expensesByPeriodCategory.has(exp.period_id)) {
      expensesByPeriodCategory.set(
        exp.period_id,
        new Map<number | null, number>()
      );
    }
    const catMap = expensesByPeriodCategory.get(exp.period_id)!;
    catMap.set(
      exp.category_id,
      (catMap.get(exp.category_id) ?? 0) + exp.amount
    );

    if (!expensesByPeriodPaymentMethod.has(exp.period_id)) {
      expensesByPeriodPaymentMethod.set(exp.period_id, new Map<number | null, number>());
    }
    const methodMap = expensesByPeriodPaymentMethod.get(exp.period_id)!;
    methodMap.set(
      exp.payment_method_id,
      (methodMap.get(exp.payment_method_id) ?? 0) + exp.amount
    );
  }

  // Organize incomes total by period
  const incomesByPeriod = new Map<number, number>();
  const savingsWithdrawalsByPeriod = new Map<number, number>();
  for (const inc of incomes) {
    const target = inc.is_savings_withdrawal === 1
      ? savingsWithdrawalsByPeriod
      : incomesByPeriod;
    target.set(inc.period_id, (target.get(inc.period_id) ?? 0) + inc.amount);
  }

  const result: PeriodHistory[] = periods.map(period => {
    // For this period, get per-category totals
    const catTotals =
      expensesByPeriodCategory.get(period.id) ?? new Map<number | null, number>();

    // Build categories array with sum for each category present in catTotals
    const thisCategories = Array.from(catTotals.entries()).map(
      ([categoryId, total]) => {
        if (categoryId === null) {
          return {
            categoryId: null,
            categoryName: t('common.notSpecified'),
            categoryColor: '#95a5a6',
            periodLimit: null,
            total,
          };
        }
        const cat = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          categoryName: cat ? cat.name : t('database.unnamed'),
          categoryColor: cat ? cat.color : "#CCC",
          periodLimit: cat?.period_limit ?? null,
          total
        };
      }
    );

    // Sort categories by total descending (to match original order)
    thisCategories.sort((a, b) => b.total - a.total);

    const methodTotals =
      expensesByPeriodPaymentMethod.get(period.id) ?? new Map<number | null, number>();
    const thisPaymentMethods = Array.from(methodTotals.entries()).map(
      ([paymentMethodId, total]) => {
        const method = paymentMethods.find(item => item.id === paymentMethodId);
        return {
          paymentMethodId,
          paymentMethodName: method?.name ?? t('common.notSpecified'),
          paymentMethodColor: method?.color ?? '#95a5a6',
          paymentMethodType: method?.type ?? null,
          billingDay: method?.billing_day ?? null,
          active: method ? Number(method.active) === 1 : null,
          total,
        };
      }
    );
    thisPaymentMethods.sort((a, b) => b.total - a.total);

    // Fill incomesTotal for this period
    const incomesTotal = incomesByPeriod.get(period.id) ?? 0;

    return {
      periodId: period.id,
      startDate: period.start_date,
      endDate: period.end_date,
      year: new Date(period.start_date).getFullYear(),
      categories: thisCategories,
      paymentMethods: thisPaymentMethods,
      incomesTotal,
      savingsWithdrawalTotal: savingsWithdrawalsByPeriod.get(period.id) ?? 0,
      savingsFundingTotal: savingsFundingByPeriod.get(period.id) ?? 0,
    };
  });

  return result;
}

export async function getPeriodStatement(
  periodId: number
): Promise<PeriodStatement> {
  const db = await getDb();

  const [expenses, incomes] = await Promise.all([
    db.getAllAsync<ExpenseWithCategory>(
      `
      SELECT
        e.id,
        e.name,
        e.amount,
        e.category_id AS categoryId,
        e.period_id AS periodId,
        e.date,
        e.original_amount AS originalAmount,
        e.split_percentage AS splitPercentage,
        e.payment_method_id AS paymentMethodId,
        e.recurring_expense_id AS recurringExpenseId,
        e.debt_plan_id AS debtPlanId,
        installment.installment_number AS installmentNumber,
        plan.total_installments AS totalInstallments,
        savingsGoal.id AS savingsGoalId,
        savingsMovement.kind AS savingsKind,
        c.name AS categoryName,
        c.color AS categoryColor,
        pm.name AS paymentMethodName,
        pm.type AS paymentMethodType,
        pm.color AS paymentMethodColor,
        savingsGoal.name AS savingsGoalName,
        savingsGoal.color AS savingsGoalColor
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
      LEFT JOIN debt_installments installment ON installment.id = e.debt_installment_id
      LEFT JOIN debt_plans plan ON plan.id = e.debt_plan_id
      LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.expense_id = e.id
      LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id
      WHERE e.period_id = ?
      ORDER BY e.date ASC, e.id ASC
      `,
      periodId
    ),
    db.getAllAsync<Income>(
      `
      SELECT
        income.id,
        income.name,
        income.amount,
        income.period_id AS periodId,
        income.date,
        income.recurring_income_id AS recurringIncomeId,
        savingsGoal.id AS savingsGoalId,
        savingsGoal.name AS savingsGoalName,
        savingsGoal.color AS savingsGoalColor
      FROM incomes income
      LEFT JOIN savings_goal_movements savingsMovement ON savingsMovement.income_id = income.id
      LEFT JOIN savings_goals savingsGoal ON savingsGoal.id = savingsMovement.goal_id
      WHERE income.period_id = ?
      ORDER BY income.date ASC, income.id ASC
      `,
      periodId
    ),
  ]);

  return { expenses, incomes };
}

export async function getPeriodFinancialDetails(periodId: number): Promise<PeriodFinancialDetails> {
  const db = await getDb();
  const period = await db.getFirstAsync<{ start_date: string; end_date: string }>(
    'SELECT start_date, end_date FROM periods WHERE id = ?',
    periodId
  );
  if (!period) throw new Error(t('database.periodMissing'));

  const [debts, installments, creditCycles, recurringMovements] = await Promise.all([
    db.getAllAsync<PeriodFinancialDetails['debts'][number]>(
      `SELECT
        debt.id AS debtId,
        debt.name,
        debt.type,
        debt.creditor,
        debt.status,
        payment.name AS paymentMethodName,
        debt.initial_amount
          + COALESCE(SUM(CASE WHEN entry.date < ? AND entry.kind = 'adjustment' THEN entry.amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry.date < ? AND entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0)
          AS openingBalance,
        COALESCE(SUM(CASE WHEN entry.date BETWEEN ? AND ? AND entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0)
          AS payments,
        COALESCE(SUM(CASE WHEN entry.date BETWEEN ? AND ? AND entry.kind = 'adjustment' THEN entry.amount ELSE 0 END), 0)
          AS adjustments,
        debt.initial_amount
          + COALESCE(SUM(CASE WHEN entry.date <= ? AND entry.kind = 'adjustment' THEN entry.amount ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN entry.date <= ? AND entry.kind = 'payment' THEN entry.amount ELSE 0 END), 0)
          AS closingBalance
       FROM manual_debts debt
       LEFT JOIN manual_debt_entries entry ON entry.debt_id = debt.id
       LEFT JOIN payment_methods payment ON payment.id = debt.payment_method_id
       GROUP BY debt.id
       HAVING SUM(CASE WHEN entry.date BETWEEN ? AND ? THEN 1 ELSE 0 END) > 0
          OR (date(debt.created_at) <= ? AND closingBalance > 0)
       ORDER BY closingBalance DESC, debt.name COLLATE NOCASE`,
      period.start_date,
      period.start_date,
      period.start_date,
      period.end_date,
      period.start_date,
      period.end_date,
      period.end_date,
      period.end_date,
      period.start_date,
      period.end_date,
      period.end_date
    ),
    db.getAllAsync<PeriodFinancialDetails['installments'][number]>(
      `SELECT
        plan.id AS planId,
        plan.name,
        installment.installment_number AS installmentNumber,
        plan.total_installments AS totalInstallments,
        installment.due_date AS dueDate,
        COALESCE(expense.amount, installment.projected_amount) AS amount,
        installment.status,
        category.name AS categoryName,
        payment.name AS paymentMethodName
       FROM debt_installments installment
       INNER JOIN debt_plans plan ON plan.id = installment.debt_plan_id
       INNER JOIN payment_methods payment ON payment.id = plan.payment_method_id
       LEFT JOIN categories category ON category.id = plan.category_id
       LEFT JOIN expenses expense ON expense.id = installment.expense_id
       WHERE installment.due_date BETWEEN ? AND ? OR expense.period_id = ?
       ORDER BY installment.due_date, plan.name COLLATE NOCASE`,
      period.start_date,
      period.end_date,
      periodId
    ),
    db.getAllAsync<PeriodFinancialDetails['creditCycles'][number]>(
      `SELECT
        cycle.id AS cycleId,
        payment.name AS paymentMethodName,
        cycle.start_date AS startDate,
        cycle.end_date AS endDate,
        cycle.statement_amount AS statementAmount,
        COALESCE((
          SELECT SUM(expense.amount)
          FROM expenses expense
          WHERE expense.payment_method_id = cycle.payment_method_id
            AND expense.date BETWEEN cycle.start_date AND cycle.end_date
        ), 0) AS recordedTotal,
        cycle.status
       FROM credit_card_cycles cycle
       INNER JOIN payment_methods payment ON payment.id = cycle.payment_method_id
       WHERE cycle.start_date <= ? AND cycle.end_date >= ?
       ORDER BY cycle.end_date, payment.name COLLATE NOCASE`,
      period.end_date,
      period.start_date
    ),
    db.getAllAsync<PeriodFinancialDetails['recurringMovements'][number]>(
      `SELECT kind, name, amount, scheduledDate, status FROM (
        SELECT
          'expense' AS kind,
          recurring.name,
          recurring.amount,
          occurrence.scheduled_date AS scheduledDate,
          occurrence.status
        FROM recurring_expense_occurrences occurrence
        INNER JOIN recurring_expenses recurring ON recurring.id = occurrence.recurring_expense_id
        WHERE occurrence.scheduled_date BETWEEN ? AND ?
        UNION ALL
        SELECT
          'income' AS kind,
          recurring.name,
          recurring.amount,
          occurrence.scheduled_date AS scheduledDate,
          occurrence.status
        FROM recurring_income_occurrences occurrence
        INNER JOIN recurring_incomes recurring ON recurring.id = occurrence.recurring_income_id
        WHERE occurrence.scheduled_date BETWEEN ? AND ?
      ) ORDER BY scheduledDate, kind, name COLLATE NOCASE`,
      period.start_date,
      period.end_date,
      period.start_date,
      period.end_date
    ),
  ]);

  return { debts, installments, creditCycles, recurringMovements };
}

/**
 * Closes the cached SQLite connection. Used by the restore workflow before
 * replacing the database file.
 */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) {
    initializationPromise = null;
    return;
  }
  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
  initializationPromise = null;
}

/**
 * Drops the cached connection without touching the database file.
 * The next database access will open it again.
 */
export function resetDatabaseConnection(): void {
  dbPromise = null;
  initializationPromise = null;
}

/**
 * Forces schema initialization to run again without discarding the live
 * native connection. Restores use this after replacing the database contents
 * in place so React never keeps a reference to a closed SQLite handle.
 */
export function resetDatabaseInitialization(): void {
  initializationPromise = null;
}
