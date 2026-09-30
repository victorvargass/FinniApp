import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase, withExclusiveDatabaseTransaction } from '@/lib/database/connection';
import { t } from '@/lib/i18n';
import type { Category, IncomeCategory, NewCategory, NewIncomeCategory } from '@/lib/types';

const RESERVED_COLORS = ['#008000'];
const normalizeColor = (color: string) => color.trim().toLowerCase();

async function assertUniqueCategoryFields(
  database: SQLiteDatabase,
  data: NewCategory,
  excludeId?: number
): Promise<void> {
  const color = normalizeColor(data.color);
  if (RESERVED_COLORS.includes(color)) throw new Error(t('database.reservedIncomeColor'));
  const duplicateName = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE name = ? AND id != ?', data.name.trim(), excludeId ?? -1
  );
  if (duplicateName) throw new Error(t('database.categoryNameExists'));
  const duplicateColor = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM categories WHERE color = ? AND id != ?', color, excludeId ?? -1
  );
  if (duplicateColor) throw new Error(t('database.categoryColorExists'));
}

function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: Number(row.id),
    name: String(row.name),
    color: String(row.color),
    periodLimit: row.period_limit == null ? null : Number(row.period_limit),
    purpose: row.purpose === 'savings' ? 'savings' : 'general',
    systemKey: row.system_key === 'savings' || row.system_key === 'credit_payment'
      ? row.system_key : null,
  };
}

export async function getCategories(): Promise<Category[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<Record<string, unknown>>(
    'SELECT * FROM categories ORDER BY name ASC'
  );
  return rows.map(mapCategory);
}

export async function getIncomeCategories(): Promise<IncomeCategory[]> {
  const database = await getDatabase();
  return database.getAllAsync<IncomeCategory>(
    'SELECT id, name, color FROM income_categories ORDER BY name COLLATE NOCASE'
  );
}

export async function saveIncomeCategory(data: NewIncomeCategory, id?: number): Promise<void> {
  const database = await getDatabase();
  const name = data.name.trim();
  const color = data.color.toLowerCase();
  if (!name) throw new Error(t('categories.missingName'));
  const duplicate = await database.getFirstAsync<{ id: number }>(
    'SELECT id FROM income_categories WHERE name = ? COLLATE NOCASE AND id != ? LIMIT 1',
    name, id ?? -1
  );
  if (duplicate) throw new Error(t('database.categoryNameExists'));
  if (id == null) {
    await database.runAsync('INSERT INTO income_categories (name, color) VALUES (?, ?)', name, color);
  } else {
    await database.runAsync(
      'UPDATE income_categories SET name = ?, color = ? WHERE id = ?', name, color, id
    );
  }
}

export async function deleteIncomeCategory(id: number): Promise<void> {
  const database = await getDatabase();
  await withExclusiveDatabaseTransaction(database, async (transaction) => {
    await transaction.runAsync('UPDATE incomes SET category_id = NULL WHERE category_id = ?', id);
    await transaction.runAsync('UPDATE recurring_incomes SET category_id = NULL WHERE category_id = ?', id);
    await transaction.runAsync('DELETE FROM income_categories WHERE id = ?', id);
  });
}

export async function createCategory(data: NewCategory): Promise<Category> {
  const database = await getDatabase();
  const normalized = {
    name: data.name.trim(), color: data.color.toLowerCase(), periodLimit: data.periodLimit,
    purpose: data.purpose ?? 'general', systemKey: data.systemKey ?? null,
  };
  await assertUniqueCategoryFields(database, normalized);
  const result = await database.runAsync(
    'INSERT INTO categories (name, color, period_limit, purpose, system_key) VALUES (?, ?, ?, ?, ?)',
    normalized.name, normalized.color, normalized.periodLimit, normalized.purpose, normalized.systemKey
  );
  return { id: result.lastInsertRowId, ...normalized };
}

export async function updateCategory(id: number, data: NewCategory): Promise<void> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{
    name: string; purpose: Category['purpose']; system_key: Category['systemKey'];
  }>('SELECT name, purpose, system_key FROM categories WHERE id = ?', id);
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
  await assertUniqueCategoryFields(database, normalized, id);
  await database.runAsync(
    `UPDATE categories SET name = ?, color = ?, period_limit = ?, purpose = COALESCE(?, purpose)
     WHERE id = ?`,
    normalized.name, normalized.color, normalized.periodLimit, normalized.purpose ?? null, id
  );
}

export async function deleteCategory(id: number, detachExpenses = false): Promise<void> {
  const database = await getDatabase();
  const category = await database.getFirstAsync<{ purpose: string; system_key: string | null }>(
    'SELECT purpose, system_key FROM categories WHERE id = ?', id
  );
  if (category?.purpose === 'savings' || category?.system_key != null) {
    throw new Error(t('database.protectedCategoryRequired'));
  }
  if (!detachExpenses) {
    await database.runAsync('DELETE FROM categories WHERE id = ?', id);
    return;
  }
  await withExclusiveDatabaseTransaction(database, async (transaction) => {
    await transaction.runAsync('UPDATE expenses SET category_id = NULL WHERE category_id = ?', id);
    await transaction.runAsync('DELETE FROM categories WHERE id = ?', id);
  });
}

export async function getExpenseCountByCategory(categoryId: number): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM expenses WHERE category_id = ?', categoryId
  );
  return row?.count ?? 0;
}
