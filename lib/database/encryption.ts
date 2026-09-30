import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import {
  DATABASE_APPLICATION_ID,
  DATABASE_NAME,
  hasValidSQLiteHeader,
} from '@/lib/database-schema';
import { t } from '@/lib/i18n';

const DATABASE_KEY_STORAGE = 'finniapp-local-database-key-v1';
const ENCRYPTED_MIGRATION_NAME = `${DATABASE_NAME}.encrypted-migration`;
const PLAINTEXT_ROLLBACK_NAME = `${DATABASE_NAME}.plaintext-rollback`;
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

let encryptionPreparation: Promise<string> | null = null;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function databasePath(name: string, directory: string): string {
  return `${directory.replace(/[\\/]$/, '')}/${name}`;
}

function databaseFile(name: string, directory: string): File {
  const path = databasePath(name, directory);
  return new File(path.startsWith('file://') ? path : `file://${path}`);
}

export function databaseKeyPragma(key: string): string {
  if (!HEX_KEY_PATTERN.test(key)) throw new Error(t('errors.localEncryptionKeyInvalid'));
  return `PRAGMA key = "x'${key.toLowerCase()}'"`;
}

async function loadOrCreateDatabaseKey(): Promise<{ key: string; created: boolean }> {
  const stored = await SecureStore.getItemAsync(DATABASE_KEY_STORAGE);
  if (stored) {
    if (!HEX_KEY_PATTERN.test(stored)) throw new Error(t('errors.localEncryptionKeyInvalid'));
    return { key: stored.toLowerCase(), created: false };
  }
  const key = bytesToHex(await Crypto.getRandomBytesAsync(32));
  // Persist before replacing a plaintext database. A crash may leave the old
  // file in place, but never an encrypted file without its key.
  await SecureStore.setItemAsync(DATABASE_KEY_STORAGE, key);
  return { key, created: true };
}

export async function applyDatabaseEncryptionKey(
  database: SQLite.SQLiteDatabase,
  key: string
): Promise<void> {
  await database.execAsync(databaseKeyPragma(key));
  const cipher = await database.getFirstAsync<{ cipher_version: string }>('PRAGMA cipher_version');
  if (!cipher?.cipher_version) throw new Error(t('errors.localEncryptionUnavailable'));
}

async function validateEncryptedDatabase(
  name: string,
  directory: string,
  key: string
): Promise<void> {
  const database = await SQLite.openDatabaseAsync(name, {}, directory);
  try {
    await applyDatabaseEncryptionKey(database, key);
    await database.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    const integrity = await database.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check');
    if (integrity?.integrity_check !== 'ok') throw new Error(t('errors.localEncryptionMigrationFailed'));
    const application = await database.getFirstAsync<{ application_id: number }>('PRAGMA application_id');
    if (application?.application_id !== DATABASE_APPLICATION_ID) {
      throw new Error(t('errors.localEncryptionMigrationFailed'));
    }
  } finally {
    await database.closeAsync();
  }
}

async function exportDatabaseWithKey(
  source: SQLite.SQLiteDatabase,
  name: string,
  directory: string,
  key: string
): Promise<void> {
  const target = databaseFile(name, directory);
  if (target.exists) target.delete();

  const schema = await source.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const application = await source.getFirstAsync<{ application_id: number }>('PRAGMA application_id');
  const sourceObjects = await source.getFirstAsync<{ count: number }>(
    'SELECT count(*) AS count FROM sqlite_master'
  );
  let attached = false;
  try {
    await source.execAsync(
      `ATTACH DATABASE ${sqlString(databasePath(name, directory))} AS encrypted_export KEY "x'${key}'"`
    );
    attached = true;
    await source.getFirstAsync("SELECT sqlcipher_export('encrypted_export')");
    await source.execAsync(
      `PRAGMA encrypted_export.user_version = ${Number(schema?.user_version ?? 0)}`
    );
    await source.execAsync(
      `PRAGMA encrypted_export.application_id = ${Number(application?.application_id ?? 0)}`
    );
    const exportedObjects = await source.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM encrypted_export.sqlite_master'
    );
    if (Number(exportedObjects?.count ?? -1) !== Number(sourceObjects?.count ?? 0)) {
      throw new Error(t('errors.localEncryptionMigrationFailed'));
    }
    await source.execAsync('DETACH DATABASE encrypted_export');
    attached = false;
    await validateEncryptedDatabase(name, directory, key);
  } catch (error) {
    if (attached) {
      await source.execAsync('DETACH DATABASE encrypted_export').catch(() => undefined);
    }
    if (target.exists) target.delete();
    throw error;
  }
}

export async function exportEncryptedDatabaseCopy(
  source: SQLite.SQLiteDatabase,
  name: string,
  directory = SQLite.defaultDatabaseDirectory
): Promise<void> {
  const key = await prepareDatabaseEncryption();
  await exportDatabaseWithKey(source, name, directory, key);
}

