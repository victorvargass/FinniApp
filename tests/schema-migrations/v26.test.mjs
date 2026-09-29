import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const databaseSource = readFileSync(new URL('../../lib/db.ts', import.meta.url), 'utf8');
test('schema v26 seeds debt payment categories for expenses and incomes', () => {
  const migration = databaseSource.slice(
    databaseSource.indexOf('if (previousSchemaVersion < 26)'),
    databaseSource.indexOf('await repairRecoverableDatabaseRelations(db)')
  );

  assert.match(migration, /defaultCategories\.debtPayment/);
  assert.match(migration, /INSERT INTO categories/);
  assert.match(migration, /INSERT OR IGNORE INTO income_categories/);
  assert.match(migration, /findAvailableCategoryColor/);
});
