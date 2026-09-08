import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

import {
  DATABASE_APPLICATION_ID,
  DATABASE_SCHEMA_VERSION,
  hasValidSQLiteHeader,
  REQUIRED_BACKUP_TABLES,
} from '../lib/database-schema.ts';

function inspectBackup(database) {
  const integrity = database.prepare('PRAGMA integrity_check').get().integrity_check;
  const version = database.prepare('PRAGMA user_version').get().user_version;
  const applicationId = database.prepare('PRAGMA application_id').get().application_id;
  const found = new Set(
    database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name)
  );
  return {
    integrity,
    version,
    applicationId,
    missing: REQUIRED_BACKUP_TABLES.filter((table) => !found.has(table)),
  };
}

test('recognizes a compatible legacy backup and its required tables', () => {
  const database = new DatabaseSync(':memory:');
  try {
    for (const table of REQUIRED_BACKUP_TABLES) database.exec(`CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`);
    const result = inspectBackup(database);
    assert.equal(result.integrity, 'ok');
    assert.equal(result.version, 0);
    assert.equal(result.applicationId, 0);
    assert.deepEqual(result.missing, []);
  } finally {
    database.close();
  }
});

test('detects backups from a newer schema or another application', () => {
  const database = new DatabaseSync(':memory:');
  try {
    database.exec(`
      PRAGMA user_version = ${DATABASE_SCHEMA_VERSION + 1};
      PRAGMA application_id = ${DATABASE_APPLICATION_ID + 1};
    `);
    const result = inspectBackup(database);
    assert.ok(result.version > DATABASE_SCHEMA_VERSION);
    assert.notEqual(result.applicationId, DATABASE_APPLICATION_ID);
    assert.ok(result.missing.length > 0);
  } finally {
    database.close();
  }
});

test('a corrupt payload is rejected before SQLite opens it', () => {
  assert.equal(hasValidSQLiteHeader(Buffer.from('not-a-sqlite-backup')), false);
  assert.equal(hasValidSQLiteHeader(Buffer.from('SQLite format 3\u0000rest')), true);
});
