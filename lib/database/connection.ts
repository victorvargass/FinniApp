import * as SQLite from 'expo-sqlite';

import { withDatabaseLock } from '@/lib/database-lock';
import { DATABASE_NAME } from '@/lib/database-schema';

const DATABASE_BUSY_TIMEOUT_MS = 5000;

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync(DATABASE_NAME).then(async (database) => {
      await database.execAsync(`
        PRAGMA journal_mode = WAL;
        PRAGMA busy_timeout = ${DATABASE_BUSY_TIMEOUT_MS};
        PRAGMA foreign_keys = ON;
      `);
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
  await withDatabaseLock(async () => {
    await database.withExclusiveTransactionAsync(async (transaction) => {
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
}
