import * as SQLite from 'expo-sqlite';

import type { Category, ExpenseWithCategory, Income, NewCategory, NewExpense, NewIncome, NewPeriod, Period, PeriodCategoryExpensesTotals, PeriodHistory, Settings } from './types';

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

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period ON expenses(period_id);
    CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
    CREATE INDEX IF NOT EXISTS idx_incomes_period ON incomes(period_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period_category ON expenses(period_id, category_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_period_date ON expenses(period_id, date);

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

export async function deleteCategory(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM categories WHERE id = ?', id);
}

export async function getExpenses(): Promise<ExpenseWithCategory[]> {

  const periodId =
    await getCurrentPeriodId();

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

        c.name AS categoryName,
        c.color AS categoryColor

      FROM expenses e

      LEFT JOIN categories c
        ON c.id = e.category_id

      WHERE e.period_id = ?

      ORDER BY
        e.date DESC,
        e.id DESC
      `,
      periodId
    );

  return rows as ExpenseWithCategory[];
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

export async function createExpense(
  data: NewExpense
): Promise<void> {
  const periodId =
    await getCurrentPeriodId();

  const db = await getDb();

  await db.runAsync(
    `
    INSERT INTO expenses (
      name,
      amount,
      category_id,
      period_id,
      date,
      original_amount,
      split_percentage
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    data.name.trim(),
    data.amount,
    data.categoryId,
    periodId,
    data.date,
    data.originalAmount,
    data.splitPercentage
  );
}

export async function updateExpense(
  id: number,
  data: NewExpense
): Promise<void> {

  const currentPeriodId =
    await getCurrentPeriodId();

  const db = await getDb();

  const expense =
    await db.getFirstAsync<{
      period_id:number;
    }>(
      `
      SELECT period_id
      FROM expenses
      WHERE id = ?
      `,
      id
    );

  if (
    expense?.period_id !==
    currentPeriodId
  ) {
    throw new Error(
      'No se puede modificar un gasto de un período cerrado'
    );
  }

  await db.runAsync(
    `
    UPDATE expenses
    SET
      name = ?,
      amount = ?,
      category_id = ?,
      date = ?,
      original_amount = ?,
      split_percentage = ?
    WHERE id = ?
    `,
    data.name.trim(),
    data.amount,
    data.categoryId,
    data.date,
    data.originalAmount,
    data.splitPercentage,
    id
  );
}

export async function deleteExpense(
  id:number
): Promise<void> {

  const currentPeriodId =
    await getCurrentPeriodId();

  const db = await getDb();

  const expense =
    await db.getFirstAsync<{
      period_id:number;
    }>(
      `
      SELECT period_id
      FROM expenses
      WHERE id = ?
      `,
      id
    );

  if (
    expense?.period_id !==
    currentPeriodId
  ) {
    throw new Error(
      'No se puede eliminar un gasto de un período cerrado'
    );
  }

  await db.runAsync(
    `
    DELETE FROM expenses
    WHERE id = ?
    `,
    id
  );
}

export async function getIncomes(): Promise<Income[]> {
  const periodId = await getCurrentPeriodId();
  const db = await getDb();

  const rows = await db.getAllAsync(
    `
    SELECT
      id,
      name,
      amount,
      period_id AS periodId,
      date
    FROM incomes
    WHERE period_id = ?
    ORDER BY date DESC, id DESC
    `,
    periodId
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
  data: NewIncome
): Promise<void> {
  const periodId =
    await getCurrentPeriodId();

  const db = await getDb();

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
    periodId,
    data.date
  );
}

export async function updateIncome(
  id:number,
  data: NewIncome
): Promise<void> {

  const currentPeriodId =
    await getCurrentPeriodId();

  const db = await getDb();

  const income =
    await db.getFirstAsync<{
      period_id:number;
    }>(
      `
      SELECT period_id
      FROM incomes
      WHERE id = ?
      `,
      id
    );

  if (
    income?.period_id !==
    currentPeriodId
  ) {
    throw new Error(
      'No se puede modificar un ingreso de un período cerrado'
    );
  }

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

  const currentPeriodId =
    await getCurrentPeriodId();

  const db = await getDb();

  const income =
    await db.getFirstAsync<{
      period_id:number;
    }>(
      `
      SELECT period_id
      FROM incomes
      WHERE id = ?
      `,
      id
    );

  if (
    income?.period_id !==
    currentPeriodId
  ) {
    throw new Error(
      'No se puede eliminar un ingreso de un período cerrado'
    );
  }

  await db.runAsync(
    `
    DELETE FROM incomes
    WHERE id = ?
    `,
    id
  );
}

export async function getPeriodCategoryExpensesTotals(
  startDate: string,
  endDate: string
): Promise<PeriodCategoryExpensesTotals[]> {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `
    WITH filtered_expenses AS (
      SELECT category_id, amount
      FROM expenses
      WHERE date >= ? AND date <= ?
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
    startDate,
    endDate
  );
  return rows as PeriodCategoryExpensesTotals[];
}

export async function getPeriodIncomesTotal(
  startDate: string,
  endDate: string
): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `
    SELECT
      COALESCE(SUM(i.amount), 0) as total
    FROM incomes i
    WHERE i.date >= ? AND i.date <= ?
    `,
    startDate,
    endDate
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
    period_id: number | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `
    SELECT
      s.id,
      s.current_period_id,

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

    currentPeriod: row?.period_id
      ? {
          id: row.period_id,
          startDate: row.start_date!,
          endDate: row.end_date!,
        }
      : null,
  };
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
  }[] = await db.getAllAsync(`
    SELECT id, name, color
    FROM categories
  `);

  // Get all expenses (including null category_id allowed)
  const expenses: {
    id: number;
    period_id: number;
    category_id: number | null;
    amount: number;
  }[] = await db.getAllAsync(`
    SELECT id, period_id, category_id, amount
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
            total,
          };
        }
        const cat = categories.find(c => c.id === categoryId);
        return {
          categoryId,
          categoryName: cat ? cat.name : "Sin nombre",
          categoryColor: cat ? cat.color : "#CCC",
          total
        };
      }
    );

    // Sort categories by total descending (to match original order)
    thisCategories.sort((a, b) => b.total - a.total);

    // Fill incomesTotal for this period
    const incomesTotal = incomesByPeriod.get(period.id) ?? 0;

    return {
      periodId: period.id,
      startDate: period.start_date,
      endDate: period.end_date,
      year: new Date(period.start_date).getFullYear(),
      categories: thisCategories,
      incomesTotal: incomesTotal
    };
  });

  return result;
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
