import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';

function formatBackupDate(date: string | undefined): string {
  if (!date) return t('settings.never');
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return t('settings.unknown');

  return parsed.toLocaleString(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: object;
  textStyle?: object;
  icon?: React.ReactNode;
};

function ActionButton({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
}: ActionButtonProps) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
        style,
      ]}>
      {icon}
      <ThemedText style={[styles.buttonText, textStyle]}>{title}</ThemedText>
    </Pressable>
  );
}

export default function GoogleDriveScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const {
    user,
    isLoading,
    isWorking,
    isConnected,
    lastBackup,
    error,
    login,
    backup,
    restore,
    logout,
  } = useGoogle();

  React.useEffect(() => {
    if (!error) return;
    Alert.alert(t('common.error'), error, [{ text: t('common.accept') }]);
  }, [error]);

  const runBackup = async () => {
    try {
      await backup();
      Alert.alert(t('settings.backupCompleted'), t('settings.backupCompletedMessage'));
    } catch {
      // El hook muestra el error mediante su estado.
    }
  };

  const confirmBackup = () => {
    Alert.alert(
      t(lastBackup ? 'settings.replaceBackupTitle' : 'settings.createBackupTitle'),
      lastBackup
        ? t('settings.replaceBackupWarning', {
            date: formatBackupDate(lastBackup.modifiedTime),
          })
        : t('settings.createBackupMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t(lastBackup ? 'settings.replaceBackup' : 'settings.backup'),
          style: lastBackup ? 'destructive' : 'default',
          onPress: () => { void runBackup(); },
        },
      ]
    );
  };

  const runRestore = async () => {
    try {
      await restore();
      Alert.alert(t('settings.restoreCompleted'), t('settings.restoreCompletedMessage'));
    } catch {
      // El hook muestra el error mediante su estado.
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      t('settings.restoreData'),
      t('settings.restoreWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.restore'),
          style: 'destructive',
          onPress: () => { void runRestore(); },
        },
      ]
    );
  };

  const confirmLogout = () => {
    Alert.alert(
      t('settings.signOutTitle'),
      t('settings.signOutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.signOut'),
          style: 'destructive',
          onPress: () => {
            logout()
              .then(() => showToast(t('settings.signOutCompleted')))
              .catch(() => undefined);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{t('settings.googleDrive')}</ThemedText>
        <ThemedText style={styles.intro}>{t('settings.googleDriveHint')}</ThemedText>

        <ThemedView style={styles.card}>
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="small" />
              <ThemedText>{t('settings.loadingSession')}</ThemedText>
            </View>
          ) : !isConnected ? (
            <View style={styles.disconnected}>
              <ThemedText type="subtitle">{t('settings.googleSession')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.connectGoogleHint')}
              </ThemedText>
              <ActionButton
                title={isWorking ? t('settings.connecting') : t('settings.connectGoogle')}
                disabled={isWorking}
                onPress={() => {
                  login()
                    .then(() => showToast(t('settings.signInCompleted')))
                    .catch(() => undefined);
                }}
                style={styles.googleButton}
                textStyle={styles.googleButtonText}
                icon={<GoogleLogo />}
              />
            </View>
          ) : (
            <>
              <View style={styles.profile}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarText}>
                    {(user?.name?.[0] ?? 'G').toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.profileInfo}>
                  <ThemedText type="subtitle">
                    {user?.name ?? t('settings.googleUser')}
                  </ThemedText>
                  <ThemedText style={styles.secondary}>
                    {user?.email ?? t('settings.emailUnavailable')}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>{t('settings.state')}</ThemedText>
                <ThemedText style={styles.connected}>{t('settings.connectedGoogle')}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>{t('settings.lastBackup')}</ThemedText>
                <ThemedText style={styles.infoValue}>
                  {formatBackupDate(lastBackup?.modifiedTime)}
                </ThemedText>
              </View>

              <View style={styles.actions}>
                <ActionButton
                  title={isWorking ? t('settings.backingUp') : t('settings.backup')}
                  disabled={isWorking}
                  onPress={confirmBackup}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
                <ActionButton
                  title={isWorking ? t('settings.restoring') : t('settings.restore')}
                  disabled={isWorking || !lastBackup}
                  onPress={confirmRestore}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
                <ActionButton
                  title={t('settings.signOut')}
                  disabled={isWorking}
                  onPress={confirmLogout}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
              </View>
            </>
          )}

          {isWorking && (
            <View style={styles.progress}>
              <ActivityIndicator size="small" />
              <ThemedText>{t('common.processing')}</ThemedText>
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 13,
  },
  intro: {
    lineHeight: 20,
    opacity: 0.68,
  },
  card: {
    borderRadius: 12,
    padding: 18,
    elevation: 2,
    gap: 18,
    marginTop: 3,
  },
  loading: {
    minHeight: 88,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  disconnected: {
    gap: 14,
  },
  description: {
    lineHeight: 21,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
    gap: 3,
  },
  secondary: {
    opacity: 0.7,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  infoLabel: {
    fontWeight: '600',
  },
  infoValue: {
    flex: 1,
    textAlign: 'right',
    opacity: 0.8,
  },
  connected: {
    fontWeight: '700',
  },
  actions: {
    gap: 10,
  },
  button: {
    minHeight: 46,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    fontWeight: '700',
  },
  googleButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D8E1E8',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderRadius: 5,
  },
  googleButtonText: {
    color: '#60758E',
    fontWeight: '600',
    fontSize: 16,
  },
  darkActionButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  darkActionButtonText: {
    color: '#0B315B',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
});
