import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/lib/i18n';
import { BACKUP_SKIPPED_KEY, SETUP_COMPLETE_KEY } from '@/lib/setup-progress';
import { GoogleAuthService } from '@/services/GoogleAuthService';

type ProgressiveSetupProps = {
  hasConfiguredPeriod: boolean;
  hasAdditionalPaymentMethod: boolean;
  hasAdditionalCategory: boolean;
  hasMovements: boolean;
  onOpenPeriod: () => void;
  onOpenPaymentMethods: () => void;
  onOpenCategories: () => void;
  onAddMovement: () => void;
  onOpenBackup: () => void;
};

export function ProgressiveSetup({
  hasConfiguredPeriod,
  hasAdditionalPaymentMethod,
  hasAdditionalCategory,
  hasMovements,
  onOpenPeriod,
  onOpenPaymentMethods,
  onOpenCategories,
  onAddMovement,
  onOpenBackup,
}: ProgressiveSetupProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const [loaded, setLoaded] = useState(false);
  const [completedPermanently, setCompletedPermanently] = useState(false);
  const [backupSkipped, setBackupSkipped] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(SETUP_COMPLETE_KEY), AsyncStorage.getItem(BACKUP_SKIPPED_KEY)])
      .then(([complete, skipped]) => {
        if (!active) return;
        setCompletedPermanently(complete === 'true');
        setBackupSkipped(skipped === 'true');
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => { active = false; };
  }, []);

  useFocusEffect(useCallback(() => {
    setGoogleConnected(Boolean(GoogleAuthService.getCurrentUser()));
  }, []));

  const backupReady = googleConnected || backupSkipped;
  const steps = useMemo(() => [
    { key: 'period', label: t('setup.period'), complete: hasConfiguredPeriod, onPress: onOpenPeriod },
    { key: 'payment', label: t('setup.paymentMethod'), complete: hasAdditionalPaymentMethod, onPress: onOpenPaymentMethods },
    { key: 'categories', label: t('setup.categories'), complete: hasAdditionalCategory, onPress: onOpenCategories },
    { key: 'movement', label: t('setup.firstMovement'), complete: hasMovements, onPress: onAddMovement },
    { key: 'backup', label: t('setup.backup'), complete: backupReady, onPress: onOpenBackup, optional: true },
  ], [
    backupReady,
    hasAdditionalCategory,
    hasAdditionalPaymentMethod,
    hasConfiguredPeriod,
    hasMovements,
    onAddMovement,
    onOpenBackup,
    onOpenCategories,
    onOpenPaymentMethods,
    onOpenPeriod,
  ]);
  const completedCount = steps.filter((step) => step.complete).length;

  useEffect(() => {
    if (!loaded || completedPermanently || completedCount !== steps.length) return;
    setCompletedPermanently(true);
    void AsyncStorage.setItem(SETUP_COMPLETE_KEY, 'true');
  }, [completedCount, completedPermanently, loaded, steps.length]);

  if (!loaded || completedPermanently) return null;

  return (
    <ThemedView style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <ThemedText type="subtitle">{t('setup.title')}</ThemedText>
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
            {t('setup.progress', { complete: completedCount, total: steps.length })}
          </ThemedText>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: `${colors.secondary}22` }]}>
          <ThemedText style={[styles.progressText, { color: colors.action }]}>
            {Math.round((completedCount / steps.length) * 100)}%
          </ThemedText>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.secondary, width: `${(completedCount / steps.length) * 100}%` },
          ]}
        />
      </View>

      <View style={styles.steps}>
        {steps.map((step) => (
          <Pressable
            accessibilityRole="button"
            disabled={step.complete}
            key={step.key}
            onPress={step.onPress}
            style={({ pressed }) => [styles.step, pressed && styles.pressed]}>
            <Ionicons
              name={step.complete ? 'checkmark-circle' : 'ellipse-outline'}
              size={23}
              color={step.complete ? colors.success : colors.icon}
            />
            <ThemedText style={[styles.stepLabel, step.complete && styles.completedLabel]}>
              {step.label}
            </ThemedText>
            {'optional' in step && step.optional && !step.complete && (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={(event) => {
                  event.stopPropagation();
                  setBackupSkipped(true);
                  void AsyncStorage.setItem(BACKUP_SKIPPED_KEY, 'true');
                }}>
                <ThemedText style={[styles.skip, { color: colors.action }]}>{t('setup.skipForNow')}</ThemedText>
              </Pressable>
            )}
            {!step.complete && !('optional' in step && step.optional) && (
              <Ionicons name="chevron-forward" size={19} color={colors.icon} />
            )}
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerCopy: { flex: 1, gap: 2 },
  hint: { fontSize: 13, lineHeight: 18 },
  progressBadge: { minWidth: 48, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  progressText: { fontFamily: Fonts.bold, fontSize: 13 },
  progressTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  steps: { gap: 2 },
  step: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  stepLabel: { flex: 1, fontFamily: Fonts.medium },
  completedLabel: { opacity: 0.58, textDecorationLine: 'line-through' },
  skip: { fontFamily: Fonts.semiBold, fontSize: 12 },
  pressed: { opacity: 0.65 },
});
