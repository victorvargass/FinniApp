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
import { attachDiagnosticMetadata } from '@/lib/logger';

export class DatabaseService {
  static async getBackupDiagnosticMetadata(file: File): Promise<{
    backupSizeBytes: number;
    backupSchemaVersion: number | null;
    expectedSchemaVersion: number;
  }> {
    const bytes = await file.bytes();
    let backupSchemaVersion: number | null = null;
    if (hasValidSQLiteHeader(bytes)) {
      try {
        const candidate = await SQLite.deserializeDatabaseAsync(bytes);
        try {
          const version = await candidate.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
          backupSchemaVersion = version?.user_version ?? 0;
        } finally {
          await candidate.closeAsync();
        }
      } catch {
        // A corrupt backup may not open; its size is still useful and safe.
      }
    }
    return {
      backupSizeBytes: bytes.length,
      backupSchemaVersion,
      expectedSchemaVersion: DATABASE_SCHEMA_VERSION,
    };
  }

  private static async replaceDatabaseFrom(
    source: SQLite.SQLiteDatabase
  ): Promise<void> {
    await closeDatabase();
    await SQLite.deleteDatabaseAsync(
      DATABASE_NAME,
      SQLite.defaultDatabaseDirectory
    );

    let destination: SQLite.SQLiteDatabase | null = null;
    try {
      destination = await SQLite.openDatabaseAsync(
        DATABASE_NAME,
        {},
        SQLite.defaultDatabaseDirectory
      );
      await SQLite.backupDatabaseAsync({
        sourceDatabase: source,
        sourceDatabaseName: 'main',
        destDatabase: destination,
        destDatabaseName: 'main',
      });
    } finally {
      if (destination) await destination.closeAsync();
      resetDatabaseConnection();
    }
  }

  /**
   * Creates a consistent point-in-time SQLite copy using the native backup
   * API. The destination is changed back to the standalone DELETE journal
   * mode so the uploaded file never depends on sidecar WAL files.
   */
  static async createBackupFile(): Promise<File> {
    const backupName = `gastos-backup-${Date.now()}.db`;
    const backup = new File(
      Paths.cache,
      backupName
    );

    try {
      await withDatabaseLock(async () => {
        const source = await getDatabase();
        const destination = await SQLite.openDatabaseAsync(
          backupName,
          {},
          Paths.cache.uri
        );

        try {
          await SQLite.backupDatabaseAsync({
            sourceDatabase: source,
            sourceDatabaseName: 'main',
            destDatabase: destination,
            destDatabaseName: 'main',
          });
          await destination.execAsync('PRAGMA journal_mode = DELETE');
        } finally {
          await destination.closeAsync();
        }
      });

      // Never replace the last valid Drive copy with a file the restore path
      // would reject.
      await this.validateBackupFile(backup);
      return backup;
    } catch (error) {
      if (backup.exists) backup.delete();
      throw error;
    }
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

    let candidate: SQLite.SQLiteDatabase;
    try {
      candidate = await SQLite.deserializeDatabaseAsync(bytes);
    } catch {
      throw new Error(t('errors.invalidBackupIntegrity'));
    }

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
        throw new Error(t('errors.invalidBackupRelations'));
      }

      const version = await candidate.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if ((version?.user_version ?? 0) > DATABASE_SCHEMA_VERSION) {
        throw new Error(t('errors.invalidBackupVersion'));
      }

      const application = await candidate.getFirstAsync<{ application_id: number }>('PRAGMA application_id');
      if (application?.application_id !== 0 && application?.application_id !== DATABASE_APPLICATION_ID) {
        throw new Error(t('errors.invalidBackupVersion'));
      }
    } catch (error) {
      throw attachDiagnosticMetadata(error, { stage: 'validation' });
    } finally {
      await candidate.closeAsync();
    }
  }

  /**
   * Replaces the database only after closing its native handle. Some Android
   * SQLite builds reject a backup whose destination is an open WAL database.
   * DatabaseContext keeps reads paused for the complete operation.
   */
  static async restoreFromFile(file: File): Promise<void> {
    await this.validateBackupFile(file);

    const bytes = await file.bytes();
    const tempDirectory = new Directory(
      Paths.cache,
      `restore-${Date.now()}`
    );
    tempDirectory.create({ idempotent: true, intermediates: true });

    const rollbackName = 'rollback.db';
    const source = await SQLite.deserializeDatabaseAsync(bytes);

    const rollback = await SQLite.openDatabaseAsync(
      rollbackName,
      {},
      tempDirectory.uri
    );

    try {
      await withDatabaseLock(async () => {
        // Keep a local rollback copy so a failed restore does not leave the
        // application without its previous database.
        const current = await getDatabase();
        await SQLite.backupDatabaseAsync({
          sourceDatabase: current,
          sourceDatabaseName: 'main',
          destDatabase: rollback,
          destDatabaseName: 'main',
        });

        try {
          await this.replaceDatabaseFrom(source);
        } catch (restoreError) {
          await this.replaceDatabaseFrom(rollback);
          throw attachDiagnosticMetadata(restoreError, {
            stage: 'replacement',
            code: 'DATABASE_REPLACE_FAILED',
          });
        }
      });

      // Apply additive migrations while DatabaseContext still has all reads
      // paused. If migration fails, restore the pre-operation snapshot too.
      try {
        await initDatabase();
      } catch (migrationError) {
        await withDatabaseLock(async () => {
          await this.replaceDatabaseFrom(rollback);
        });
        await initDatabase();
        throw attachDiagnosticMetadata(migrationError, {
          stage: 'migration',
          code: 'DATABASE_MIGRATION_FAILED',
        });
      }
    } finally {
      await source.closeAsync();
      await rollback.closeAsync();
      if (tempDirectory.exists) tempDirectory.delete();
    }
  }

}
