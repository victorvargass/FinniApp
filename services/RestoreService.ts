import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { t } from '@/lib/i18n';
import { getDiagnosticMetadata, logAppError } from '@/lib/logger';
import { BackupEncryptionService } from './BackupEncryptionService';
import {
  createBackupOperationTracker,
  type BackupOperationMetrics,
  type BackupProgressListener,
} from '@/lib/backup-operation';

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
  static async restore(
    drive: GoogleDriveService,
    passphrase?: string | null,
    onProgress?: BackupProgressListener
  ): Promise<BackupOperationMetrics> {
    const tracker = createBackupOperationTracker('restore', onProgress);
    tracker.start('downloading', 0.08);
    const file = await drive.downloadDatabase();

    if (!file) {
      throw new Error(t('errors.noDriveBackup'));
    }

    let databaseFile = file;
    try {
      tracker.start('decrypting', 0.3);
      databaseFile = await BackupEncryptionService.decryptIfNeeded(file, passphrase);
      try {
        await DatabaseService.restoreFromFile(databaseFile, (stage) => {
          tracker.start(stage, stage === 'validating' ? 0.5 : stage === 'replacing' ? 0.7 : 0.9);
        });
        return tracker.finish();
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
