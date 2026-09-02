import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { t } from '@/lib/i18n';

export class RestoreService {
  static async restore(drive: GoogleDriveService): Promise<void> {
    const file = await drive.downloadDatabase();

    if (!file) {
      throw new Error(t('errors.noDriveBackup'));
    }

    try {
      await DatabaseService.restoreFromFile(file);
    } finally {
      if (file.exists) {
        file.delete();
      }
    }
  }
}
