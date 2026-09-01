import * as SQLite from 'expo-sqlite';

import { addIsoDays, addIsoMonths, getNextOccurrenceDate, getOccurrenceDates } from './recurrence';
import type { Category, CreditCardCycle, DebtPlan, ExpenseWithCategory, GeneratedRecurringExpenseNotification, Income, NewCategory, NewCreditCardCycle, NewExpense, NewIncome, NewInstallmentPurchase, NewPaymentMethod, NewPeriod, NewRecurringExpense, NewRecurringIncome, NewRecurringSchedule, PaymentMethod, PaymentMethodTotal, Period, PeriodCategoryExpensesTotals, PeriodHistory, PeriodStatement, ReconcileCreditCardCycle, RecurringConfirmationSchedule, RecurringDecisionItem, RecurringExpense, RecurringIncome, RecurringOccurrenceStatus, Settings } from './types';

const DATABASE_NAME = 'gastos.db';

const RESERVED_COLORS = [
  '#008000', // Verde estándar para ingresos
];

// Utilidad para comparar colores en minúsculas y sin espacios
function normalizeColor(color: string): string {
  return color.trim().toLowerCase();
}

const DEFAULT_CATEGORIES: NewCategory[] = [
  { name: 'Alimentación', color: '#e74c3c', periodLimit: null },
  { name: 'Transporte', color: '#3498db', periodLimit: null },
  { name: 'Cuentas', color: '#34495e', periodLimit: null },
  { name: 'Ahorro', color: '#27ae60', periodLimit: null },
  { name: 'Salud', color: '#1abc9c', periodLimit: null },
  { name: 'Diversión', color: '#9b59b6', periodLimit: null },
  { name: 'Mascotas', color: '#e67e22', periodLimit: null },
  { name: 'Extras', color: '#95a5a6', periodLimit: null },
  { name: 'Hogar', color: '#2ecc71', periodLimit: null },
  { name: 'Suscripciones', color: '#8e44ad', periodLimit: null },
  { name: 'Vestuario', color: '#d35400', periodLimit: null },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DATABASE_NAME);
  }
  return dbPromise;
}

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  return getDatabase();
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
    throw new Error('No se permite usar ese color porque está reservado para los ingresos');
  }

  const nameRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? AND id != ?',
    data.name.trim(),
    excludeId ?? -1
  );
  if (nameRow) {
    throw new Error('Ya existe una categoría con ese nombre');
  }

  const colorRow = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE color = ? AND id != ?',
    colorNormalized,
    excludeId ?? -1
  );
  if (colorRow) {
    throw new Error('Ese color ya está en uso por otra categoría');
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
      expense.date
    FROM recurring_expenses recurring
    INNER JOIN expenses expense ON expense.id = recurring.source_expense_id
  `);

  for (const source of sources) {
    await db.withExclusiveTransactionAsync(async (transaction) => {
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
          category_id = ?, payment_method_id = ?,
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

export async function initDatabase(): Promise<void> {
  const db = await getDb();

  await db.execAsync(`
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
      period_limit INTEGER
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

      FOREIGN KEY(category_id)
          REFERENCES categories(id)
          ON DELETE RESTRICT,

      FOREIGN KEY(period_id)
          REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS incomes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount INTEGER NOT NULL,
      period_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      FOREIGN KEY(period_id) REFERENCES periods(id)
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL CHECK (type IN ('cash', 'debit', 'prepaid', 'credit')),
      billing_day INTEGER,
      color TEXT NOT NULL DEFAULT '#0a7ea4',
      active INTEGER NOT NULL DEFAULT 1
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL,
      FOREIGN KEY(payment_method_id) REFERENCES payment_methods(id) ON DELETE SET NULL,
      FOREIGN KEY(source_expense_id) REFERENCES expenses(id) ON DELETE SET NULL
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
      start_date TEXT NOT NULL,
      end_date TEXT,
      next_date TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      source_income_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(source_income_id) REFERENCES incomes(id) ON DELETE SET NULL
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
  const incomeColumns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(incomes)');
  if (!incomeColumns.some((column) => column.name === 'recurring_income_id')) {
    await db.execAsync('ALTER TABLE incomes ADD COLUMN recurring_income_id INTEGER;');
  }

  const recurringOccurrenceColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(recurring_expense_occurrences)'
  );
  if (!recurringOccurrenceColumns.some((column) => column.name === 'dismissed')) {
    await db.execAsync(
      'ALTER TABLE recurring_expense_occurrences ADD COLUMN dismissed INTEGER NOT NULL DEFAULT 0;'
    );
  }

  const debtInstallmentColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(debt_installments)'
  );
  if (!debtInstallmentColumns.some((column) => column.name === 'manually_removed')) {
    await db.execAsync('ALTER TABLE debt_installments ADD COLUMN manually_removed INTEGER NOT NULL DEFAULT 0;');
  }

  const paymentMethodColumns = await db.getAllAsync<{ name: string }>(
    'PRAGMA table_info(payment_methods)'
  );
  if (!paymentMethodColumns.some((column) => column.name === 'color')) {
    await db.execAsync("ALTER TABLE payment_methods ADD COLUMN color TEXT NOT NULL DEFAULT '#0a7ea4';");
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
    CREATE INDEX IF NOT EXISTS idx_expenses_period_category ON expenses(period_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period_date ON expenses(period_id, date);
    CREATE INDEX IF NOT EXISTS idx_expenses_payment_method ON expenses(payment_method_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_recurring ON expenses(recurring_expense_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_debt_plan ON expenses(debt_plan_id);
    CREATE INDEX IF NOT EXISTS idx_credit_cycles_method_end ON credit_card_cycles(payment_method_id, end_date);
    CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_expenses(active);
    CREATE INDEX IF NOT EXISTS idx_recurring_occurrence_date ON recurring_expense_occurrences(recurring_expense_id, scheduled_date);
    CREATE INDEX IF NOT EXISTS idx_debt_installments_due ON debt_installments(debt_plan_id, due_date);
    CREATE INDEX IF NOT EXISTS idx_incomes_recurring ON incomes(recurring_income_id);
    CREATE INDEX IF NOT EXISTS idx_recurring_incomes_next ON recurring_incomes(active, next_date);

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

  await db.runAsync(
    `INSERT OR IGNORE INTO payment_methods (name, type, billing_day, color, active)
     VALUES ('Efectivo', 'cash', NULL, '#27ae60', 1)`
  );

  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM categories'
  );

  if ((row?.count ?? 0) === 0) {
    for (const category of DEFAULT_CATEGORIES) {
      // Validamos aquí también para evitar cargar por defecto un color prohibido
      if (!RESERVED_COLORS.map(normalizeColor).includes(normalizeColor(category.color))) {
        await db.runAsync(
          'INSERT INTO categories (name, color, period_limit) VALUES (?, ?, ?)',
          category.name,
          category.color,
          category.periodLimit
        );
      }
    }
  }
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
  if (!period) throw new Error('El período seleccionado ya no existe');
  if (date < period.start_date || date > period.end_date) {
    throw new Error('La fecha del movimiento no pertenece al período seleccionado');
  }
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as number,
    name: row.name as string,
    color: row.color as string,
    periodLimit: row.period_limit != null ? (row.period_limit as number) : null,
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
  };

  await assertUniqueCategoryFields(db, normalized);

  const result = await db.runAsync(
    'INSERT INTO categories (name, color, period_limit) VALUES (?, ?, ?)',
    normalized.name,
    normalized.color,
    normalized.periodLimit
  );
  return {
    id: result.lastInsertRowId,
    name: normalized.name,
    color: normalized.color,
    periodLimit: normalized.periodLimit,
  };
}

export async function updateCategory(
  id: number,
  data: NewCategory
): Promise<void> {
  const db = await getDb();
  const normalized = {
    name: data.name.trim(),
    color: data.color.toLowerCase(),
    periodLimit: data.periodLimit,
  };

  await assertUniqueCategoryFields(db, normalized, id);

  await db.runAsync(
    'UPDATE categories SET name = ?, color = ?, period_limit = ? WHERE id = ?',
    normalized.name,
    normalized.color,
    normalized.periodLimit,
    id
  );
}

export async function deleteCategory(
  id: number,
  detachExpenses = false
): Promise<void> {
  const db = await getDb();
  if (!detachExpenses) {
    await db.runAsync('DELETE FROM categories WHERE id = ?', id);
    return;
  }

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'UPDATE expenses SET category_id = NULL WHERE category_id = ?',
      id
    );
    await transaction.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}

