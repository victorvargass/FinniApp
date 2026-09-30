import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';

import {
  isValidSentryDsn,
  sanitizeCrashMonitoringEvent,
} from '@/lib/crash-monitoring-privacy';

const CONSENT_STORAGE_KEY = '@finniapp/crash-monitoring-consent-v1';
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

let initialized = false;

export const isCrashMonitoringConfigured = isValidSentryDsn(SENTRY_DSN);

export async function getCrashMonitoringConsent(): Promise<boolean> {
  return await AsyncStorage.getItem(CONSENT_STORAGE_KEY) === 'granted';
}

export async function setCrashMonitoringConsent(enabled: boolean): Promise<void> {
  if (enabled) await AsyncStorage.setItem(CONSENT_STORAGE_KEY, 'granted');
  else await AsyncStorage.removeItem(CONSENT_STORAGE_KEY);
}

export async function configureCrashMonitoring(enabled: boolean): Promise<boolean> {
  if (!enabled || !isCrashMonitoringConfigured || !SENTRY_DSN) {
    if (initialized) {
      await Sentry.close();
      initialized = false;
    }
    return false;
  }

  if (!initialized) {
    Sentry.init({
      dsn: SENTRY_DSN,
      enabled: true,
      sendDefaultPii: false,
      attachScreenshot: false,
      attachViewHierarchy: false,
      enableCaptureFailedRequests: false,
      enableNativeCrashHandling: true,
      enableNdk: false,
      enableAppHangTracking: true,
      enableAutoSessionTracking: true,
      attachThreads: true,
      tracesSampleRate: 0,
      profilesSampleRate: 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      maxBreadcrumbs: 0,
      beforeBreadcrumb: () => null,
      beforeSend: (event) => sanitizeCrashMonitoringEvent(event),
    });
    initialized = true;
  }
  return true;
}

export function reportHandledError(error: unknown, context: string): void {
  if (!initialized) return;
  Sentry.withScope((scope) => {
    scope.setTag('error_context', context);
    Sentry.captureException(error instanceof Error ? error : new Error('Application error'));
  });
}
