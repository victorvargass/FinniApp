import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/db.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');

test('schema v28 stores optional Home layout preferences without changing existing settings', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = 28/);
  assert.match(registrySource, /version: 28, name: 'home-layout-preferences'/);
  const migrationStart = databaseSource.indexOf('if (previousSchemaVersion < 28)');
  const migration = databaseSource.slice(
    migrationStart,
    databaseSource.indexOf('const expenseColumns', migrationStart)
  );
  assert.match(migration, /ensureColumn\(db, 'settings', 'home_preferences', 'TEXT'\)/);

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE settings (id INTEGER PRIMARY KEY, current_period_id INTEGER);
      INSERT INTO settings VALUES (1, 7);
      ALTER TABLE settings ADD COLUMN home_preferences TEXT;
    `);
    const row = database.prepare('SELECT current_period_id, home_preferences FROM settings WHERE id = 1').get();
    assert.deepEqual({ ...row }, { current_period_id: 7, home_preferences: null });
  } finally {
    database.close();
  }
});