function mapPaymentMethod(row: Record<string, unknown>): PaymentMethod {
  return {
    id: row.id as number,
    name: row.name as string,
    type: row.type as PaymentMethod['type'],
    billingDay: row.billing_day == null ? null : Number(row.billing_day),
    color: row.color as string,
    active: Number(row.active) === 1,
  };
}

export async function getPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT id, name, type, billing_day, color, active
     FROM payment_methods
     ${includeInactive ? '' : 'WHERE active = 1'}
     ORDER BY active DESC, type ASC, name COLLATE NOCASE ASC`
  );
  return rows.map(mapPaymentMethod);
}

function validatePaymentMethod(data: NewPaymentMethod) {
  if (!data.name.trim()) throw new Error('Ingresa un nombre para el medio de pago');
  if (!/^#[0-9a-f]{6}$/i.test(data.color)) throw new Error('Selecciona un color válido');
  if (data.type === 'credit') {
    if (data.billingDay == null || data.billingDay < 1 || data.billingDay > 31) {
      throw new Error('El día estimado de facturación debe estar entre 1 y 31');
    }
  }
}

export async function createPaymentMethod(data: NewPaymentMethod): Promise<void> {
  validatePaymentMethod(data);
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO payment_methods (name, type, billing_day, color, active)
     VALUES (?, ?, ?, ?, 1)`,
    data.name.trim(),
    data.type,
    data.type === 'credit' ? data.billingDay : null,
    data.color.toLowerCase()
  );
}

export async function updatePaymentMethod(id: number, data: NewPaymentMethod): Promise<void> {
  const db = await getDb();
  const current = await db.getFirstAsync<{ type: PaymentMethod['type'] }>(
    'SELECT type FROM payment_methods WHERE id = ?',
    id
  );
  if (!current) throw new Error('El medio de pago ya no existe');
  const immutableTypeData = { ...data, type: current.type };
  validatePaymentMethod(immutableTypeData);
  await db.runAsync(
    `UPDATE payment_methods SET name = ?, billing_day = ?, color = ? WHERE id = ?`,
    data.name.trim(),
    current.type === 'credit' ? data.billingDay : null,
    data.color.toLowerCase(),
    id
  );
}

export async function setPaymentMethodActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('UPDATE payment_methods SET active = ? WHERE id = ?', active ? 1 : 0, id);
    if (!active) {
      await transaction.runAsync(
        'UPDATE settings SET default_payment_method_id = NULL WHERE default_payment_method_id = ?',
        id
      );
    }
  });
}

