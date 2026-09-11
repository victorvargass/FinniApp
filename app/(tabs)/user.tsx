import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useBiometric } from '@/contexts/BiometricContext';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemePreference } from '@/contexts/ThemeContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { APP_LOCALE, t } from '@/lib/i18n';
import { clearAppDiagnostics, getAppDiagnostics } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { NotificationPermissionError } from '@/services/MovementReminderService';

const SUPPORT_EMAIL = 'victorvargassandoval93@gmail.com';

// Utils
// Components
type ActionButtonProps = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: any;
  textStyle?: any;
  icon?: React.ReactNode;
  testID?: string;
};

function ActionButton({
  title,
  onPress,
  disabled,
  style,
  textStyle,
  icon,
  testID,
}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
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
  const { language, setLanguage } = useLanguage();
  const { setPreference: setThemePreference } = useThemePreference();
  const { recurringDecisions, savingsGoals, settings, setMovementReminder, resetLocalData } = useDatabase();
  const [resetModalVisible, setResetModalVisible] = React.useState(false);
  const [resetConfirmation, setResetConfirmation] = React.useState('');
  const [isResetting, setIsResetting] = React.useState(false);
  const pendingConfirmations = recurringDecisions.filter((item) => item.status === 'pending').length;
  const activeSavingsGoals = savingsGoals.filter((goal) => goal.status === 'active');
  const totalSavings = savingsGoals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const {
    authenticationType,
    enabled: biometricEnabled,
    isAvailable: isBiometricAvailable,
    setEnabled: setBiometricEnabled,
  } = useBiometric();
  const weekdayLabels: Record<number, string> = {
    1: t('settings.weekdays.sunday'),
    2: t('settings.weekdays.monday'),
    3: t('settings.weekdays.tuesday'),
    4: t('settings.weekdays.wednesday'),
    5: t('settings.weekdays.thursday'),
    6: t('settings.weekdays.friday'),
    7: t('settings.weekdays.saturday'),
  };
  const canReset = resetConfirmation.trim().toLocaleUpperCase() === t('settings.resetConfirmationWord');

  const closeResetModal = () => {
    if (isResetting) return;
    setResetModalVisible(false);
    setResetConfirmation('');
  };

  const requestDataReset = () => {
    Alert.alert(
      t('settings.resetWarningTitle'),
      t('settings.resetWarning'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.continueReset'),
          style: 'destructive',
          onPress: () => {
            setResetConfirmation('');
            setResetModalVisible(true);
          },
        },
      ]
    );
  };

  const confirmDataReset = async () => {
    if (!canReset || isResetting) return;
    setIsResetting(true);
    try {
      await resetLocalData();
      await clearAppDiagnostics();
      setResetModalVisible(false);
      setResetConfirmation('');
      showToast(t('settings.resetCompleteMessage'));
    } catch (resetError) {
      Alert.alert(
        t('settings.resetError'),
        resetError instanceof Error ? resetError.message : t('common.tryAgain')
      );
    } finally {
      setIsResetting(false);
    }
  };

  const contactSupport = async () => {
    try {
      const diagnostics = await getAppDiagnostics();
      const diagnosticText = diagnostics.length > 0
        ? diagnostics.map((item) => `${item.timestamp} | ${item.context} | ${item.category}`).join('\n')
        : t('settings.noDiagnostics');
      const subject = encodeURIComponent(t('settings.supportEmailSubject'));
      const body = encodeURIComponent(t('settings.supportEmailBody', { diagnostics: diagnosticText }));
      const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
      if (!await Linking.canOpenURL(url)) {
        showToast(t('settings.supportUnavailable', { email: SUPPORT_EMAIL }));
        return;
      }
      await Linking.openURL(url);
    } catch {
      showToast(t('settings.supportUnavailable', { email: SUPPORT_EMAIL }));
    }
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

        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('settings.financialManagement')}
        </ThemedText>
        <ThemedView style={[styles.card, styles.groupCard]}>
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
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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

        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('settings.preferences')}
        </ThemedText>
        <ThemedView style={[styles.card, styles.groupCard]}>
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
                    : t('settings.everyWeekday', { weekday: weekdayLabels[settings.movementReminderWeekday] ?? t('settings.weekdays.sunday') })} · {String(settings.movementReminderHour).padStart(2, '0')}:{String(settings.movementReminderMinute).padStart(2, '0')}
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
                })
                  .then(() => showToast(t(movementReminderEnabled
                    ? 'settings.reminderEnabledToast'
                    : 'settings.reminderDisabledToast')))
                  .catch((toggleError) => {
                    if (toggleError instanceof NotificationPermissionError && !toggleError.canAskAgain) {
                      Alert.alert(
                        t('settings.notificationPermissionTitle'),
                        t('settings.notificationPermissionSettingsHint'),
                        [
                          { text: t('common.cancel'), style: 'cancel' },
                          { text: t('settings.openSettings'), onPress: () => { void Linking.openSettings(); } },
                        ]
                      );
                      return;
                    }
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
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.language')}</ThemedText>
              <ThemedText style={styles.description}>{t('settings.languageHint')}</ThemedText>
            </View>
            <View
              accessibilityRole="radiogroup"
              style={[styles.languageSelector, { borderColor: colors.border }]}
            >
              {(['es', 'en'] as const).map((option) => {
                const isSelected = language === option;
                const label = option === 'es' ? t('settings.spanish') : t('settings.english');
                return (
                  <Pressable
                    accessibilityLabel={t('settings.selectLanguage', { language: label })}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    key={option}
                    onPress={() => {
                      if (isSelected) return;
                      void setLanguage(option)
                        .then(() => showToast(t('settings.languageUpdated')))
                        .catch(() => Alert.alert(t('errors.couldNotChange'), t('common.tryAgain')));
                    }}
                    style={({ pressed }) => [
                      styles.languageOption,
                      isSelected && { backgroundColor: colors.primary },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.languageOptionText,
                        isSelected && { color: colors.onPrimary },
                      ]}
                    >
                      {option.toUpperCase()}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
                setThemePreference(enabled ? 'dark' : 'light')
                  .then(() => showToast(t(enabled
                    ? 'settings.darkThemeEnabledToast'
                    : 'settings.darkThemeDisabledToast')))
                  .catch(() => {
                    Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
                  });
              }}
              trackColor={{ true: colors.tint }}
              value={colorScheme === 'dark'}
            />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
                setBiometricEnabled(value)
                  .then((changed) => {
                    if (changed) showToast(t(value
                      ? 'settings.biometricEnabledToast'
                      : 'settings.biometricDisabledToast'));
                  })
                  .catch(() => {
                    Alert.alert(t('errors.couldNotChange'), t('common.tryAgain'));
                  });
              }}
              trackColor={{ true: colors.tint }}
              value={biometricEnabled}
            />
          </View>
        </ThemedView>

        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('settings.accountAndHelp')}
        </ThemedText>
        <ThemedView style={[styles.card, styles.groupCard]}>
          <Pressable
            accessibilityLabel={t('accessibility.manageGoogleDrive')}
            accessibilityRole="button"
            onPress={() => router.push('/modal/google-drive')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.googleDrive')}</ThemedText>
              <ThemedText style={styles.description}>
                {t('settings.googleDriveMenuHint')}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.icon} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/onboarding', params: { returnTo: 'user' } })}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.welcomeGuide')}</ThemedText>
              <ThemedText style={styles.description}>{t('settings.welcomeGuideHint')}</ThemedText>
            </View>
            <Ionicons name="sparkles-outline" size={22} color={colors.savings} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/modal/privacy')}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('privacy.title')}</ThemedText>
              <ThemedText style={styles.description}>{t('privacy.menuHint')}</ThemedText>
            </View>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          </Pressable>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Pressable
            accessibilityLabel={t('settings.support')}
            accessibilityRole="button"
            onPress={() => { void contactSupport(); }}
            style={({ pressed }) => [styles.settingsLink, pressed && styles.buttonPressed]}>
            <View style={styles.settingCopy}>
              <ThemedText type="subtitle">{t('settings.support')}</ThemedText>
              <ThemedText style={styles.description}>{t('settings.supportHint')}</ThemedText>
            </View>
            <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.action} />
          </Pressable>
        </ThemedView>

        <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {t('settings.dataManagement')}
        </ThemedText>
        <ThemedView style={styles.dangerCard}>
          <View style={styles.dangerHeader}>
            <Ionicons name="warning-outline" size={24} color="#C93F4B" />
            <ThemedText type="subtitle" style={styles.dangerTitle}>{t('settings.dangerZone')}</ThemedText>
          </View>
          <ThemedText style={styles.description}>{t('settings.dangerZoneHint')}</ThemedText>
          <ActionButton
            title={t('settings.resetData')}
            onPress={requestDataReset}
            style={styles.dangerButton}
            textStyle={styles.dangerButtonText}
          />
        </ThemedView>
      </ScrollView>

      <Modal
        transparent
        animationType="fade"
        visible={resetModalVisible}
        onRequestClose={closeResetModal}>
        <Pressable style={styles.modalOverlay} onPress={closeResetModal}>
          <Pressable style={[styles.confirmationDialog, { backgroundColor: colors.background }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.dangerHeader}>
              <Ionicons name="warning" size={25} color="#C93F4B" />
              <ThemedText type="subtitle" style={styles.confirmationTitle}>{t('settings.resetConfirmTitle')}</ThemedText>
            </View>
            <ThemedText style={styles.description}>{t('settings.resetConfirmInstruction')}</ThemedText>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              editable={!isResetting}
              onChangeText={setResetConfirmation}
              onSubmitEditing={() => { if (canReset) void confirmDataReset(); }}
              placeholder={t('settings.resetConfirmPlaceholder')}
              placeholderTextColor={colors.icon}
              returnKeyType="done"
              style={[styles.confirmationInput, { borderColor: colors.border, color: colors.text }]}
              value={resetConfirmation}
            />
            <View style={styles.confirmationActions}>
              <ActionButton
                title={t('common.cancel')}
                disabled={isResetting}
                onPress={closeResetModal}
                style={styles.confirmationAction}
              />
              <ActionButton
                title={isResetting ? t('settings.resettingData') : t('settings.resetForever')}
                disabled={!canReset || isResetting}
                onPress={() => { void confirmDataReset(); }}
                style={[styles.confirmationAction, styles.dangerButton]}
                textStyle={styles.dangerButtonText}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
    backgroundColor: '#C93F4B',
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
  groupCard: {
    paddingVertical: 2,
    gap: 0,
  },
  sectionTitle: {
    marginTop: 6,
    paddingHorizontal: 4,
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  description: {
    lineHeight: 21,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  settingCopy: {
    flex: 1,
    gap: 6,
  },
  languageSelector: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 3,
  },
  languageOption: {
    minWidth: 46,
    minHeight: 38,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  languageOptionText: {
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  settingsLink: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
    paddingVertical: 16,
  },
  reminderLink: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  dangerCard: {
    borderRadius: 12,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: '#C93F4B',
  },
  dangerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  dangerTitle: {
    color: '#C93F4B',
  },
  dangerButton: {
    backgroundColor: '#C93F4B',
    borderColor: '#C93F4B',
  },
  dangerButtonText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  confirmationDialog: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  confirmationTitle: {
    flex: 1,
  },
  confirmationInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    fontSize: 16,
    fontFamily: Fonts.regular,
  },
  confirmationActions: {
    flexDirection: 'row',
    gap: 10,
  },
  confirmationAction: {
    flex: 1,
  },
});
