import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, formatTime } from '@/lib/format';
import { t } from '@/lib/i18n';
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
import { ensurePushNotificationPermission } from '@/services/NotificationPreferencesService';

const typeIcons: Record<PendingMovementCandidate['suggestedType'], keyof typeof Ionicons.glyphMap> = {
  expense: 'arrow-up-circle-outline',
  income: 'arrow-down-circle-outline',
  'card-payment': 'card-outline',
  transfer: 'swap-horizontal-outline',
};

export default function PendingMovementsScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { fontScale } = useWindowDimensions();
  const usesLargeText = fontScale >= 1.2;
  const [items, setItems] = useState<PendingMovementCandidate[]>([]);
  const [accessEnabled, setAccessEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

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
          return (
            <ThemedView key={candidate.id} style={[styles.card, { borderColor: colors.border }]}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(pendingMovementHref(candidate))}
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
  pressed: { opacity: 0.65 },
});