export async function setDefaultPaymentMethod(id: number | null): Promise<void> {
  const db = await getDb();
  if (id != null) {
    const method = await db.getFirstAsync<{ active: number }>(
      'SELECT active FROM payment_methods WHERE id = ?',
      id
    );
    if (!method || Number(method.active) !== 1) {
      throw new Error('Solo puedes elegir un medio de pago activo');
    }
  }
  await db.runAsync('UPDATE settings SET default_payment_method_id = ? WHERE id = 1', id);
}

export async function getPaymentMethodTotals(periodId: number): Promise<PaymentMethodTotal[]> {
  const db = await getDb();
  return db.getAllAsync<PaymentMethodTotal>(
    `SELECT
       e.payment_method_id AS paymentMethodId,
       COALESCE(pm.name, 'No especificado') AS paymentMethodName,
       pm.type AS paymentMethodType,
       pm.color AS paymentMethodColor,
       SUM(e.amount) AS total
     FROM expenses e
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     WHERE e.period_id = ?
     GROUP BY e.payment_method_id, pm.name, pm.type, pm.color
     ORDER BY total DESC`,
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
  if (method?.type !== 'credit') throw new Error('El medio de pago no es una tarjeta de crédito');
  const latest = await db.getFirstAsync<{ end_date: string }>(
    `SELECT end_date FROM credit_card_cycles
     WHERE payment_method_id = ? ORDER BY end_date DESC LIMIT 1`,
    data.paymentMethodId
  );
  if (latest && data.endDate <= latest.end_date) {
    throw new Error('La nueva facturación debe ser posterior a la última registrada');
  }
  const previous = await db.getFirstAsync<{ end_date: string }>(
    `SELECT end_date FROM credit_card_cycles
     WHERE payment_method_id = ? AND end_date < ?
     ORDER BY end_date DESC LIMIT 1`,
    data.paymentMethodId,
    data.endDate
  );
  const startDate = previous ? addDaysToIso(previous.end_date, 1) : firstCycleStart(data.endDate);
  if (startDate > data.endDate) throw new Error('La fecha de facturación no es válida');
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
    "SELECT id FROM categories WHERE name = 'Comisiones Bancarias'"
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
     VALUES ('Comisiones Bancarias', ?, NULL)`,
    color
  );
  return result.lastInsertRowId;
}

export async function reconcileCreditCardCycle(
  id: number,
  data: ReconcileCreditCardCycle
): Promise<void> {
  if (!Number.isFinite(data.statementAmount) || data.statementAmount < 0) {
    throw new Error('Ingresa el monto real facturado');
  }
  if (!Number.isFinite(data.bankChargeAmount) || data.bankChargeAmount < 0) {
    throw new Error('El cargo bancario no es válido');
  }
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
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
    if (!cycle) throw new Error('El ciclo ya no existe');
    if (cycle.status === 'reconciled') throw new Error('Este ciclo ya está consolidado');

    const period = await transaction.getFirstAsync<{ id: number }>(
      'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
      cycle.end_date,
      cycle.end_date
    );
    if (!period) throw new Error('No existe un período que incluya la fecha de facturación');
    const categoryId = await getOrCreateBankFeesCategory(transaction);
    let bankChargeExpenseId: number | null = null;
    if (data.bankChargeAmount > 0) {
      const result = await transaction.runAsync(
        `INSERT INTO expenses
          (name, amount, category_id, period_id, date, original_amount, split_percentage,
           payment_method_id, recurring_expense_id)
         VALUES ('Mantención / Comisiones', ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
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
         VALUES ('Diferencia de Facturación / Intereses', ?, ?, ?, ?, NULL, NULL, ?, NULL)`,
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
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const cycle = await transaction.getFirstAsync<{
      status: CreditCardCycle['status'];
      bank_charge_expense_id: number | null;
      adjustment_expense_id: number | null;
    }>(
      `SELECT status, bank_charge_expense_id, adjustment_expense_id
       FROM credit_card_cycles WHERE id = ?`,
      id
    );
    if (!cycle) throw new Error('El estado de cuenta ya no existe');
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

function installmentAmounts(totalAmount: number, count: number, regularAmount?: number): number[] {
  const amount = regularAmount ?? Math.floor(totalAmount / count);
  const values = Array.from({ length: count }, () => amount);
  let remainder = totalAmount - amount * count;
  for (let index = count - 1; index >= 0 && remainder > 0; index -= 1) {
    values[index] += 1;
    remainder -= 1;
  }
  return values;
}

export async function createInstallmentPurchase(data: NewInstallmentPurchase): Promise<number> {
  if (!data.name.trim()) throw new Error('Ingresa el nombre de la compra');
  if (!Number.isInteger(data.totalAmount) || data.totalAmount <= 0) throw new Error('Ingresa un monto total válido');
  if (!Number.isInteger(data.totalInstallments) || data.totalInstallments < 2 || data.totalInstallments > 600) {
    throw new Error('El número de cuotas debe estar entre 2 y 600');
  }
  const db = await getDb();
  const method = await db.getFirstAsync<{ type: string }>('SELECT type FROM payment_methods WHERE id = ?', data.paymentMethodId);
  if (method?.type !== 'credit') throw new Error('Las compras en cuotas requieren una tarjeta de crédito');
  let planId = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const amounts = installmentAmounts(data.totalAmount, data.totalInstallments);
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
    postedInstallments: Number(row.posted_installments), remainingAmount: Number(row.remaining_amount),
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
    `${plan.name} · Cuota ${installment.installment_number}/${plan.total_installments}`,
    installment.projected_amount, plan.category_id, period.id, date,
    plan.payment_method_id, plan.id, installment.id
  );
  await transaction.runAsync(
    `UPDATE debt_installments SET status = 'posted', expense_id = ? WHERE id = ?`,
    result.lastInsertRowId, installment.id
  );
  return true;
}

export async function activateInstallmentPlan(id: number, periodId: number, actualAmount: number): Promise<void> {
  if (!Number.isInteger(actualAmount) || actualAmount <= 0) throw new Error('Ingresa el monto real de la cuota');
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const plan = await transaction.getFirstAsync<{
      id: number; name: string; total_amount: number; category_id: number | null; payment_method_id: number;
      total_installments: number; status: string;
    }>('SELECT * FROM debt_plans WHERE id = ?', id);
    if (!plan) throw new Error('La compra en cuotas ya no existe');
    if (plan.status !== 'projected') throw new Error('Esta compra ya fue activada');
    if (plan.total_installments === 1 && actualAmount !== plan.total_amount) {
      throw new Error('En una sola cuota, el monto real debe coincidir con el total pactado');
    }
    const lastAmount = plan.total_amount - actualAmount * (plan.total_installments - 1);
    if (lastAmount <= 0) throw new Error('Ese monto no permite mantener el total pactado; usa un valor menor');
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE id = ?', periodId
    );
    if (!period) throw new Error('El período seleccionado ya no existe');
    const originalFirst = await transaction.getFirstAsync<{ due_date: string }>(
      'SELECT due_date FROM debt_installments WHERE debt_plan_id = ? AND installment_number = 1', id
    );
    if (!originalFirst) throw new Error('No se encontró la primera cuota');
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
    if (!first) throw new Error('No se encontró la primera cuota');
    const posted = await postInstallment(transaction, plan, { ...first, projected_amount: actualAmount }, period);
    if (!posted) throw new Error('El período elegido pertenece a un estado de cuenta consolidado. Desconsolídalo antes de activar la cuota.');
    await transaction.runAsync(
      `UPDATE debt_plans SET status = 'active', installment_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      actualAmount, id
    );
  });
  await processProjectedInstallments();
}

