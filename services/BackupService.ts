import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { BackupEncryptionService } from './BackupEncryptionService';

export type BackupMetadata = {
  id: string;
  name: string;
  modifiedTime: string;
};

export class BackupService {
  static async backup(
    drive: GoogleDriveService,
    passphrase: string
  ): Promise<BackupMetadata> {
    const file = await DatabaseService.createBackupFile();
    let encryptedFile: Awaited<ReturnType<typeof BackupEncryptionService.encrypt>> | null = null;

    try {
      encryptedFile = await BackupEncryptionService.encrypt(file, passphrase);
      const uploaded = await drive.uploadDatabase(encryptedFile.uri);
      return {
        id: uploaded.id,
        name: uploaded.name,
        modifiedTime: uploaded.modifiedTime,
      };
    } finally {
      if (file.exists) {
        file.delete();
      }
      if (encryptedFile?.exists) encryptedFile.delete();
    }
  }
}
