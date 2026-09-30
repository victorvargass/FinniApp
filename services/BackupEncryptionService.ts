import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';

import {
  decryptBackupBytes,
  encryptBackupBytes,
  isEncryptedBackupBytes,
} from '@/lib/backup-encryption';
import { t } from '@/lib/i18n';
import { MAX_BACKUP_SIZE_BYTES } from '@/lib/database-schema';

export class BackupEncryptionService {
  static async encrypt(file: File, passphrase: string): Promise<File> {
    const destination = new File(Paths.cache, `finniapp-backup-${Date.now()}.finni`);
    const [salt, nonce, plaintext] = await Promise.all([
      Crypto.getRandomBytesAsync(16),
      Crypto.getRandomBytesAsync(24),
      file.bytes(),
    ]);
    try {
      destination.write(await encryptBackupBytes(plaintext, passphrase, salt, nonce));
      return destination;
    } catch (error) {
      if (destination.exists) destination.delete();
      throw error;
    } finally {
      plaintext.fill(0);
    }
  }

  static async decryptIfNeeded(file: File, passphrase?: string | null): Promise<File> {
    if ((file.size ?? 0) > MAX_BACKUP_SIZE_BYTES + 8192) {
      throw new Error(t('errors.invalidBackupVersion'));
    }
    const bytes = await file.bytes();
    if (!isEncryptedBackupBytes(bytes)) return file;
    if (!passphrase) throw new Error(t('errors.backupPassphraseRequired'));

    const destination = new File(Paths.cache, `gastos-restore-${Date.now()}.db`);
    try {
      destination.write(await decryptBackupBytes(bytes, passphrase));
      return destination;
    } catch (error) {
      if (destination.exists) destination.delete();
      if (error instanceof Error && error.message === 'INVALID_BACKUP_PASSPHRASE') {
        throw new Error(t('errors.invalidBackupPassphrase'));
      }
      throw new Error(t('errors.invalidBackupIntegrity'));
    } finally {
      bytes.fill(0);
    }
  }
}