export async function processProjectedInstallments(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
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

export async function restoreRemovedInstallment(installmentId: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const installment = await transaction.getFirstAsync<{
      id: number; debt_plan_id: number; installment_number: number; due_date: string; projected_amount: number;
      name: string; category_id: number | null; payment_method_id: number; total_installments: number;
    }>(
      `SELECT i.*, p.name, p.category_id, p.payment_method_id, p.total_installments
       FROM debt_installments i INNER JOIN debt_plans p ON p.id = i.debt_plan_id
       WHERE i.id = ? AND i.status = 'projected' AND i.manually_removed = 1`,
      installmentId
    );
    if (!installment) throw new Error('La cuota no está disponible para volver a registrarla');
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
      installment.due_date, installment.due_date
    );
    if (!period) throw new Error('Todavía no existe el período correspondiente a esta cuota');
    const posted = await postInstallment(
      transaction,
      { id: installment.debt_plan_id, name: installment.name, category_id: installment.category_id, payment_method_id: installment.payment_method_id, total_installments: installment.total_installments },
      installment,
      period
    );
    if (!posted) throw new Error('El estado de cuenta de ese período está consolidado. Desconsolídalo antes de volver a registrar la cuota.');
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

export async function cancelFutureInstallments(id: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync("UPDATE debt_installments SET status = 'cancelled', manually_removed = 0 WHERE debt_plan_id = ? AND status = 'projected'", id);
    const result = await transaction.runAsync("UPDATE debt_plans SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('projected', 'active')", id);
    if (result.changes === 0) throw new Error('La compra ya no tiene cuotas futuras');
  });
}

export async function settleInstallmentPlan(id: number, periodId: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const plan = await transaction.getFirstAsync<{ id: number; name: string; category_id: number | null; payment_method_id: number }>(
      "SELECT id, name, category_id, payment_method_id FROM debt_plans WHERE id = ? AND status = 'active'", id
    );
    if (!plan) throw new Error('La compra no tiene cuotas activas para liquidar');
    const remaining = await transaction.getFirstAsync<{ total: number }>(
      "SELECT COALESCE(SUM(projected_amount), 0) AS total FROM debt_installments WHERE debt_plan_id = ? AND status = 'projected'", id
    );
    if (!remaining || remaining.total <= 0) throw new Error('No queda saldo pendiente');
    const period = await transaction.getFirstAsync<{ id: number; start_date: string; end_date: string }>(
      'SELECT id, start_date, end_date FROM periods WHERE id = ?', periodId
    );
    if (!period) throw new Error('El período seleccionado ya no existe');
    await assertCreditCardCycleIsEditable(transaction, plan.payment_method_id, period.end_date);
    await transaction.runAsync(
      `INSERT INTO expenses
        (name, amount, category_id, period_id, date, original_amount, split_percentage,
         payment_method_id, recurring_expense_id, debt_plan_id, debt_installment_id)
       VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, NULL, ?, NULL)`,
      `${plan.name} · Liquidación de cuotas`, remaining.total, plan.category_id,
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
        e.recurring_expense_id AS recurringExpenseId,
        e.debt_plan_id AS debtPlanId,
        installment.installment_number AS installmentNumber,
        plan.total_installments AS totalInstallments,

        c.name AS categoryName,
        c.color AS categoryColor,
        pm.name AS paymentMethodName,
        pm.type AS paymentMethodType,
        pm.color AS paymentMethodColor

      FROM expenses e

      LEFT JOIN categories c
        ON c.id = e.category_id

      LEFT JOIN payment_methods pm
        ON pm.id = e.payment_method_id
      LEFT JOIN debt_installments installment ON installment.id = e.debt_installment_id
      LEFT JOIN debt_plans plan ON plan.id = e.debt_plan_id

      WHERE e.period_id = ?

      ORDER BY
        e.date DESC,
        e.id DESC
      `,
      targetPeriodId
    );

  return rows as ExpenseWithCategory[];
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
      e.recurring_expense_id AS recurringExpenseId,
      e.debt_plan_id AS debtPlanId,
      installment.installment_number AS installmentNumber,
      plan.total_installments AS totalInstallments,
      c.name AS categoryName,
      c.color AS categoryColor,
      pm.name AS paymentMethodName,
      pm.type AS paymentMethodType,
      pm.color AS paymentMethodColor
     FROM expenses e
     LEFT JOIN categories c ON c.id = e.category_id
     LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
     LEFT JOIN debt_installments installment ON installment.id = e.debt_installment_id
     LEFT JOIN debt_plans plan ON plan.id = e.debt_plan_id
     WHERE e.id = ?`,
    id
  );
  return row ?? null;
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
    throw new Error('Este gasto pertenece a un estado de cuenta consolidado y no se puede modificar');
  }
}

