import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BackupFrequency } from '@/lib/backup-policy';
import type { BackupOperationMetrics } from '@/lib/backup-operation';

const FREQUENCY_KEY = '@finniapp/automatic-backup-frequency-v1';
const LAST_AUTOMATIC_BACKUP_KEY = '@finniapp/last-automatic-backup';
const LAST_FINGERPRINT_PREFIX = '@finniapp/last-backup-fingerprint-v1:';
const LAST_OPERATION_METRICS_KEY = '@finniapp/last-backup-operation-metrics-v1';

const FREQUENCIES: BackupFrequency[] = ['daily', 'weekly', 'monthly', 'manual'];

export class BackupPreferencesService {
  static async getFrequency(): Promise<BackupFrequency> {
    const stored = await AsyncStorage.getItem(FREQUENCY_KEY);
    return FREQUENCIES.includes(stored as BackupFrequency)
      ? stored as BackupFrequency
      : 'daily';
  }

  static async setFrequency(frequency: BackupFrequency): Promise<void> {
    await AsyncStorage.setItem(FREQUENCY_KEY, frequency);
  }

  static getLastAutomaticBackup(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_AUTOMATIC_BACKUP_KEY);
  }

  static async recordAutomaticBackupCheck(timestamp = Date.now()): Promise<void> {
    await AsyncStorage.setItem(LAST_AUTOMATIC_BACKUP_KEY, String(timestamp));
  }

  static getLastFingerprint(accountId: string): Promise<string | null> {
    return AsyncStorage.getItem(`${LAST_FINGERPRINT_PREFIX}${accountId}`);
  }

  static async recordSuccessfulBackup(
    accountId: string,
    fingerprint: string,
    timestamp = Date.now()
  ): Promise<void> {
    await AsyncStorage.multiSet([
      [`${LAST_FINGERPRINT_PREFIX}${accountId}`, fingerprint],
      [LAST_AUTOMATIC_BACKUP_KEY, String(timestamp)],
    ]);
  }

  static async recordOperationMetrics(metrics: BackupOperationMetrics): Promise<void> {
    await AsyncStorage.setItem(LAST_OPERATION_METRICS_KEY, JSON.stringify(metrics));
  }
}
