import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_CATEGORY_COUNT = 12;

const PERIOD_CONFIGURED_KEY = '@finniapp/progressive-setup-v2/period-configured';
export const SETUP_COMPLETE_KEY = '@finniapp/progressive-setup-v2/complete';
export const BACKUP_SKIPPED_KEY = '@finniapp/progressive-setup-v2/backup-skipped';

const LEGACY_SETUP_KEYS = [
  '@finniapp/progressive-setup-v1/complete',
  '@finniapp/progressive-setup-v1/backup-skipped',
];

export async function hasConfiguredFirstPeriod(): Promise<boolean> {
  return (await AsyncStorage.getItem(PERIOD_CONFIGURED_KEY)) === 'true';
}

export async function markFirstPeriodConfigured(): Promise<void> {
  await AsyncStorage.setItem(PERIOD_CONFIGURED_KEY, 'true');
}

export async function resetSetupProgress(): Promise<void> {
  await AsyncStorage.multiRemove([
    PERIOD_CONFIGURED_KEY,
    SETUP_COMPLETE_KEY,
    BACKUP_SKIPPED_KEY,
    ...LEGACY_SETUP_KEYS,
  ]);
}