export async function createExpense(
  data: NewExpense,
  periodId?: number
): Promise<number> {
  const targetPeriodId = periodId ?? await getCurrentPeriodId();

  const db = await getDb();
  await assertDateBelongsToPeriod(db, targetPeriodId, data.date);
  await assertCreditCardCycleIsEditable(db, data.paymentMethodId, data.date);

  const result = await db.runAsync(
    `
    INSERT INTO expenses (
      name,
      amount,
      category_id,
      period_id,
      date,
      original_amount,
      split_percentage
      ,payment_method_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    data.name.trim(),
    data.amount,
    data.categoryId,
    targetPeriodId,
    data.date,
    data.originalAmount,
    data.splitPercentage
    ,data.paymentMethodId
  );
  return result.lastInsertRowId;
}

export async function updateExpense(
  id: number,
  data: NewExpense
): Promise<void> {

  const db = await getDb();
  const expense = await db.getFirstAsync<{
    period_id: number;
    date: string;
    payment_method_id: number | null;
    recurring_expense_id: number | null;
  }>(
    'SELECT period_id, date, payment_method_id, recurring_expense_id FROM expenses WHERE id = ?',
    id
  );
  if (!expense) throw new Error('El gasto ya no existe');
  await assertDateBelongsToPeriod(db, expense.period_id, data.date);
  await assertCreditCardCycleIsEditable(db, expense.payment_method_id, expense.date);
  await assertCreditCardCycleIsEditable(db, data.paymentMethodId, data.date);

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `UPDATE expenses SET
        name = ?, amount = ?, category_id = ?, date = ?,
        original_amount = ?, split_percentage = ?, payment_method_id = ?
       WHERE id = ?`,
      data.name.trim(),
      data.amount,
      data.categoryId,
      data.date,
      data.originalAmount,
      data.splitPercentage,
      data.paymentMethodId,
      id
    );

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

    if (data.date !== expense.date) {
      const collision = await transaction.getFirstAsync(
        `SELECT id FROM recurring_expense_occurrences
         WHERE recurring_expense_id = ? AND scheduled_date = ? AND expense_id != ?`,
        recurring.id,
        data.date,
        id
      );
      if (collision) {
        throw new Error('La recurrencia ya tiene otra ejecución en la nueva fecha');
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
        category_id = ?, payment_method_id = ?, start_date = ?, execution_day = ?,
        end_date = CASE WHEN end_date IS NOT NULL AND end_date < ? THEN ? ELSE end_date END,
        source_expense_id = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      data.name.trim(),
      data.amount,
      data.originalAmount,
      data.splitPercentage,
      data.categoryId,
      data.paymentMethodId,
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
  const expense = await db.getFirstAsync<{ date: string; payment_method_id: number | null; debt_installment_id: number | null }>(
    'SELECT date, payment_method_id, debt_installment_id FROM expenses WHERE id = ?',
    id
  );
  if (!expense) return;
  await assertCreditCardCycleIsEditable(db, expense.payment_method_id, expense.date);
  await db.withExclusiveTransactionAsync(async (transaction) => {
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

    await transaction.runAsync('DELETE FROM expenses WHERE id = ?', id);

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
  if (!data.name.trim()) throw new Error('Ingresa un nombre para el gasto recurrente');
  if (!Number.isFinite(data.amount) || data.amount <= 0) throw new Error('Ingresa un monto válido');
  if (data.frequency === 'custom' && (!Number.isInteger(data.intervalMonths) || data.intervalMonths < 1)) {
    throw new Error('El intervalo personalizado debe ser de al menos un mes');
  }
  if (
    (data.frequency === 'monthly' || data.frequency === 'custom') &&
    (data.executionDay == null || !Number.isInteger(data.executionDay) || data.executionDay < 1 || data.executionDay > 31)
  ) {
    throw new Error('Ingresa un día de ejecución válido');
  }
  if (data.endDate && data.endDate < data.startDate) {
    throw new Error('La fecha de fin no puede ser anterior al inicio');
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
  const [rules, occurrences] = await Promise.all([
    getRecurringRows(db),
    db.getAllAsync<{
      recurring_expense_id: number;
      scheduled_date: string;
      status: RecurringOccurrenceStatus;
    }>('SELECT recurring_expense_id, scheduled_date, status FROM recurring_expense_occurrences'),
  ]);
  const today = toLocalIsoDate(new Date());
  const horizon = addIsoDays(today, 3660);

  return rules.map((rule) => {
    const ruleOccurrences = occurrences.filter((item) => item.recurring_expense_id === rule.id);
    const statuses = new Map(ruleOccurrences.map((item) => [item.scheduled_date, item.status]));
    const overduePending = ruleOccurrences
      .filter((item) => item.status === 'pending')
      .map((item) => item.scheduled_date)
      .sort()[0] ?? null;
    const nextDate = overduePending ?? getOccurrenceDates(rule, today, horizon, 5000)
      .find((date) => !['generated', 'skipped'].includes(statuses.get(date) ?? '')) ?? null;
    return {
      ...rule,
      nextDate,
      pendingCount: ruleOccurrences.filter((item) => item.status === 'pending').length,
    };
  });
}

export async function getRecurringDecisionItems(): Promise<RecurringDecisionItem[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    recurring_expense_id: number;
    name: string;
    amount: number;
    scheduled_date: string;
    status: 'pending' | 'skipped';
  }>(
    `SELECT
       o.recurring_expense_id,
       r.name,
       r.amount,
       o.scheduled_date,
       o.status
     FROM recurring_expense_occurrences o
     INNER JOIN recurring_expenses r ON r.id = o.recurring_expense_id
     WHERE o.status IN ('pending', 'skipped') AND o.dismissed = 0
     ORDER BY CASE o.status WHEN 'pending' THEN 0 ELSE 1 END,
              o.scheduled_date DESC
     LIMIT 200`
  );
  return rows.map((row) => ({
    recurringExpenseId: row.recurring_expense_id,
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
  ] as const;
}

const RECURRING_INSERT_SQL = `INSERT INTO recurring_expenses (
  name, amount, original_amount, split_percentage, category_id, payment_method_id,
  frequency, interval_months, execution_basis, execution_day, registration_mode,
  start_date, end_date, active, source_expense_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

export async function createRecurringExpense(data: NewRecurringExpense): Promise<number> {
  validateRecurringExpense(data);
  const db = await getDb();
  let createdId = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    let sourceDate: string | null = null;
    if (data.sourceExpenseId != null) {
      const source = await transaction.getFirstAsync<{ date: string }>(
        'SELECT date FROM expenses WHERE id = ?',
        data.sourceExpenseId
      );
      if (!source) throw new Error('El gasto de origen ya no existe');
      sourceDate = source.date;
    }
    const result = await transaction.runAsync(RECURRING_INSERT_SQL, ...recurringInsertValues(data));
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
  const recurrence: NewRecurringExpense = { ...expense, ...schedule, sourceExpenseId: null };
  validateRecurringExpense(recurrence);
  if (schedule.startDate !== expense.date) {
    throw new Error('La recurrencia debe comenzar en la fecha del gasto');
  }
  const db = await getDb();
  await assertDateBelongsToPeriod(db, periodId, expense.date);
  await assertCreditCardCycleIsEditable(db, expense.paymentMethodId, expense.date);
  let createdExpenseId = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
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
      expense.paymentMethodId,
      recurringResult.lastInsertRowId
    );
    createdExpenseId = expenseResult.lastInsertRowId;
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
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const current = await transaction.getFirstAsync('SELECT id FROM recurring_expenses WHERE id = ?', id);
    if (!current) throw new Error('El gasto recurrente ya no existe');
    await transaction.runAsync(
      `UPDATE recurring_expenses SET
        frequency = ?, interval_months = ?, execution_basis = ?,
        execution_day = ?, registration_mode = ?, start_date = ?, end_date = ?, active = ?,
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
      id
    );
    await transaction.runAsync(
      `DELETE FROM recurring_expense_occurrences
       WHERE recurring_expense_id = ? AND status IN ('scheduled', 'pending')`,
      id
    );
  });
}

export async function setRecurringExpenseActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync(
    'UPDATE recurring_expenses SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    active ? 1 : 0,
    id
  );
  if (result.changes === 0) throw new Error('El gasto recurrente ya no existe');
}

export async function deleteRecurringExpense(id: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'UPDATE expenses SET recurring_expense_id = NULL WHERE recurring_expense_id = ?',
      id
    );
    await transaction.runAsync(
      'DELETE FROM recurring_expense_occurrences WHERE recurring_expense_id = ?',
      id
    );
    const result = await transaction.runAsync('DELETE FROM recurring_expenses WHERE id = ?', id);
    if (result.changes === 0) throw new Error('El gasto recurrente ya no existe');
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
    const dates = getOccurrenceDates(rule, rule.startDate, today, 5000);
    const existing = new Map(
      occurrenceRows
        .filter((item) => item.recurring_expense_id === rule.id)
        .map((item) => [item.scheduled_date, item.status])
    );
    for (const scheduledDate of dates) {
      const status = existing.get(scheduledDate);
      if (status === 'generated' || status === 'skipped') continue;
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
      const period = periods.find(
        (item) => scheduledDate >= item.startDate && scheduledDate <= item.endDate
      );
      if (!period) continue;
      let wasCreated = false;
      await db.withExclusiveTransactionAsync(async (transaction) => {
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
  if (!rule) throw new Error('El gasto recurrente ya no existe');
  const period = periods.find(
    (item) => scheduledDate >= item.startDate && scheduledDate <= item.endDate
  );
  if (!period) throw new Error('No existe un período que incluya la fecha programada');
  let generatedExpenseId = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
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
    if (current?.status === 'skipped') throw new Error('Esta ejecución fue omitida');
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
    throw new Error('La notificación omitida ya no está disponible');
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
    throw new Error('La ejecución omitida ya no está disponible');
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
        recurringExpenseId: rule.id,
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
      id,
      name,
      amount,
      period_id AS periodId,
      date,
      recurring_income_id AS recurringIncomeId
    FROM incomes
    WHERE period_id = ?
    ORDER BY date DESC, id DESC
    `,
    targetPeriodId
  );

  return rows as Income[];
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


export async function createIncome(
  data: NewIncome,
  periodId?: number
): Promise<void> {
  const targetPeriodId = periodId ?? await getCurrentPeriodId();

  const db = await getDb();
  await assertDateBelongsToPeriod(db, targetPeriodId, data.date);

  await db.runAsync(
    `
    INSERT INTO incomes (
      name,
      amount,
      period_id,
      date
    )
    VALUES (?, ?, ?, ?)
    `,
    data.name.trim(),
    data.amount,
    targetPeriodId,
    data.date
  );
}

export async function createIncomeWithRecurrence(
  data: NewIncome,
  schedule: Omit<NewRecurringIncome, 'name' | 'amount' | 'sourceIncomeId'>,
  periodId: number
): Promise<void> {
  const db = await getDb();
  await assertDateBelongsToPeriod(db, periodId, data.date);
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const incomeResult = await transaction.runAsync(
      'INSERT INTO incomes (name, amount, period_id, date) VALUES (?, ?, ?, ?)',
      data.name.trim(), data.amount, periodId, data.date
    );
    const rule = { ...schedule, name: data.name.trim(), amount: data.amount };
    const nextDate = getNextOccurrenceDate(rule, data.date);
    const recurringResult = await transaction.runAsync(
      `INSERT INTO recurring_incomes
        (name, amount, frequency, interval_months, execution_day, start_date,
         end_date, next_date, active, source_income_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      rule.name, rule.amount, rule.frequency, rule.frequency === 'custom' ? rule.intervalMonths : 1,
      rule.executionDay, data.date, rule.endDate, nextDate, incomeResult.lastInsertRowId
    );
    await transaction.runAsync(
      'UPDATE incomes SET recurring_income_id = ? WHERE id = ?',
      recurringResult.lastInsertRowId, incomeResult.lastInsertRowId
    );
  });
}

export async function createRecurringIncomeFromSource(
  sourceIncomeId: number,
  schedule: Omit<NewRecurringIncome, 'name' | 'amount' | 'sourceIncomeId'>
): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const source = await transaction.getFirstAsync<{ id: number; name: string; amount: number; date: string; recurring_income_id: number | null }>(
      'SELECT id, name, amount, date, recurring_income_id FROM incomes WHERE id = ?', sourceIncomeId
    );
    if (!source) throw new Error('El ingreso de origen ya no existe');
    if (source.recurring_income_id != null) throw new Error('Este ingreso ya tiene una recurrencia');
    const rule = { ...schedule, name: source.name, amount: source.amount, startDate: source.date };
    const nextDate = getNextOccurrenceDate(rule, source.date);
    const result = await transaction.runAsync(
      `INSERT INTO recurring_incomes
        (name, amount, frequency, interval_months, execution_day, start_date,
         end_date, next_date, active, source_income_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
      source.name, source.amount, rule.frequency, rule.frequency === 'custom' ? rule.intervalMonths : 1,
      rule.executionDay, source.date, rule.endDate, nextDate, source.id
    );
    await transaction.runAsync('UPDATE incomes SET recurring_income_id = ? WHERE id = ?', result.lastInsertRowId, source.id);
  });
}

export async function getRecurringIncomes(): Promise<RecurringIncome[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM recurring_incomes ORDER BY active DESC, next_date, id DESC'
  );
  return rows.map((row) => ({
    id: Number(row.id), name: String(row.name), amount: Number(row.amount),
    frequency: row.frequency as RecurringIncome['frequency'], intervalMonths: Number(row.interval_months),
    executionDay: row.execution_day == null ? null : Number(row.execution_day),
    startDate: String(row.start_date), endDate: row.end_date == null ? null : String(row.end_date),
    nextDate: row.next_date == null ? null : String(row.next_date), active: Number(row.active) === 1,
    sourceIncomeId: row.source_income_id == null ? null : Number(row.source_income_id),
  }));
}

export async function updateRecurringIncome(id: number, data: NewRecurringIncome): Promise<void> {
  const db = await getDb();
  const last = await db.getFirstAsync<{ date: string }>(
    'SELECT date FROM incomes WHERE recurring_income_id = ? ORDER BY date DESC, id DESC LIMIT 1', id
  );
  const nextDate = getNextOccurrenceDate(data, last?.date ?? data.startDate);
  const result = await db.runAsync(
    `UPDATE recurring_incomes SET name = ?, amount = ?, frequency = ?, interval_months = ?,
      execution_day = ?, start_date = ?, end_date = ?, next_date = ?, active = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    data.name.trim(), data.amount, data.frequency, data.frequency === 'custom' ? data.intervalMonths : 1,
    data.executionDay, data.startDate, data.endDate, nextDate, data.active ? 1 : 0, id
  );
  if (result.changes === 0) throw new Error('El ingreso recurrente ya no existe');
}

export async function setRecurringIncomeActive(id: number, active: boolean): Promise<void> {
  const db = await getDb();
  const result = await db.runAsync('UPDATE recurring_incomes SET active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', active ? 1 : 0, id);
  if (result.changes === 0) throw new Error('El ingreso recurrente ya no existe');
}

export async function deleteRecurringIncome(id: number): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('UPDATE incomes SET recurring_income_id = NULL WHERE recurring_income_id = ?', id);
    const result = await transaction.runAsync('DELETE FROM recurring_incomes WHERE id = ?', id);
    if (result.changes === 0) throw new Error('El ingreso recurrente ya no existe');
  });
}

export async function processDueRecurringIncomes(): Promise<void> {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const rules = await transaction.getAllAsync<{
      id: number; name: string; amount: number; frequency: RecurringIncome['frequency']; interval_months: number;
      execution_day: number | null; start_date: string; end_date: string | null; next_date: string;
    }>("SELECT * FROM recurring_incomes WHERE active = 1 AND next_date IS NOT NULL");
    for (const rule of rules) {
      let nextDate: string | null = rule.next_date;
      for (let guard = 0; guard < 600 && nextDate; guard += 1) {
        const period = await transaction.getFirstAsync<{ id: number }>(
          'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1', nextDate, nextDate
        );
        if (!period) break;
        await transaction.runAsync(
          'INSERT INTO incomes (name, amount, period_id, date, recurring_income_id) VALUES (?, ?, ?, ?, ?)',
          rule.name, rule.amount, period.id, nextDate, rule.id
        );
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

export async function updateIncome(
  id:number,
  data: NewIncome
): Promise<void> {

  const db = await getDb();
  const income = await db.getFirstAsync<{ period_id: number }>(
    'SELECT period_id FROM incomes WHERE id = ?',
    id
  );
  if (!income) throw new Error('El ingreso ya no existe');
  await assertDateBelongsToPeriod(db, income.period_id, data.date);

  await db.runAsync(
    `
    UPDATE incomes
    SET
      name = ?,
      amount = ?,
      date = ?
    WHERE id = ?
    `,
    data.name.trim(),
    data.amount,
    data.date,
    id
  );
}

export async function deleteIncome(
  id:number
): Promise<void> {
  const db = await getDb();

  await db.runAsync(
    `
    DELETE FROM incomes
    WHERE id = ?
    `,
    id
  );
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
      'Sin categoría' as categoryName,
      '#95a5a6' as categoryColor,
      NULL as periodLimit,
      COALESCE(SUM(e.amount), 0) as total
    FROM filtered_expenses e
    WHERE e.category_id IS NULL

    ORDER BY total DESC, categoryName ASC
    `,
    periodId
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
    throw new Error('No existe un período actual');
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
      'La fecha inicial no puede ser mayor'
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
      'La fecha final no puede ser menor'
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

export async function closeCurrentPeriod(): Promise<Period> {
  const db = await getDb();

  const settings = await getSettings();

  if (!settings.currentPeriod) {
    throw new Error('No existe un período actual');
  }

  const current = settings.currentPeriod;

  const currentEnd = new Date(current.endDate);

  const nextStart = new Date(currentEnd);
  nextStart.setDate(nextStart.getDate() + 1);

  const nextEnd = new Date(nextStart);
  nextEnd.setMonth(nextEnd.getMonth() + 1);

  const nextStartStr =
    nextStart.toISOString().split('T')[0];

  const nextEndStr =
    nextEnd.toISOString().split('T')[0];

  const result = await db.runAsync(
    `
    INSERT INTO periods (
      start_date,
      end_date
    )
    VALUES (?, ?)
    `,
    nextStartStr,
    nextEndStr
  );

  const newPeriodId = result.lastInsertRowId;

  await db.runAsync(
    `
    UPDATE settings
    SET current_period_id = ?
    WHERE id = 1
    `,
    newPeriodId
  );

  return {
    id: newPeriodId,
    startDate: nextStartStr,
    endDate: nextEndStr,
  };
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
  }[] = await db.getAllAsync(`
    SELECT id, period_id, amount
    FROM incomes
  `);

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
  for (const inc of incomes) {
    incomesByPeriod.set(
      inc.period_id,
      (incomesByPeriod.get(inc.period_id) ?? 0) + inc.amount
    );
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
            categoryName: 'Sin categoría',
            categoryColor: '#95a5a6',
            periodLimit: null,
            total,
          };
        }
        const cat = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          categoryName: cat ? cat.name : "Sin nombre",
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
          paymentMethodName: method?.name ?? 'No especificado',
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
      incomesTotal: incomesTotal
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
        c.name AS categoryName,
        c.color AS categoryColor,
        pm.name AS paymentMethodName,
        pm.type AS paymentMethodType,
        pm.color AS paymentMethodColor
      FROM expenses e
      LEFT JOIN categories c ON c.id = e.category_id
      LEFT JOIN payment_methods pm ON pm.id = e.payment_method_id
      WHERE e.period_id = ?
      ORDER BY e.date ASC, e.id ASC
      `,
      periodId
    ),
    db.getAllAsync<Income>(
      `
      SELECT
        id,
        name,
        amount,
        period_id AS periodId,
        date
      FROM incomes
      WHERE period_id = ?
      ORDER BY date ASC, id ASC
      `,
      periodId
    ),
  ]);

  return { expenses, incomes };
}

/**
 * Closes the cached SQLite connection. Used by the restore workflow before
 * replacing the database file.
 */
export async function closeDatabase(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  await db.closeAsync();
  dbPromise = null;
}

/**
 * Drops the cached connection without touching the database file.
 * The next database access will open it again.
 */
export function resetDatabaseConnection(): void {
  dbPromise = null;
}
