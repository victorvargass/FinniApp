import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEFAULT_CATEGORY_COUNT = 12;

const PERIOD_CONFIGURED_KEY = '@finniapp/progressive-setup-v4/period-configured';
const PERIOD_START_CONFIRMED_KEY = '@finniapp/progressive-setup-v4/period-start-confirmed';
const PERIOD_END_CONFIRMED_KEY = '@finniapp/progressive-setup-v4/period-end-confirmed';
export const SETUP_COMPLETE_KEY = '@finniapp/progressive-setup-v3/complete';
export const BACKUP_SKIPPED_KEY = '@finniapp/progressive-setup-v3/backup-skipped';
export const SAVINGS_SKIPPED_KEY = '@finniapp/progressive-setup-v3/savings-skipped';

const LEGACY_SETUP_KEYS = [
  '@finniapp/progressive-setup-v1/complete',
  '@finniapp/progressive-setup-v1/backup-skipped',
  '@finniapp/progressive-setup-v2/complete',
  '@finniapp/progressive-setup-v2/backup-skipped',
  '@finniapp/progressive-setup-v2/period-configured',
];

export async function hasConfiguredFirstPeriod(): Promise<boolean> {
  const [configured, startConfirmed, endConfirmed] = await AsyncStorage.multiGet([
    PERIOD_CONFIGURED_KEY,
    PERIOD_START_CONFIRMED_KEY,
    PERIOD_END_CONFIRMED_KEY,
  ]);
  return configured[1] === 'true'
    || (startConfirmed[1] === 'true' && endConfirmed[1] === 'true');
}

export async function markFirstPeriodConfigured(): Promise<void> {
  await AsyncStorage.multiSet([
    [PERIOD_CONFIGURED_KEY, 'true'],
    [PERIOD_START_CONFIRMED_KEY, 'true'],
    [PERIOD_END_CONFIRMED_KEY, 'true'],
  ]);
}

export async function confirmFirstPeriodDate(
  field: 'start' | 'end'
): Promise<boolean> {
  const key = field === 'start'
    ? PERIOD_START_CONFIRMED_KEY
    : PERIOD_END_CONFIRMED_KEY;
  const otherKey = field === 'start'
    ? PERIOD_END_CONFIRMED_KEY
    : PERIOD_START_CONFIRMED_KEY;

  await AsyncStorage.setItem(key, 'true');
  const otherConfirmed = await AsyncStorage.getItem(otherKey);
  if (otherConfirmed !== 'true') return false;

  await AsyncStorage.setItem(PERIOD_CONFIGURED_KEY, 'true');
  return true;
}

export async function resetSetupProgress(): Promise<void> {
  await AsyncStorage.multiRemove([
    PERIOD_CONFIGURED_KEY,
    PERIOD_START_CONFIRMED_KEY,
    PERIOD_END_CONFIRMED_KEY,
    SETUP_COMPLETE_KEY,
    BACKUP_SKIPPED_KEY,
    SAVINGS_SKIPPED_KEY,
    ...LEGACY_SETUP_KEYS,
  ]);
}
