import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const encryption = readFileSync(
  new URL('../lib/database/encryption.ts', import.meta.url),
  'utf8'
);
const connection = readFileSync(
  new URL('../lib/database/connection.ts', import.meta.url),
  'utf8'
);
const database = readFileSync(new URL('../lib/database/engine.ts', import.meta.url), 'utf8');
const appConfig = readFileSync(new URL('../app.config.js', import.meta.url), 'utf8');
const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
const provider = readFileSync(
  new URL('../contexts/DatabaseContext.tsx', import.meta.url),
  'utf8'
);
const errorScreen = readFileSync(
  new URL('../components/database-initialization-error.tsx', import.meta.url),
  'utf8'
);

test('native builds enable SQLCipher and prevent Android database backup', () => {
  assert.match(appConfig, /useSQLCipher:\s*true/);
  assert.equal(appJson.expo.android.allowBackup, false);
});

test('local database key is random, device-protected, and applied before reads', () => {
  assert.match(encryption, /Crypto\.getRandomBytesAsync\(32\)/);
  assert.match(encryption, /SecureStore\.setItemAsync\(DATABASE_KEY_STORAGE, key\)/);
  assert.match(encryption, /PRAGMA key = "x'/);
  assert.match(encryption, /SELECT count\(\*\) AS count FROM sqlite_master/);
  assert.match(connection, /openEncryptedDatabaseAsync\(DATABASE_NAME\)/);
  assert.doesNotMatch(connection, /journal_mode = WAL/);
});

test('plaintext migration validates content and never cleans the moved active file', () => {
  assert.match(encryption, /ATTACH DATABASE[\s\S]*AS plaintext KEY ''/);
  assert.match(encryption, /getFirstAsync\("SELECT sqlcipher_export\('main', 'plaintext'\)"\)/);
  assert.match(encryption, /exportedObjects[\s\S]*objects/);
  assert.match(encryption, /validateEncryptedDatabase\(DATABASE_NAME/);
  assert.match(encryption, /const leftoverTarget = databaseFile\(ENCRYPTED_MIGRATION_NAME, directory\)/);
});

test('migration snapshots remain encrypted and initialization failures are recoverable', () => {
  assert.match(database, /exportEncryptedDatabaseCopy\(db, backupName, directory\.uri\)/);
  assert.match(provider, /DatabaseInitializationError/);
  assert.match(provider, /onRetry=\{initializeDatabase\}/);
  assert.doesNotMatch(provider, /error\.message/);
  assert.doesNotMatch(errorScreen, /message:\s*string/);
});
