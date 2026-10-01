import { DatabaseService } from './DatabaseService';
import { GoogleDriveService } from './GoogleDriveService';
import { BackupEncryptionService } from './BackupEncryptionService';
import {
  createBackupOperationTracker,
  type BackupOperationMetrics,
  type BackupProgressListener,
} from '@/lib/backup-operation';

export type BackupMetadata = {
  id: string;
  name: string;
  modifiedTime: string;
};

export type BackupResult = {
  metadata: BackupMetadata | null;
  fingerprint: string;
  skipped: boolean;
  metrics: BackupOperationMetrics;
};

type BackupOptions = {
  onProgress?: BackupProgressListener;
  skipIfFingerprint?: string | null;
};

export class BackupService {
  static async backup(
    drive: GoogleDriveService,
    passphrase: string,
    options: BackupOptions = {}
  ): Promise<BackupResult> {
    const tracker = createBackupOperationTracker('backup', options.onProgress);
    tracker.start('preparing', 0.08);
    const { file, fingerprint } = await DatabaseService.createBackupFile();
    let encryptedFile: Awaited<ReturnType<typeof BackupEncryptionService.encrypt>> | null = null;

    try {
      if (options.skipIfFingerprint === fingerprint) {
        tracker.start('finalizing', 0.95);
        return {
          metadata: null,
          fingerprint,
          skipped: true,
          metrics: tracker.finish(),
        };
      }
      tracker.start('encrypting', 0.35);
      encryptedFile = await BackupEncryptionService.encrypt(file, passphrase);
      tracker.start('uploading', 0.68);
      const uploaded = await drive.uploadDatabase(encryptedFile.uri);
      tracker.start('finalizing', 0.95);
      return {
        metadata: {
          id: uploaded.id,
          name: uploaded.name,
          modifiedTime: uploaded.modifiedTime,
        },
        fingerprint,
        skipped: false,
        metrics: tracker.finish(),
      };
    } finally {
      if (file.exists) {
        file.delete();
      }
      if (encryptedFile?.exists) encryptedFile.delete();
    }
  }
}
