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
import { formatMoney } from '@/lib/format';
import { showToast } from '@/lib/toast';
import type { FinancialAuditEntry } from '@/lib/types';
import { deleteFinancialAuditEntry, getFinancialAuditLog, restoreFinancialAuditEntry } from '@/repositories';

function formatMoment(value: string): string {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(APP_LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatChangeValue(entry: FinancialAuditEntry, field: FinancialAuditEntry['changes'][number]['field'], value: string | null): string {
  if (value == null || value.trim() === '') return t('financialAudit.noValue');
  if (field === 'amount' || field === 'originalAmount') {
    const amount = Number(value);
    return Number.isFinite(amount) ? formatMoney(amount, entry.currency) : value;
  }
  if (field === 'splitPercentage') return `${value}%`;
  return value;
}

function entryIcon(entry: FinancialAuditEntry): keyof typeof Ionicons.glyphMap {
  if (entry.action === 'created') return 'add-circle-outline';
  if (entry.action === 'updated') return 'create-outline';
  if (entry.action === 'deleted') return 'trash-outline';
  return 'refresh-outline';
}

export default function FinancialAuditScreen() {
  const colors = Colors[useColorScheme() ?? 'light'];
  const { refresh } = usePeriodDatabase();
  const [entries, setEntries] = useState<FinancialAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<{ id: number; action: 'restore' | 'delete' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getFinancialAuditLog()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const restore = (entry: FinancialAuditEntry) => {
    const isCreation = entry.action === 'created';
    const isUndo = entry.action === 'updated' || isCreation;
    const titleKey = isCreation ? 'financialAudit.undoCreationTitle' : isUndo ? 'financialAudit.undoTitle' : 'financialAudit.restoreTitle';
    const messageKey = isCreation ? 'financialAudit.undoCreationMessage' : isUndo ? 'financialAudit.undoMessage' : 'financialAudit.restoreMessage';
    const buttonKey = isCreation ? 'financialAudit.undoCreation' : isUndo ? 'financialAudit.undo' : 'financialAudit.restore';
    Alert.alert(t(titleKey), t(messageKey, { name: entry.title }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t(buttonKey),
        onPress: () => {
          setWorking({ id: entry.id, action: 'restore' });
          void restoreFinancialAuditEntry(entry.id)
            .then(refresh)
            .then(load)
            .then(() => showToast(t(isCreation ? 'financialAudit.creationUndoneToast' : isUndo ? 'financialAudit.undoneToast' : 'financialAudit.restoredToast')))
            .catch((error: unknown) => showToast(error instanceof Error ? error.message : t('common.tryAgain')))
            .finally(() => setWorking(null));
        },
      },
    ]);
  };

  const removePermanently = (entry: FinancialAuditEntry) => {
    Alert.alert(
      t('financialAudit.deleteTitle'),
      t(entry.action === 'restored'
        ? 'financialAudit.deleteRestoredMessage'
        : 'financialAudit.deleteDeletedMessage', { name: entry.title }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('financialAudit.deletePermanently'),
          style: 'destructive',
          onPress: () => {
            setWorking({ id: entry.id, action: 'delete' });
            void deleteFinancialAuditEntry(entry.id)
              .then(load)
              .then(() => showToast(t('financialAudit.deletedToast')))
              .catch((error: unknown) => showToast(error instanceof Error ? error.message : t('common.tryAgain')))
              .finally(() => setWorking(null));
          },
        },
      ]
    );
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
                  name={entryIcon(entry)}
                  size={20}
                  color={entry.action === 'deleted' ? colors.danger : entry.action === 'created' ? colors.savings : colors.primary}
                />
              </View>
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold" numberOfLines={2}>{entry.title}</ThemedText>
                <ThemedText style={{ color: colors.textSecondary }}>
                  {t(`financialAudit.actions.${entry.action}`)} · {t(`financialAudit.entities.${entry.entityType}`)} · {formatMoney(entry.amount, entry.currency)}
                </ThemedText>
                <ThemedText style={[styles.meta, { color: colors.textSecondary }]}>
                  {formatMoment(entry.createdAt)}
                </ThemedText>
              </View>
            </View>
            {entry.changes.length > 0 && (
              <View style={[styles.changes, { borderTopColor: colors.border }]}>
                {entry.changes.map((change) => (
                  <View key={change.field} style={styles.changeRow}>
                    <ThemedText style={[styles.changeLabel, { color: colors.textSecondary }]}>
                      {t(`financialAudit.fields.${change.field}`)}
                    </ThemedText>
                    <ThemedText style={styles.changeValue} numberOfLines={2}>
                      {formatChangeValue(entry, change.field, change.before)} → {formatChangeValue(entry, change.field, change.after)}
                    </ThemedText>
                  </View>
                ))}
              </View>
            )}
            {(entry.action === 'created' || entry.action === 'deleted' || entry.action === 'updated') && entry.restorable && entry.restoredAt == null && (
              <Pressable
                accessibilityRole="button"
                disabled={working != null}
                onPress={() => restore(entry)}
                style={({ pressed }) => [styles.restore, { borderColor: colors.primary }, pressed && styles.pressed]}>
                {working?.id === entry.id && working.action === 'restore' && <ActivityIndicator size="small" color={colors.primary} />}
                <ThemedText style={[styles.restoreText, { color: colors.primary }]}>
                  {t(entry.action === 'created' ? 'financialAudit.undoCreation' : entry.action === 'updated' ? 'financialAudit.undo' : 'financialAudit.restore')}
                </ThemedText>
              </Pressable>
            )}
            {(entry.action === 'created' || entry.action === 'deleted' || entry.action === 'updated') && !entry.restorable && entry.restoredAt == null && entry.restrictionReason != null && (
              <ThemedText style={[styles.restriction, { color: colors.textSecondary }]}>
                {t('financialAudit.linkedRestriction')}
              </ThemedText>
            )}
            {(entry.action === 'deleted' || entry.action === 'restored') && (
              <Pressable
                accessibilityRole="button"
                disabled={working != null}
                onPress={() => removePermanently(entry)}
                style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}>
                {working?.id === entry.id && working.action === 'delete' && <ActivityIndicator size="small" color={colors.danger} />}
                <Ionicons name="trash-outline" size={17} color={colors.danger} />
                <ThemedText style={[styles.deleteText, { color: colors.danger }]}>{t('financialAudit.deletePermanently')}</ThemedText>
              </Pressable>
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
  changes: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 7 },
  changeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  changeLabel: { width: 96, fontSize: 12 },
  changeValue: { flex: 1, fontSize: 12, textAlign: 'right' },
  restore: { minHeight: 44, borderWidth: 1, borderRadius: 12, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  restoreText: { fontFamily: Fonts.semiBold },
  deleteButton: { minHeight: 32, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'flex-end', alignSelf: 'flex-end' },
  deleteText: { fontFamily: Fonts.semiBold, fontSize: 12 },
  restriction: { fontSize: 13, lineHeight: 18 },
  pressed: { opacity: 0.7 },
});
