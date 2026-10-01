import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';
import { useBiometric } from '@/contexts/BiometricContext';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import { BACKUP_PASSPHRASE_MIN_LENGTH } from '@/lib/backup-encryption';

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
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled) }}
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
  const guide = useFeatureGuide('google-drive');
  const biometric = useBiometric();
  const guideSlides = [
    {
      icon: 'cloud-outline' as const,
      title: t('featureGuides.googleDrive.optionalTitle'),
      body: t('featureGuides.googleDrive.optionalBody'),
    },
    {
      icon: 'cloud-upload-outline' as const,
      title: t('featureGuides.googleDrive.backupTitle'),
      body: t('featureGuides.googleDrive.backupBody'),
    },
    {
      icon: 'cloud-download-outline' as const,
      title: t('featureGuides.googleDrive.restoreTitle'),
      body: t('featureGuides.googleDrive.restoreBody'),
    },
  ];
  const [passphrase, setPassphrase] = React.useState('');
  const [passphraseConfirmation, setPassphraseConfirmation] = React.useState('');
  const [revealedPassphrase, setRevealedPassphrase] = React.useState<string | null>(null);
  const {
    user,
    isLoading,
    isWorking,
    isConnected,
    lastBackup,
    error,
    hasBackupPassphrase,
    login,
    backup,
    restore,
    logout,
    saveBackupPassphrase,
    revealBackupPassphrase,
  } = useGoogle();

  React.useEffect(() => {
    if (!revealedPassphrase) return;
    const timeout = setTimeout(() => setRevealedPassphrase(null), 30_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') setRevealedPassphrase(null);
    });
    return () => {
      clearTimeout(timeout);
      subscription.remove();
    };
  }, [revealedPassphrase]);

  const recoverEncryptionPassword = async () => {
    if (revealedPassphrase) {
      setRevealedPassphrase(null);
      return;
    }
    if (!biometric.isAvailable) {
      Alert.alert(t('common.error'), t('settings.backupPassphraseAuthenticationRequired'));
      return;
    }
    const authenticated = await biometric.authenticate({
      promptMessage: t('settings.backupPassphraseRevealPrompt'),
      promptSubtitle: t('settings.backupPassphraseRevealSubtitle'),
    });
    if (!authenticated) return;
    try {
      setRevealedPassphrase(await revealBackupPassphrase());
    } catch (revealError) {
      Alert.alert(
        t('common.error'),
        revealError instanceof Error ? revealError.message : t('errors.unexpected')
      );
    }
  };

  const saveEncryptionPassword = async () => {
    if (passphrase.length < BACKUP_PASSPHRASE_MIN_LENGTH) {
      Alert.alert(t('common.error'), t('settings.backupPassphraseTooShort'));
      return;
    }
    if (passphrase !== passphraseConfirmation) {
      Alert.alert(t('common.error'), t('settings.backupPassphraseMismatch'));
      return;
    }
    try {
      await saveBackupPassphrase(passphrase);
      setPassphrase('');
      setPassphraseConfirmation('');
      showToast(t('settings.backupPassphraseSaved'));
    } catch (saveError) {
      Alert.alert(
        t('common.error'),
        saveError instanceof Error ? saveError.message : t('errors.unexpected')
      );
    }
  };

  React.useEffect(() => {
    if (!error) return;
    Alert.alert(t('common.error'), error, [{ text: t('common.accept') }]);
  }, [error]);

  const runBackup = async () => {
    try {
      await backup();
      showToast(t('settings.backupCompletedMessage'));
    } catch {
      // El hook muestra el error mediante su estado.
    }
  };

  const confirmBackup = () => {
    Alert.alert(
      t(lastBackup ? 'settings.newBackupTitle' : 'settings.createBackupTitle'),
      lastBackup
        ? t('settings.newBackupMessage', {
            date: formatBackupDate(lastBackup.modifiedTime),
          })
        : t('settings.createBackupMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.backup'),
          onPress: () => { void runBackup(); },
        },
      ]
    );
  };

  const runRestore = async () => {
    try {
      await restore();
      showToast(t('settings.restoreCompletedMessage'));
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
        <View style={styles.introRow}>
          <ThemedText style={styles.intro}>{t('settings.googleDriveHint')}</ThemedText>
          <FeatureGuideButton onPress={guide.open} />
        </View>

        <ThemedView style={[styles.securityNotice, { borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.warning} />
          <ThemedText style={[styles.securityNoticeText, { color: colors.textSecondary }]}>
            {t('settings.backupSecurityNotice')}
          </ThemedText>
        </ThemedView>

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

              <ThemedView style={[styles.encryptionCard, { borderColor: colors.border }]}>
                <View style={styles.encryptionHeading}>
                  <Ionicons name="lock-closed-outline" size={21} color={colors.success} />
                  <ThemedText type="defaultSemiBold">{t('settings.backupEncryptionTitle')}</ThemedText>
                </View>
                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                  {t(hasBackupPassphrase
                    ? 'settings.backupEncryptionReady'
                    : 'settings.backupEncryptionSetup')}
                </ThemedText>
                {hasBackupPassphrase && (
                  <View style={styles.passphraseRecovery}>
                    {revealedPassphrase && (
                      <View
                        accessibilityLabel={t('settings.backupPassphraseRevealed')}
                        style={[styles.revealedPassphrase, { borderColor: colors.border }]}
                      >
                        <ThemedText selectable style={styles.revealedPassphraseText}>
                          {revealedPassphrase}
                        </ThemedText>
                        <ThemedText style={[styles.revealTimeout, { color: colors.textSecondary }]}>
                          {t('settings.backupPassphraseRevealTimeout')}
                        </ThemedText>
                      </View>
                    )}
                    <ActionButton
                      title={t(revealedPassphrase
                        ? 'settings.hideBackupPassphrase'
                        : 'settings.revealBackupPassphrase')}
                      disabled={isWorking || biometric.isChecking}
                      onPress={() => { void recoverEncryptionPassword(); }}
                      style={styles.recoveryButton}
                    />
                  </View>
                )}
                {!hasBackupPassphrase && (
                  <View style={styles.passphraseFields}>
                    <TextInput
                      testID="backup-passphrase"
                      accessibilityLabel={t('settings.backupPassphrase')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      placeholder={t('settings.backupPassphrasePlaceholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={passphrase}
                      onChangeText={setPassphrase}
                      style={[styles.passphraseInput, { borderColor: colors.border, color: colors.text }]}
                    />
                    <TextInput
                      testID="backup-passphrase-confirmation"
                      accessibilityLabel={t('settings.backupPassphraseConfirm')}
                      autoCapitalize="none"
                      autoCorrect={false}
                      secureTextEntry
                      placeholder={t('settings.backupPassphraseConfirm')}
                      placeholderTextColor={colors.textSecondary}
                      value={passphraseConfirmation}
                      onChangeText={setPassphraseConfirmation}
                      style={[styles.passphraseInput, { borderColor: colors.border, color: colors.text }]}
                    />
                    <ActionButton
                      title={t('settings.saveBackupPassphrase')}
                      disabled={isWorking}
                      onPress={() => { void saveEncryptionPassword(); }}
                      style={[styles.encryptionButton, { backgroundColor: colors.primary }]}
                      textStyle={{ color: colors.onPrimary }}
                    />
                  </View>
                )}
              </ThemedView>

              <View style={styles.actions}>
                <ActionButton
                  title={isWorking ? t('settings.backingUp') : t('settings.backup')}
                  disabled={isWorking || !hasBackupPassphrase}
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
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
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
  introRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  intro: {
    flex: 1,
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
  securityNotice: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  securityNoticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  encryptionCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
  },
  encryptionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  passphraseFields: {
    gap: 10,
  },
  passphraseRecovery: {
    gap: 10,
  },
  revealedPassphrase: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  revealedPassphraseText: {
    fontSize: 17,
    fontWeight: '700',
  },
  revealTimeout: {
    fontSize: 12,
  },
  recoveryButton: {
    marginTop: 2,
  },
  passphraseInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 16,
  },
  encryptionButton: {
    marginTop: 2,
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
