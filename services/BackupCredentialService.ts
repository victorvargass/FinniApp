import * as SecureStore from 'expo-secure-store';

const BACKUP_CREDENTIAL_KEY = 'finniapp-drive-backup-credential-v1';

type StoredCredential = { accountId: string; passphrase: string };

export class BackupCredentialService {
  static async getPassphrase(accountId: string): Promise<string | null> {
    const value = await SecureStore.getItemAsync(BACKUP_CREDENTIAL_KEY);
    if (!value) return null;
    try {
      const credential = JSON.parse(value) as StoredCredential;
      return credential.accountId === accountId && typeof credential.passphrase === 'string'
        ? credential.passphrase
        : null;
    } catch {
      return null;
    }
  }

  static async setPassphrase(accountId: string, passphrase: string): Promise<void> {
    await SecureStore.setItemAsync(
      BACKUP_CREDENTIAL_KEY,
      JSON.stringify({ accountId, passphrase } satisfies StoredCredential)
    );
  }

  static async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(BACKUP_CREDENTIAL_KEY);
  }
}
