import {
  GoogleSignin,
  type User,
} from '@react-native-google-signin/google-signin';
import { Platform } from 'react-native';

import { t } from '@/lib/i18n';

export const GOOGLE_WEB_CLIENT_ID =
  '310919587145-jq3tit5t1shu4vomuskc7j3m0todgkvg.apps.googleusercontent.com';

export const GOOGLE_IOS_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

export const GOOGLE_DRIVE_APPDATA_SCOPE =
  'https://www.googleapis.com/auth/drive.appdata';

export type GoogleUser = User['user'];

let configured = false;

export class GoogleAuthService {
  private static assertIosConfigured(): void {
    if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
      throw new Error(t('errors.googleIosNotConfigured'));
    }
  }

  static configure(): void {
    if (configured) return;

    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      scopes: ['email', 'profile'],
      offlineAccess: false,
    });

    configured = true;
  }

  static async signIn(): Promise<GoogleUser> {
    this.assertIosConfigured();
    this.configure();

    if (Platform.OS === 'android') {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });
    }

    const response = await GoogleSignin.signIn();

    if (response.type !== 'success') {
      throw new Error(t('errors.googleSignInCancelled'));
    }

    await this.requestDriveAccess();
    return response.data.user;
  }

  static async requestDriveAccess(): Promise<void> {
    this.configure();

    const response = await GoogleSignin.addScopes({
      scopes: [GOOGLE_DRIVE_APPDATA_SCOPE],
    });

    if (response?.type === 'cancelled') {
      throw new Error(t('errors.googleDrivePermissionCancelled'));
    }
  }

  static async restoreSession(): Promise<GoogleUser | null> {
    if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
      return null;
    }
    this.configure();

    if (!GoogleSignin.hasPreviousSignIn()) {
      return null;
    }

    try {
      const response = await GoogleSignin.signInSilently();

      if (response.type !== 'success') {
        return null;
      }

      try {
        await this.requestDriveAccess();
      } catch {
        // The Google account can still be restored even if Drive access
        // has not been granted yet. A backup operation will request it again.
      }

      return response.data.user;
    } catch {
      return null;
    }
  }

  static async getAccessToken(): Promise<string> {
    this.assertIosConfigured();
    this.configure();

    // Drive access is an additional authorization scope on Android.
    // Calling addScopes again is safe when it has already been granted.
    await this.requestDriveAccess();

    const tokens = await GoogleSignin.getTokens();
    return tokens.accessToken;
  }

  static getCurrentUser(): GoogleUser | null {
    if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
      return null;
    }
    this.configure();
    return GoogleSignin.getCurrentUser()?.user ?? null;
  }

  static async signOut(): Promise<void> {
    if (Platform.OS === 'ios' && !GOOGLE_IOS_CLIENT_ID) {
      return;
    }
    this.configure();
    await GoogleSignin.signOut();
  }
}
