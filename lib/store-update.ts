import { Platform } from 'react-native';

import {
  evaluateStoreUpdate,
  type PlatformVersionPolicy,
  type StoreUpdateStatus,
} from './store-update-policy';

const STORE_VERSION_POLICY_URL = 'https://victorvargass.github.io/FinniApp-Web/app-version.json';

type StoreVersionPolicy = {
  android?: PlatformVersionPolicy;
  ios?: PlatformVersionPolicy;
};

export async function checkStoreUpdate(currentVersion: string): Promise<StoreUpdateStatus> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return { kind: 'current' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const separator = STORE_VERSION_POLICY_URL.includes('?') ? '&' : '?';
    const response = await fetch(`${STORE_VERSION_POLICY_URL}${separator}t=${Date.now()}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return { kind: 'unavailable' };
    const policy = await response.json() as StoreVersionPolicy;
    return evaluateStoreUpdate(currentVersion, policy[Platform.OS]);
  } catch {
    return { kind: 'unavailable' };
  } finally {
    clearTimeout(timeout);
  }
}
