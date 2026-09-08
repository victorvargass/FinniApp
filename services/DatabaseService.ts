import * as SQLite from 'expo-sqlite';
import { Directory, File, Paths } from 'expo-file-system';

import {
  closeDatabase,
  getDatabase,
  initDatabase,
  resetDatabaseConnection,
} from '@/lib/db';
import { withDatabaseLock } from '@/lib/database-lock';
import {
  DATABASE_APPLICATION_ID,
  DATABASE_NAME,
  DATABASE_SCHEMA_VERSION,
  hasValidSQLiteHeader,
  MAX_BACKUP_SIZE_BYTES,
  REQUIRED_BACKUP_TABLES,
} from '@/lib/database-schema';
import { t } from '@/lib/i18n';

export class DatabaseService {
  /**
   * Creates a consistent point-in-time SQLite copy without relying on the
   * physical WAL files. serializeAsync includes the current database state.
   */
  static async createBackupFile(): Promise<File> {
    const bytes = await withDatabaseLock(async () => {
      const db = await getDatabase();
      return db.serializeAsync('main');
    });

    const backup = new File(
      Paths.cache,
      `gastos-backup-${Date.now()}.db`
    );

    backup.write(bytes);
    return backup;
  }

  /**
   * Validates the downloaded SQLite file before it can replace the user's
   * current database.
   */
  static async validateBackupFile(file: File): Promise<void> {
    const bytes = await file.bytes();
    if (bytes.length < 100) {
      throw new Error(t('errors.emptyBackup'));
    }
    if (bytes.length > MAX_BACKUP_SIZE_BYTES) {
      throw new Error(t('errors.invalidBackupVersion'));
    }

    if (!hasValidSQLiteHeader(bytes)) {
      throw new Error(t('errors.invalidBackupIntegrity'));
    }

    const tempDirectory = new Directory(
      Paths.cache,
      `restore-${Date.now()}`
    );
    tempDirectory.create({ idempotent: true, intermediates: true });

    const tempName = 'candidate.db';
    const candidateFile = new File(tempDirectory, tempName);
    candidateFile.write(bytes);

    const candidate = await SQLite.openDatabaseAsync(
      tempName,
      {},
      tempDirectory.uri
    );

    try {
      const integrity = await candidate.getFirstAsync<{ integrity_check: string }>(
        'PRAGMA integrity_check'
      );

      if (integrity?.integrity_check !== 'ok') {
        throw new Error(t('errors.invalidBackupIntegrity'));
      }

      const tables = await candidate.getAllAsync<{ name: string }>(
        `SELECT name FROM sqlite_master
         WHERE type = 'table' AND name IN ('settings', 'periods', 'categories', 'expenses', 'incomes')`
      );

      const found = new Set(tables.map((table) => table.name));
      if (REQUIRED_BACKUP_TABLES.some((table) => !found.has(table))) {
        throw new Error(t('errors.invalidBackupVersion'));
      }

      const foreignKeyErrors = await candidate.getAllAsync('PRAGMA foreign_key_check');
      if (foreignKeyErrors.length > 0) {
        throw new Error(t('errors.invalidBackupIntegrity'));
      }

      const version = await candidate.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) > DATABASE_SCHEMA_VERSION) {
        throw new Error(t('errors.invalidBackupVersion'));
      }

      const application = await candidate.getFirstAsync<{ application_id: number }>('PRAGMA application_id');
      if (application?.application_id !== 0 && application?.application_id !== DATABASE_APPLICATION_ID) {
        throw new Error(t('errors.invalidBackupVersion'));
      }
    } finally {
      await candidate.closeAsync();
      candidateFile.delete();
      tempDirectory.delete();
    }
  }

  /**
   * Replaces the current database using SQLite's native backup API rather
   * than copying an open database file directly.
   */
  static async restoreFromFile(file: File): Promise<void> {
    await this.validateBackupFile(file);

    const bytes = await file.bytes();
    const tempDirectory = new Directory(
      Paths.cache,
      `restore-${Date.now()}`
    );
    tempDirectory.create({ idempotent: true, intermediates: true });

    const sourceName = 'restore-source.db';
    const rollbackName = 'rollback.db';

    const sourceFile = new File(tempDirectory, sourceName);
    sourceFile.write(bytes);

    const source = await SQLite.openDatabaseAsync(
      sourceName,
      {},
      tempDirectory.uri
    );

    await withDatabaseLock(async () => {
      let rollback: SQLite.SQLiteDatabase | null = null;
      let destination: SQLite.SQLiteDatabase | null = null;
      try {
      // Keep a local rollback copy so a failed restore does not leave the
      // application without its previous database.
      const current = await getDatabase();

      rollback = await SQLite.openDatabaseAsync(
        rollbackName,
        {},
        tempDirectory.uri
      );

      await SQLite.backupDatabaseAsync({
        sourceDatabase: current,
        sourceDatabaseName: 'main',
        destDatabase: rollback,
        destDatabaseName: 'main',
      });

      await closeDatabase();
      await SQLite.deleteDatabaseAsync(
        DATABASE_NAME,
        SQLite.defaultDatabaseDirectory
      );

      destination = await SQLite.openDatabaseAsync(
        DATABASE_NAME,
        {},
        SQLite.defaultDatabaseDirectory
      );

      try {
        await SQLite.backupDatabaseAsync({
          sourceDatabase: source,
          sourceDatabaseName: 'main',
          destDatabase: destination,
          destDatabaseName: 'main',
        });
        await destination.execAsync('PRAGMA foreign_keys = ON');
      } catch (restoreError) {
        await destination.closeAsync();
        destination = null;

        await SQLite.deleteDatabaseAsync(
          DATABASE_NAME,
          SQLite.defaultDatabaseDirectory
        );

        const recovered = await SQLite.openDatabaseAsync(
          DATABASE_NAME,
          {},
          SQLite.defaultDatabaseDirectory
        );

        try {
          await SQLite.backupDatabaseAsync({
            sourceDatabase: rollback,
            sourceDatabaseName: 'main',
            destDatabase: recovered,
            destDatabaseName: 'main',
          });
          await recovered.execAsync('PRAGMA foreign_keys = ON');
        } finally {
          await recovered.closeAsync();
        }

        throw restoreError;
      }
      } finally {
        await source.closeAsync();
        if (rollback) await rollback.closeAsync();
        if (destination) await destination.closeAsync();
        sourceFile.delete();
        tempDirectory.delete();
        resetDatabaseConnection();
      }
    });

    // Apply additive migrations when restoring a backup created by an older
    // app version before the UI starts querying the restored database.
    await initDatabase();
  }

}
