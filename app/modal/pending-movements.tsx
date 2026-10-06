import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { usePaymentDatabase, useRecurrenceDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { findPendingRecurringMatches } from '@/lib/notification-recurrence-match';
import {
  getPendingNotificationMovements,
  isNotificationMovementAccessEnabled,
  notificationMovementCaptureSupported,
  openNotificationMovementAccessSettings,
  pendingMovementHref,
  removePendingNotificationMovement,
  type PendingMovementCandidate,
} from '@/lib/notification-movements';
import { showToast } from '@/lib/toast';
import type { RecurringDecisionItem } from '@/lib/types';
import { ensurePushNotificationPermission } from '@/services/NotificationPreferencesService';

const typeIcons: Record<PendingMovementCandidate['suggestedType'], keyof typeof Ionicons.glyphMap> = {
  expense: 'arrow-up-circle-outline',
  income: 'arrow-down-circle-outline',
  'card-payment': 'card-outline',
  transfer: 'swap-horizontal-outline',
};

export default function PendingMovementsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const insets = useSafeAreaInsets();
  const { recurringDecisions, approveRecurringOccurrence } = useRecurrenceDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const { fontScale } = useWindowDimensions();
  const usesLargeText = fontScale >= 1.2;
  const [items, setItems] = useState<PendingMovementCandidate[]>([]);
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [approvingCandidateId, setApprovingCandidateId] = useState<string | null>(null);
  const [choosingCandidateId, setChoosingCandidateId] = useState<string | null>(null);
  const matchesByCandidateId = useMemo(() => new Map(
    items.map((candidate) => [
      candidate.id,
      findPendingRecurringMatches(candidate, recurringDecisions),
    ])
  ), [items, recurringDecisions]);
  const choosingCandidate = items.find((item) => item.id === choosingCandidateId) ?? null;
  const choosingMatches = choosingCandidateId == null
    ? []
    : matchesByCandidateId.get(choosingCandidateId) ?? [];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, enabled] = await Promise.all([
        getPendingNotificationMovements(),
        isNotificationMovementAccessEnabled(),
      ]);
      setItems(pending);
      setAccessEnabled(enabled);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void load();

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') void load();
    });

    return () => appStateSubscription.remove();
  }, [load]));

  const remove = (candidate: PendingMovementCandidate) => {
    Alert.alert(
      t('pendingMovements.deleteTitle'),
      t('pendingMovements.deleteQuestion', { name: candidate.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            void removePendingNotificationMovement(candidate.id).then(() => {
              setItems((current) => current.filter((item) => item.id !== candidate.id));
              showToast(t('pendingMovements.deleted'));
            });
          },
        },
      ]
    );
  };

  const approveCandidate = async (
    candidate: PendingMovementCandidate,
    decision: RecurringDecisionItem
  ) => {
    if (approvingCandidateId != null) return;
    setApprovingCandidateId(candidate.id);
    try {
      await approveRecurringOccurrence(decision.kind, decision.recurringId, decision.scheduledDate);
      await removePendingNotificationMovement(candidate.id);
      setItems((current) => current.filter((item) => item.id !== candidate.id));
      setChoosingCandidateId(null);
      showToast(t('pendingMovements.recurringApproved', { name: decision.name }));
    } catch (error) {
      Alert.alert(
        t('errors.couldNotSave'),
        error instanceof Error ? error.message : t('common.tryAgain')
      );
    } finally {
      setApprovingCandidateId(null);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {t('pendingMovements.intro')}
        </ThemedText>

        {!notificationMovementCaptureSupported ? (
          <ThemedView style={[styles.notice, { borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={26} color={colors.icon} />
            <ThemedText style={styles.noticeCopy}>{t('pendingMovements.unsupported')}</ThemedText>
          </ThemedView>
        ) : !accessEnabled ? (
          <ThemedView style={[styles.notice, { borderColor: colors.border }]}>
            <Ionicons name="notifications-outline" size={26} color={colors.action} />
            <View style={styles.noticeCopy}>
              <ThemedText type="subtitle">{t('pendingMovements.permissionTitle')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>{t('pendingMovements.permissionDescription')}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void ensurePushNotificationPermission()
                  .catch(() => undefined)
                  .finally(() => { void openNotificationMovementAccessSettings(); });
              }}
              style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary }, pressed && styles.pressed]}>
              <ThemedText style={[styles.primaryText, { color: colors.onPrimary }]}>{t('pendingMovements.openAccessSettings')}</ThemedText>
            </Pressable>
          </ThemedView>
        ) : (
          <ThemedView style={[styles.enabled, { borderColor: colors.success }]}>
            <Ionicons name="checkmark-circle-outline" size={22} color={colors.success} />
            <ThemedText>{t('pendingMovements.accessEnabled')}</ThemedText>
          </ThemedView>
        )}

        {loading ? (
          <ActivityIndicator color={colors.action} style={styles.loader} />
        ) : items.length === 0 ? (
          <ThemedView style={styles.empty}>
            <Ionicons name="file-tray-outline" size={40} color={colors.icon} />
            <ThemedText type="subtitle">{t('pendingMovements.empty')}</ThemedText>
            <ThemedText style={[styles.emptyHint, { color: colors.textSecondary }]}>{t('pendingMovements.emptyHint')}</ThemedText>
          </ThemedView>
        ) : items.map((candidate) => {
          const occurredAt = new Date(candidate.occurredAt);
          const recurringMatches = matchesByCandidateId.get(candidate.id) ?? [];
          return (
            <ThemedView key={candidate.id} style={[styles.card, { borderColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (recurringMatches.length === 1) {
                    void approveCandidate(candidate, recurringMatches[0]);
                  } else if (recurringMatches.length > 1) {
                    setChoosingCandidateId(candidate.id);
                  } else {
                    router.push(pendingMovementHref(candidate, paymentMethods));
                  }
                }}
                style={({ pressed }) => [styles.cardMain, usesLargeText && styles.cardMainLarge, pressed && styles.pressed]}>
                <Ionicons name={typeIcons[candidate.suggestedType]} size={27} color={colors.action} />
                <View style={styles.cardCopy}>
                  <ThemedText type="subtitle" numberOfLines={2}>{candidate.name}</ThemedText>
                  <ThemedText style={{ color: colors.textSecondary }}>
                    {t(`pendingMovements.types.${candidate.suggestedType}`)} · {candidate.sourceApp}
                  </ThemedText>
                  <ThemedText style={{ color: colors.textSecondary }}>
                    {formatDate(occurredAt)} · {formatTime(occurredAt)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.amount, usesLargeText && styles.amountLarge]}>{formatCLP(candidate.amount)}</ThemedText>
              </Pressable>
              {recurringMatches.length > 0 && (
                <View style={[styles.matchActions, { borderTopColor: colors.border }]}>
                  <ThemedText style={[styles.matchHint, { color: colors.textSecondary }]}>
                    {t(recurringMatches.length === 1
                      ? 'pendingMovements.recurringMatchFound'
                      : 'pendingMovements.multipleRecurringMatches')}
                  </ThemedText>
                  <Pressable
                    accessibilityRole="button"
                    disabled={approvingCandidateId != null}
                    onPress={() => {
                      if (recurringMatches.length === 1) {
                        void approveCandidate(candidate, recurringMatches[0]);
                      } else {
                        setChoosingCandidateId(candidate.id);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.matchButton,
                      { backgroundColor: colors.primary },
                      pressed && styles.pressed,
                    ]}>
                    {approvingCandidateId === candidate.id ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <ThemedText style={[styles.primaryText, { color: colors.onPrimary }]}>
                        {recurringMatches.length === 1
                          ? t('pendingMovements.approveRecurring', { name: recurringMatches[0].name })
                          : t('pendingMovements.chooseRecurring')}
                      </ThemedText>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={approvingCandidateId != null}
                    onPress={() => router.push(pendingMovementHref(candidate, paymentMethods))}
                    style={({ pressed }) => [
                      styles.separateButton,
                      { borderColor: colors.border },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="defaultSemiBold">{t('pendingMovements.registerSeparate')}</ThemedText>
                  </Pressable>
                </View>
              )}
              <Pressable
                accessibilityLabel={t('pendingMovements.deleteAccessibility', { name: candidate.name })}
                accessibilityRole="button"
                hitSlop={10}
                onPress={() => remove(candidate)}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                <Ionicons name="trash-outline" size={22} color={colors.danger} />
              </Pressable>
            </ThemedView>
          );
        })}
      </ScrollView>
      <Modal
        animationType="slide"
        transparent
        visible={choosingCandidate != null}
        onRequestClose={() => setChoosingCandidateId(null)}>
        <Pressable style={styles.overlay} onPress={() => setChoosingCandidateId(null)}>
          <Pressable style={styles.sheetPosition} onPress={(event) => event.stopPropagation()}>
            <ThemedView
              accessibilityViewIsModal
              style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
              <View style={styles.handle} />
              <ThemedText type="subtitle">{t('pendingMovements.chooseRecurringTitle')}</ThemedText>
              <ThemedText style={{ color: colors.textSecondary }}>
                {t('pendingMovements.chooseRecurringDescription')}
              </ThemedText>
              {choosingCandidate && choosingMatches.map((decision) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={approvingCandidateId != null}
                  key={`${decision.kind}-${decision.recurringId}-${decision.scheduledDate}`}
                  onPress={() => { void approveCandidate(choosingCandidate, decision); }}
                  style={({ pressed }) => [
                    styles.choice,
                    { borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <View style={styles.choiceCopy}>
                    <ThemedText type="defaultSemiBold">{decision.name}</ThemedText>
                    <ThemedText style={{ color: colors.textSecondary }}>{formatCLP(decision.amount)}</ThemedText>
                  </View>
                  <Ionicons name="checkmark-circle-outline" size={23} color={colors.primary} />
                </Pressable>
              ))}
              <Pressable
                accessibilityRole="button"
                onPress={() => setChoosingCandidateId(null)}
                style={[styles.separateButton, { borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold">{t('common.close')}</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  intro: { lineHeight: 24 },
  notice: { borderWidth: 1, borderRadius: LayoutTokens.radiusLarge, padding: 16, gap: 12 },
  noticeCopy: { flex: 1, gap: 4 },
  enabled: { borderWidth: 1, borderRadius: LayoutTokens.radiusMedium, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  primaryButton: { minHeight: 48, borderRadius: LayoutTokens.radiusMedium, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryText: { fontFamily: Fonts.bold, textAlign: 'center' },
  loader: { marginTop: 36 },
  empty: { alignItems: 'center', paddingVertical: 44, gap: 10 },
  emptyHint: { textAlign: 'center' },
  card: { borderWidth: 1, borderRadius: LayoutTokens.radiusLarge, overflow: 'hidden' },
  cardMain: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  cardMainLarge: { alignItems: 'flex-start', flexWrap: 'wrap' },
  cardCopy: { flex: 1, minWidth: 0, gap: 3 },
  amount: { fontFamily: Fonts.bold, flexShrink: 0 },
  amountLarge: { marginLeft: 39 },
  deleteButton: { alignSelf: 'flex-end', minWidth: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  matchActions: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
  matchHint: { lineHeight: 20 },
  matchButton: { minHeight: 48, borderRadius: LayoutTokens.radiusMedium, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  separateButton: { minHeight: 48, borderWidth: 1, borderRadius: LayoutTokens.radiusMedium, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetPosition: { width: '100%', maxHeight: '82%', flexShrink: 1 },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 12, maxHeight: '100%', flexShrink: 1 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#60758E', opacity: 0.55, alignSelf: 'center' },
  choice: { minHeight: 58, borderWidth: 1, borderRadius: LayoutTokens.radiusMedium, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  choiceCopy: { flex: 1, gap: 2 },
  pressed: { opacity: 0.65 },
});
