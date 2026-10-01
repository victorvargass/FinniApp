import * as SQLite from 'expo-sqlite';

import { withDatabaseLock } from '@/lib/database-lock';
import { DATABASE_NAME } from '@/lib/database-schema';
import {
  applyDatabaseEncryptionKey,
  openEncryptedDatabaseAsync,
  prepareDatabaseEncryption,
  resetDatabaseEncryptionPreparation,
} from '@/lib/database/encryption';

const DATABASE_BUSY_TIMEOUT_MS = 5000;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = openEncryptedDatabaseAsync(DATABASE_NAME).then(async (database) => {
      // SQLCipher keeps the database header encrypted. DELETE journaling avoids
      // plaintext-header/WAL compatibility requirements and all writes are
      // already serialized by the database lock below.
      await database.execAsync('PRAGMA journal_mode = DELETE');
      await database.execAsync(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
      await database.execAsync('PRAGMA foreign_keys = ON');
      await database.getFirstAsync('SELECT count(*) AS count FROM sqlite_master');
      return database;
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export async function withExclusiveDatabaseTransaction(
  database: SQLite.SQLiteDatabase,
  task: (transaction: SQLite.SQLiteDatabase) => Promise<void>
): Promise<void> {
  const key = await prepareDatabaseEncryption();
  await withDatabaseLock(async () => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
      // Expo creates a dedicated connection for an exclusive transaction.
      // SQLCipher keys are connection-local, so key it before the first read.
      await applyDatabaseEncryptionKey(transaction, key);
      await transaction.execAsync(`PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS}`);
      await task(transaction);
    });
  });
}

export async function closeDatabaseConnection(): Promise<void> {
  if (!databasePromise) return;
  const database = await databasePromise;
  await database.closeAsync();
  databasePromise = null;
}

export function resetDatabaseConnectionCache(): void {
  databasePromise = null;
  resetDatabaseEncryptionPreparation();
}
