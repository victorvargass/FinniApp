import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SimpleSelect } from '@/components/simple-select';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { BackupStage } from '@/lib/backup-operation';

function formatElapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}:${String(remainingSeconds).padStart(2, '0')}` : `${seconds} s`;
}

function backupStageLabel(stage: BackupStage): string {
  const keys: Record<BackupStage, Parameters<typeof t>[0]> = {
    preparing: 'settings.backupStagePreparing',
    encrypting: 'settings.backupStageEncrypting',
    uploading: 'settings.backupStageUploading',
    downloading: 'settings.backupStageDownloading',
    decrypting: 'settings.backupStageDecrypting',
    validating: 'settings.backupStageValidating',
    replacing: 'settings.backupStageReplacing',
    finalizing: 'settings.backupStageFinalizing',
  };
  return t(keys[stage]);
}

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
  const [progressNow, setProgressNow] = React.useState(Date.now());
  const {
    user,
    isLoading,
    isWorking,
    operation,
    progress,
    lastOperationMetrics,
    isConnected,
    lastBackup,
    error,
    hasBackupPassphrase,
    backupFrequency,
    login,
    backup,
    restore,
    logout,
    setBackupFrequency,
  } = useGoogle();
  const isLegacyEncryptedBackup = Boolean(lastBackup?.name.endsWith('.finni'));
  const canRestoreBackup = !isLegacyEncryptedBackup || hasBackupPassphrase;
  const offerRestoreAfterLoginRef = React.useRef(false);

  React.useEffect(() => {
    if (!progress) return;
    setProgressNow(Date.now());
    const interval = setInterval(() => setProgressNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [progress]);

  React.useEffect(() => {
    if (!error) return;
    Alert.alert(t('common.error'), error, [{ text: t('common.accept') }]);
  }, [error]);

  const runBackup = React.useCallback(async () => {
    try {
      await backup();
      showToast(t('settings.backupCompletedMessage'));
    } catch {
      // El hook muestra el error mediante su estado.
    }
  }, [backup]);

  const confirmBackup = () => {
    Alert.alert(
      t(lastBackup ? 'settings.newBackupTitle' : 'settings.createBackupTitle'),
      `${lastBackup
        ? t('settings.newBackupMessage', {
            date: formatBackupDate(lastBackup.modifiedTime),
          })
        : t('settings.createBackupMessage')}\n\n${t('settings.manualBackupDurationWarning')}`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.backup'),
          onPress: () => { void runBackup(); },
        },
      ]
    );
  };

  const runRestore = React.useCallback(async () => {
    try {
      await restore();
      showToast(t('settings.restoreCompletedMessage'));
    } catch {
      // El hook muestra el error mediante su estado.
    }
  }, [restore]);

  const connectGoogle = React.useCallback(async () => {
    offerRestoreAfterLoginRef.current = true;
    try {
      await login();
      showToast(t('settings.signInCompleted'));
    } catch {
      offerRestoreAfterLoginRef.current = false;
      // El hook muestra el error mediante su estado.
    }
  }, [login]);

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

  React.useEffect(() => {
    if (!isConnected || isWorking || !offerRestoreAfterLoginRef.current) return;
    offerRestoreAfterLoginRef.current = false;
    if (!lastBackup) return;

    if (isLegacyEncryptedBackup) {
      if (hasBackupPassphrase) {
        Alert.alert(
          t('settings.legacyBackupTitle'),
          t('settings.legacyBackupMigrationOffer', {
            date: formatBackupDate(lastBackup.modifiedTime),
          }),
          [
            { text: t('settings.restoreLater'), style: 'cancel' },
            {
              text: t('settings.createNewBackup'),
              onPress: () => { void runBackup(); },
            },
          ]
        );
        return;
      }
      Alert.alert(
        t('settings.legacyBackupTitle'),
        t('settings.legacyBackupUnavailable', {
          date: formatBackupDate(lastBackup.modifiedTime),
        }),
        [{ text: t('common.accept'), onPress: () => undefined }]
      );
      return;
    }

    Alert.alert(
      t('settings.backupFoundTitle'),
      t('settings.backupFoundReady', {
        date: formatBackupDate(lastBackup.modifiedTime),
      }),
      [
        { text: t('settings.restoreLater'), style: 'cancel' },
        {
          text: t('settings.restoreNow'),
          onPress: () => { void runRestore(); },
        },
      ]
    );
  }, [hasBackupPassphrase, isConnected, isLegacyEncryptedBackup, isWorking, lastBackup, runBackup, runRestore]);

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
                onPress={() => { void connectGoogle(); }}
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

              <ThemedView style={[styles.frequencyCard, { borderColor: colors.border }]}>
                <SimpleSelect
                  label={t('settings.automaticBackupFrequency')}
                  value={backupFrequency}
                  disabled={isWorking}
                  options={[
                    { value: 'daily', label: t('settings.backupFrequencyDaily') },
                    { value: 'weekly', label: t('settings.backupFrequencyWeekly') },
                    { value: 'monthly', label: t('settings.backupFrequencyMonthly') },
                    { value: 'manual', label: t('settings.backupFrequencyManual') },
                  ]}
                  onChange={(frequency) => {
                    void setBackupFrequency(frequency).catch((frequencyError) => {
                      Alert.alert(
                        t('common.error'),
                        frequencyError instanceof Error
                          ? frequencyError.message
                          : t('errors.unexpected')
                      );
                    });
                  }}
                  testID="automatic-backup-frequency"
                />
                <ThemedText style={[styles.frequencyHint, { color: colors.textSecondary }]}>
                  {t('settings.automaticBackupFrequencyHint')}
                </ThemedText>
              </ThemedView>

              <ThemedView style={[styles.encryptionCard, { borderColor: colors.border }]}>
                <View style={styles.encryptionHeading}>
                  <Ionicons name="logo-google" size={21} color={colors.success} />
                  <ThemedText type="defaultSemiBold">{t('settings.backupAccessTitle')}</ThemedText>
                </View>
                <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
                  {t('settings.backupAccessGoogle')}
                </ThemedText>
                {isLegacyEncryptedBackup && (
                  <ThemedText style={[styles.legacyNotice, { color: colors.warning }]}>
                    {t(hasBackupPassphrase
                      ? 'settings.legacyBackupCanMigrate'
                      : 'settings.legacyBackupCannotRestore')}
                  </ThemedText>
                )}
              </ThemedView>

              <View style={styles.actions}>
                <ActionButton
                  title={operation === 'backup' ? t('settings.backingUp') : t('settings.backup')}
                  disabled={isWorking}
                  onPress={confirmBackup}
                  style={colorScheme === 'dark' ? styles.darkActionButton : undefined}
                  textStyle={colorScheme === 'dark' ? styles.darkActionButtonText : undefined}
                />
                <ActionButton
                  title={operation === 'restore' ? t('settings.restoring') : t('settings.restore')}
                  disabled={isWorking || !lastBackup || !canRestoreBackup}
                  onPress={() => confirmRestore()}
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

          {progress && (
            <View style={styles.progressPanel}>
              <View style={styles.progressHeading}>
                <ThemedText type="defaultSemiBold">{backupStageLabel(progress.stage)}</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>
                  {formatElapsed(progressNow - progress.startedAt)}
                </ThemedText>
              </View>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: colors.primary, width: `${progress.progress * 100}%` },
                  ]}
                />
              </View>
              <ThemedText style={[styles.progressHint, { color: colors.textSecondary }]}>
                {t('settings.backupProgressHint')}
              </ThemedText>
            </View>
          )}
          {!isWorking && lastOperationMetrics && (
            <ThemedText style={[styles.lastDuration, { color: colors.textSecondary }]}>
              {t('settings.lastBackupOperationDuration', {
                duration: formatElapsed(lastOperationMetrics.totalDurationMs),
              })}
            </ThemedText>
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
  legacyNotice: {
    fontSize: 13,
    lineHeight: 19,
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
  frequencyCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  frequencyHint: {
    fontSize: 12,
    lineHeight: 18,
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
  progressPanel: {
    gap: 8,
  },
  progressHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressHint: {
    fontSize: 12,
    lineHeight: 17,
  },
  lastDuration: {
    textAlign: 'center',
    fontSize: 12,
  },
});
