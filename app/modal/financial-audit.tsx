import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { APP_LOCALE, t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { FinancialAuditEntry } from '@/lib/types';
import { getFinancialAuditLog, restoreFinancialAuditEntry } from '@/repositories';

function formatMoment(value: string): string {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat(APP_LOCALE, {
    style: 'currency', currency: 'CLP', maximumFractionDigits: 0,
  }).format(value);
}

export default function FinancialAuditScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { refresh } = usePeriodDatabase();
  const [entries, setEntries] = useState<FinancialAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getFinancialAuditLog()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const restore = (entry: FinancialAuditEntry) => {
    Alert.alert(t('financialAudit.restoreTitle'), t('financialAudit.restoreMessage', { name: entry.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('financialAudit.restore'),
        onPress: () => {
          setRestoringId(entry.id);
          void restoreFinancialAuditEntry(entry.id)
            .then(refresh)
            .then(load)
            .then(() => showToast(t('financialAudit.restoredToast')))
            .catch((error: unknown) => showToast(error instanceof Error ? error.message : t('common.tryAgain')))
            .finally(() => setRestoringId(null));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
          {t('financialAudit.description')}
        </ThemedText>
        <ThemedView style={[styles.notice, { borderColor: colors.border }]}>
          <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
          <ThemedText style={[styles.noticeCopy, { color: colors.textSecondary }]}>
            {t('financialAudit.recoveryRule')}
          </ThemedText>
        </ThemedView>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : entries.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-circle-outline" size={42} color={colors.savings} />
            <ThemedText type="subtitle">{t('financialAudit.empty')}</ThemedText>
          </View>
        ) : entries.map((entry) => (
          <ThemedView key={entry.id} style={[styles.card, { borderColor: colors.border }]}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: colors.surfaceRaised }]}>
                <Ionicons
                  name={entry.action === 'restored' ? 'refresh-outline' : entry.entityType === 'expense' ? 'arrow-up-outline' : 'arrow-down-outline'}
                  size={20}
                  color={entry.entityType === 'expense' ? colors.danger : colors.savings}
                />
              </View>
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold" numberOfLines={2}>{entry.title}</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>
                  {t(`financialAudit.actions.${entry.action}`)} · {formatAmount(entry.amount)}
                </ThemedText>
                <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                  {formatMoment(entry.createdAt)}
                </ThemedText>
              </View>
            </View>
            {entry.action === 'deleted' && entry.restorable && (
              <Pressable
                accessibilityRole="button"
                disabled={restoringId != null}
                onPress={() => restore(entry)}
                style={({ pressed }) => [styles.restore, { borderColor: colors.primary }, pressed && styles.pressed]}>
                {restoringId === entry.id && <ActivityIndicator size="small" color={colors.primary} />}
                <ThemedText style={[styles.restoreText, { color: colors.primary }]}>{t('financialAudit.restore')}</ThemedText>
              </Pressable>
            )}
            {entry.action === 'deleted' && !entry.restorable && entry.restoredAt == null && (
              <ThemedText style={[styles.restriction, { color: colors.textSecondary }]}>
                {t('financialAudit.linkedRestriction')}
              </ThemedText>
            )}
          </ThemedView>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 14 },
  intro: { fontSize: 16, lineHeight: 23 },
  notice: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  noticeCopy: { flex: 1, lineHeight: 20 },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  card: { borderWidth: 1, borderRadius: 15, padding: 14, gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  meta: { fontSize: 12 },
  restore: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: Fonts.semiBold },
  restriction: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