async function migratePlaintextDatabase(
  activeFile: File,
  directory: string,
  key: string
): Promise<void> {
  const encryptedTarget = databaseFile(ENCRYPTED_MIGRATION_NAME, directory);
  const rollback = databaseFile(PLAINTEXT_ROLLBACK_NAME, directory);
  if (encryptedTarget.exists) encryptedTarget.delete();

  // SQLCipher 4.7 rejects an empty PRAGMA key on a plaintext main database.
  // Create and key the encrypted target first, then attach the legacy file
  // explicitly with KEY '' and export from that attached plaintext schema.
  const target = await SQLite.openDatabaseAsync(ENCRYPTED_MIGRATION_NAME, {}, directory);
  try {
    await applyDatabaseEncryptionKey(target, key);
    await target.execAsync(
      `ATTACH DATABASE ${sqlString(databasePath(DATABASE_NAME, directory))} AS plaintext KEY ''`
    );
    const schema = await target.getFirstAsync<{ user_version: number }>(
      'PRAGMA plaintext.user_version'
    );
    const application = await target.getFirstAsync<{ application_id: number }>(
      'PRAGMA plaintext.application_id'
    );
    const objects = await target.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM plaintext.sqlite_master'
    );
    await target.getFirstAsync("SELECT sqlcipher_export('main', 'plaintext')");
    await target.execAsync(`PRAGMA main.user_version = ${Number(schema?.user_version ?? 0)}`);
    await target.execAsync(
      `PRAGMA main.application_id = ${Number(application?.application_id ?? DATABASE_APPLICATION_ID)}`
    );
    const exportedObjects = await target.getFirstAsync<{ count: number }>(
      'SELECT count(*) AS count FROM main.sqlite_master'
    );
    if (Number(exportedObjects?.count ?? -1) !== Number(objects?.count ?? 0)) {
      throw new Error(t('errors.localEncryptionMigrationFailed'));
    }
    await target.execAsync('DETACH DATABASE plaintext');
    const exportedSchema = await target.getFirstAsync<{ user_version: number }>(
      'PRAGMA main.user_version'
    );
    if (Number(exportedSchema?.user_version ?? -1) !== Number(schema?.user_version ?? 0)) {
      throw new Error(t('errors.localEncryptionMigrationFailed'));
    }
  } catch (error) {
    if (encryptedTarget.exists) encryptedTarget.delete();
    throw error;
  } finally {
    await target.closeAsync();
  }

  await validateEncryptedDatabase(ENCRYPTED_MIGRATION_NAME, directory, key);
  if (rollback.exists) rollback.delete();

  activeFile.move(rollback);
  try {
    encryptedTarget.move(databaseFile(DATABASE_NAME, directory));
    await validateEncryptedDatabase(DATABASE_NAME, directory, key);
    if (rollback.exists) rollback.delete();
  } catch (error) {
    const replacement = databaseFile(DATABASE_NAME, directory);
    if (replacement.exists) replacement.delete();
    if (rollback.exists) rollback.move(replacement);
    throw error;
  } finally {
    // File.move mutates the File instance URI to its destination. Resolve the
    // temporary path again so cleanup can never delete the active database.
    const leftoverTarget = databaseFile(ENCRYPTED_MIGRATION_NAME, directory);
    if (leftoverTarget.exists) leftoverTarget.delete();
  }
}

async function prepareDatabaseEncryptionInternal(): Promise<string> {
  const directory = SQLite.defaultDatabaseDirectory;
  const activeFile = databaseFile(DATABASE_NAME, directory);
  const rollback = databaseFile(PLAINTEXT_ROLLBACK_NAME, directory);

  // Recover the only crash window where the original was renamed but the
  // encrypted replacement had not yet reached its final path.
  if (!activeFile.exists && rollback.exists) rollback.move(activeFile);

  const { key, created } = await loadOrCreateDatabaseKey();
  if (!activeFile.exists || activeFile.size === 0) return key;

  const bytes = await activeFile.bytes();
  const plaintext = hasValidSQLiteHeader(bytes);
  bytes.fill(0);
  if (plaintext) {
    await migratePlaintextDatabase(activeFile, directory, key);
  } else if (created) {
    throw new Error(t('errors.localEncryptionKeyMissing'));
  }
  return key;
}

export function prepareDatabaseEncryption(): Promise<string> {
  if (!encryptionPreparation) {
    encryptionPreparation = prepareDatabaseEncryptionInternal().catch((error) => {
      encryptionPreparation = null;
      throw error;
    });
  }
  return encryptionPreparation;
}

export async function openEncryptedDatabaseAsync(
  name: string,
  directory = SQLite.defaultDatabaseDirectory
): Promise<SQLite.SQLiteDatabase> {
  const key = await prepareDatabaseEncryption();
  const database = await SQLite.openDatabaseAsync(name, {}, directory);
  try {
    await applyDatabaseEncryptionKey(database, key);
    // Force SQLCipher to read the first page before returning a connection.
    // PRAGMA cipher_version alone does not prove that the supplied key can
    // decrypt this particular database.
    await database.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
    return database;
  } catch (error) {
    await database.closeAsync();
    throw error;
  }
}

export function resetDatabaseEncryptionPreparation(): void {
  encryptionPreparation = null;
}
