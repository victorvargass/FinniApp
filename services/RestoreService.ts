import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';

function isExpectedRestoreError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return [
    t('errors.noDriveBackup'),
    t('errors.emptyBackup'),
    t('errors.invalidBackupIntegrity'),
    t('errors.invalidBackupRelations'),
    t('errors.invalidBackupVersion'),
  ].includes(error.message);
}

export class RestoreService {
  static async restore(drive: GoogleDriveService): Promise<void> {
    const file = await drive.downloadDatabase();

    if (!file) {
      throw new Error(t('errors.noDriveBackup'));
    }

    try {
      try {
        await DatabaseService.restoreFromFile(file);
      } catch (error) {
        logAppError('database.restore', error);
        if (isExpectedRestoreError(error)) throw error;
        throw new Error(t('errors.restoreFailed'));
      }
    } finally {
      if (file.exists) {
        file.delete();
      }
    }
  }
}
