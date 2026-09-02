import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoogleLogo } from '@/components/google-logo';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useBiometric } from '@/contexts/BiometricContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGoogle } from '@/hooks/useGoogle';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';

// Utils
const WEEKDAY_LABELS: Record<number, string> = {
  1: t('settings.weekdays.sunday'), 2: t('settings.weekdays.monday'),
  3: t('settings.weekdays.tuesday'), 4: t('settings.weekdays.wednesday'),
  5: t('settings.weekdays.thursday'), 6: t('settings.weekdays.friday'),
  7: t('settings.weekdays.saturday'),
};

function formatBackupDate(date: string | undefined): string {
  if (!date) return t('settings.never');
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return t('settings.unknown');

  return parsed.toLocaleString(APP_LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// Components
type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
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
      ]}
    >
      {icon}
      <ThemedText style={[styles.buttonText, textStyle]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

// Main screen
export default function UserScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { setPreference: setThemePreference } = useThemePreference();
  const { recurringDecisions, savingsGoals, settings, setMovementReminder } = useDatabase();
  const pendingConfirmations = recurringDecisions.filter((item) => item.status === 'pending').length;
  const activeSavingsGoals = savingsGoals.filter((goal) => goal.status === 'active');
  const totalSavings = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const {
    authenticationType,
    enabled: biometricEnabled,
    isAvailable: isBiometricAvailable,
    setEnabled: setBiometricEnabled,
  } = useBiometric();
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

  // Actions
  const runBackup = async () => {
    try {
      await backup();
      Alert.alert(t('settings.backupCompleted'), t('settings.backupCompletedMessage'));
    } catch {
      // El hook ya expone el error.
    }
  };

  const runRestore = async () => {
    try {
      await restore();
      Alert.alert(
        t('settings.restoreCompleted'), t('settings.restoreCompletedMessage')
      );
    } catch {
      // El hook ya expone el error.
    }
  };

  const confirmRestore = () => {
    Alert.alert(
      t('settings.restoreData'), t('settings.restoreWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.restore'), style: 'destructive', onPress: runRestore },
      ]
    );
  };

  const runLogout = async () => {
    await logout();
  };

  // Main content
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">{t('settings.title')}</ThemedText>
          <Pressable
            accessibilityLabel={pendingConfirmations > 0
              ? t('settings.notificationsPending', { count: pendingConfirmations })
              : t('navigation.notifications')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/recurring-confirmations')}
            hitSlop={10}
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && styles.buttonPressed,
            ]}>
            <Ionicons name="notifications-outline" size={25} color={colors.icon} />
            {pendingConfirmations > 0 && (
              <View style={styles.notificationBadge}>
                <ThemedText style={styles.notificationBadgeText}>
                  {pendingConfirmations > 99 ? '99+' : pendingConfirmations}
                </ThemedText>
              </View>
            )}
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel={t('accessibility.configureCategories')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/categories')}
            style={({ pressed }) => [
              styles.settingsLink,
              pressed && styles.buttonPressed,
            ]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('navigation.categories')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.categoriesHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel={t('accessibility.configurePaymentMethods')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/payment-methods')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('navigation.paymentMethods')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.paymentMethodsHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel={t('accessibility.configureRecurrences')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/recurring-expenses')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('navigation.recurringMovements')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.recurrencesHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel={t('accessibility.manageDebts')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/debts')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('navigation.debts')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.debtsHint')}
              </ThemedText>
            </View>
            <Ionicons name="wallet-outline" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <Pressable
            accessibilityLabel={t('savings.manageAccessibility')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/savings-goals')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('savings.title')}</ThemedText>
              <ThemedText style={styles.description}>
                {savingsGoals.length > 0
                  ? t(activeSavingsGoals.length === 1 ? 'savings.activeSummaryOne' : 'savings.activeSummaryOther', {
                      count: activeSavingsGoals.length,
                      amount: new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(totalSavings),
                    })
                  : t('savings.userEmptyHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <Pressable
              accessibilityLabel={t('accessibility.configureReminder')}
              accessibilityRole="button"
              onPress={() => router.push('/modal/movement-reminder')}
              style={({ pressed }) => [styles.reminderLink, pressed && styles.buttonPressed]}>
              <View style={styles.settingCopy}>
                <ThemedText type="subtitle">{t('settings.movementReminder')}</ThemedText>
                <ThemedText style={styles.description}>
                  {settings.movementReminderFrequency === 'daily'
                    ? t('settings.everyDay')
                    : t('settings.everyWeekday', { weekday: WEEKDAY_LABELS[settings.movementReminderWeekday] ?? t('settings.weekdays.sunday') })} · {String(settings.movementReminderHour).padStart(2, '0')}:{String(settings.movementReminderMinute).padStart(2, '0')}
                </ThemedText>
              </View>
            </Pressable>
            <Switch
              accessibilityLabel={t('accessibility.toggleReminder')}
              value={settings.movementReminderEnabled}
              onValueChange={(movementReminderEnabled) => {
                setMovementReminder({
                  movementReminderEnabled,
                  movementReminderFrequency: settings.movementReminderFrequency,
                  movementReminderWeekday: settings.movementReminderWeekday,
                  movementReminderHour: settings.movementReminderHour,
                  movementReminderMinute: settings.movementReminderMinute,
                }).catch((toggleError) => {
                  Alert.alert(t('errors.couldNotUpdate'), toggleError instanceof Error ? toggleError.message : t('common.tryAgain'));
                });
              }}
              trackColor={{ true: colors.primary }}
            />
            <Pressable
              accessibilityLabel={t('accessibility.configureReminder')}
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/modal/movement-reminder')}
              style={({ pressed }) => pressed && styles.buttonPressed}>
              <Ionicons name="chevron-forward" size={20} color={colors.icon} />
            </Pressable>
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.darkTheme')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.darkThemeHint')}
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('accessibility.toggleDarkMode')}
              onValueChange={(enabled) => {
                setThemePreference(enabled ? 'dark' : 'light').catch(() => {
                  Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
                });
              }}
              trackColor={{ true: colors.tint }}
              value={colorScheme === 'dark'}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.biometric')}</ThemedText>
              <ThemedText style={styles.description}>
                {isBiometricAvailable
                  ? t('settings.biometricHint', { authenticationType })
                  : t('settings.biometricUnavailable')}
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('accessibility.toggleBiometric')}
              disabled={!isBiometricAvailable}
              onValueChange={(value) => {
                setBiometricEnabled(value).catch(() => {
                  Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
                });
              }}
              trackColor={{ true: colors.tint }}
              value={biometricEnabled}
            />
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          {isLoading ? (
            <View style={styles.googleLoading}>
              <ActivityIndicator size="small" />
              <ThemedText>{t('settings.loadingSession')}</ThemedText>
            </View>
          ) : !isConnected ? (
            <>
              <ThemedText type="subtitle">{t('settings.googleDrive')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.googleDriveHint')}
              </ThemedText>
              <ActionButton
                title={isWorking ? t('settings.connecting') : t('settings.connectGoogle')}
                disabled={isWorking}
                onPress={() => {
                  login().catch(() => {
                    // El mensaje se muestra debajo.
                  });
                }}
                style={styles.googleButtonStyle}
                textStyle={styles.googleButtonTextStyle}
                icon={<GoogleLogo />}
              />
            </>
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
                  onPress={runBackup}
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
                  onPress={runLogout}
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

          {error && (
            <>
              {Alert.alert(
                t('common.error'),
                error,
                [{ text: 'OK' }],
                { cancelable: true }
              )}
            </>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 52,
    position: 'relative',
  },
  notificationButton: {
    position: 'absolute',
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: 1,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '800',
  },
  card: {
    borderRadius: 12,
    padding: 18,
    elevation: 2,
    gap: 18,
  },
  googleLoading: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  description: {
    lineHeight: 21,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  settingCopy: {
    flex: 1,
    gap: 6,
  },
  settingsLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  reminderLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  darkActionButton: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  darkActionButtonText: {
    color: '#11181C',
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  error: {
    lineHeight: 20,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  googleButtonStyle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ccc',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 5,
    marginTop: 10,
  },
  googleButtonTextStyle: {
    color: '#444',
    fontWeight: '600',
    fontSize: 16,
  },
});
