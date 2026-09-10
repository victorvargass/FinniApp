import {
  Alert as NativeAlert,
  Platform,
  ToastAndroid,
  type AlertButton,
  type AlertOptions,
} from 'react-native';

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) {
    const isInformational = !buttons || (buttons.length === 1 && !buttons[0]?.onPress);
    if (Platform.OS === 'android' && isInformational) {
      ToastAndroid.show(message?.trim() || title, ToastAndroid.LONG);
      return;
    }
    NativeAlert.alert(title, message, buttons, {
      ...options,
      cancelable: true,
    });
  },
};
