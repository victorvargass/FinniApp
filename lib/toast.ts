import { Platform, ToastAndroid } from 'react-native';

import { Alert } from '@/lib/alert';
import { t } from '@/lib/i18n';

export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(t('common.done'), message);
}
