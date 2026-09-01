import {
  Alert as NativeAlert,
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
    NativeAlert.alert(title, message, buttons, {
      ...options,
      cancelable: true,
    });
  },
};
