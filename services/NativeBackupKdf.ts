import { pbkdf2 } from 'react-native-quick-crypto';

import type { BackupKeyDeriver } from '@/lib/backup-encryption';

export const deriveBackupKeyNative: BackupKeyDeriver = (
  passphrase,
  salt,
  iterations,
  keyLength
) => new Promise((resolve, reject) => {
  try {
    pbkdf2(
      new TextEncoder().encode(passphrase.normalize('NFKC')),
      salt,
      iterations,
      keyLength,
      'sha256',
      (error, derivedKey) => {
        if (error || !derivedKey) {
          reject(error ?? new Error('NATIVE_PBKDF2_FAILED'));
          return;
        }
        resolve(Uint8Array.from(derivedKey));
      }
    );
  } catch (error) {
    reject(error);
  }
});
