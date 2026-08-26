import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';

export type BackupMetadata = {
  id: string;
  name: string;
  modifiedTime: string;
};

export class BackupService {
  static async backup(
    drive: GoogleDriveService
  ): Promise<BackupMetadata> {
    const file = await DatabaseService.createBackupFile();

    try {
      const uploaded = await drive.uploadDatabase(file.uri);
      return {
        id: uploaded.id,
        name: uploaded.name,
        modifiedTime: uploaded.modifiedTime,
      };
    } finally {
      if (file.exists) {
        file.delete();
      }
    }
  }
}
