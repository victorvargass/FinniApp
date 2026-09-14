import {
  Alert as NativeAlert,
  Platform,
  ToastAndroid,
  type AlertButton,
  type AlertOptions,
} from 'react-native';

import { t } from './i18n';
import { isTechnicalErrorMessage } from './user-facing-error';

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    const safeMessage = message && isTechnicalErrorMessage(message)
      ? t('errors.technical')
      : message;
    const isInformational = !buttons || (buttons.length === 1 && !buttons[0]?.onPress);
    if (Platform.OS === 'android' && isInformational) {
      ToastAndroid.show(safeMessage?.trim() || title, ToastAndroid.LONG);
      return;
    }
    NativeAlert.alert(title, safeMessage, buttons, {
      ...options,
      cancelable: true,
    });
  },
};
