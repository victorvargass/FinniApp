import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const databaseSource = readFileSync(new URL('../../lib/database/engine.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../../lib/database-schema.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../../lib/schema-migrations.ts', import.meta.url), 'utf8');

test('schema v32 expands audit history without losing previous trash records', () => {
  assert.match(schemaSource, /DATABASE_SCHEMA_VERSION = 32/);
  assert.match(registrySource, /version: 32, name: 'complete-financial-activity-history'/);

  const migration = databaseSource.match(/if \(previousSchemaVersion < 32\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.ok(migration, 'v32 migration must exist');
  const sql = migration.match(/await db\.execAsync\(`([\s\S]*?)`\);/)?.[1];
  assert.ok(sql, 'v32 migration SQL must exist');

  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      CREATE TABLE financial_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('expense', 'income')),
        entity_id INTEGER NOT NULL,
        action TEXT NOT NULL CHECK(action IN ('deleted', 'restored')),
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        event_date TEXT NOT NULL,
        event_time TEXT NOT NULL,
        snapshot_json TEXT,
        restorable INTEGER NOT NULL DEFAULT 0 CHECK(restorable IN (0, 1)),
        restriction_reason TEXT,
        restored_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX idx_financial_audit_created ON financial_audit_log(created_at DESC, id DESC);
      INSERT INTO financial_audit_log
        (entity_type, entity_id, action, title, amount, event_date, event_time, snapshot_json, restorable)
      VALUES ('expense', 7, 'deleted', 'Pan', 1200, '2026-10-09', '19:00', '{"id":7}', 1);
    `);
    database.exec(sql);
    const retained = database.prepare('SELECT entity_type, action, title, previous_snapshot_json FROM financial_audit_log').get();
    assert.deepEqual({ ...retained }, {
      entity_type: 'expense', action: 'deleted', title: 'Pan', previous_snapshot_json: null,
    });
    database.prepare(`INSERT INTO financial_audit_log
      (entity_type, entity_id, action, title, amount, event_date, event_time, snapshot_json, previous_snapshot_json)
      VALUES ('transfer', 8, 'updated', 'Banco A → Banco B', 5000, '2026-10-09', '19:01', '{}', '{}')`).run();
    assert.equal(database.prepare('SELECT COUNT(*) count FROM financial_audit_log').get().count, 2);
  } finally {
    database.close();
  }
});

