import { Platform, ToastAndroid } from 'react-native';

import { Alert } from './alert';
import { t, type TranslationKey } from './i18n';

export function errorMessage(error: unknown, fallback: TranslationKey = 'common.tryAgain'): string {
  return error instanceof Error && error.message ? error.message : t(fallback);
}

export function showFeedback(message: string, title: TranslationKey = 'common.done'): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(t(title), message);
}
