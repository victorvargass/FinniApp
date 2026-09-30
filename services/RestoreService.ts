import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { t } from '@/lib/i18n';
import { getDiagnosticMetadata, logAppError } from '@/lib/logger';
import { BackupEncryptionService } from './BackupEncryptionService';

function isExpectedRestoreError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    t('errors.noDriveBackup'),
    t('errors.emptyBackup'),
    t('errors.invalidBackupIntegrity'),
    t('errors.invalidBackupRelations'),
    t('errors.invalidBackupVersion'),
    t('errors.backupPassphraseRequired'),
    t('errors.invalidBackupPassphrase'),
  ].includes(error.message);
}

export class RestoreService {
  static async restore(drive: GoogleDriveService, passphrase?: string | null): Promise<void> {
    const file = await drive.downloadDatabase();

    if (!file) {
      throw new Error(t('errors.noDriveBackup'));
    }

    let databaseFile = file;
    try {
      databaseFile = await BackupEncryptionService.decryptIfNeeded(file, passphrase);
      try {
        await DatabaseService.restoreFromFile(databaseFile);
      } catch (error) {
        const backupMetadata = await DatabaseService.getBackupDiagnosticMetadata(databaseFile).catch(() => ({}));
        logAppError('database.restore', error, { ...getDiagnosticMetadata(error), ...backupMetadata });
        if (isExpectedRestoreError(error)) throw error;
        throw new Error(t('errors.restoreFailed'));
      }
    } finally {
      if (file.exists) {
        file.delete();
      }
      if (databaseFile.uri !== file.uri && databaseFile.exists) databaseFile.delete();
    }
  }
}
