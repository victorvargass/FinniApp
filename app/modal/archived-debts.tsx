import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDebtDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Debt } from '@/lib/types';

export default function ArchivedDebtsScreen() {
  const { getDebts } = useDebtDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [debts, setDebts] = useState<Debt[]>([]);

  const load = useCallback(async () => {
    const rows = await getDebts();
    setDebts(rows.filter((item) => item.status === 'archived'));
  }, [getDebts]);

  useFocusEffect(useCallback(() => {
    load().catch(() => undefined);
  }, [load]));

  const renderDebt = (debt: Debt) => (
    <ThemedView key={debt.id} style={[styles.card, { borderColor: colors.border }]}>
      <Pressable
        accessibilityLabel={`${debt.name}, ${debt.currentBalance <= 0 ? t('debts.statusPaid') : `${t('debts.currentBalance')}: ${formatCLP(debt.currentBalance)}`}`}
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(debt.id) } })}
        style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}>
        <View style={[
          styles.icon,
          { backgroundColor: debt.direction === 'receivable' ? '#20A486' : debt.type === 'fixed' ? '#0B315B' : '#D88916' },
        ]}>
          <Ionicons
            color="#fff"
            name={debt.direction === 'receivable' ? 'arrow-down-outline' : debt.type === 'fixed' ? 'calendar-outline' : 'analytics-outline'}
            size={18}
          />
        </View>
        <View style={styles.copy}>
          <ThemedText type="defaultSemiBold">{debt.name}</ThemedText>
          <ThemedText style={styles.secondary}>
            {debt.contactName ?? debt.creditor ?? t('common.notSpecified')}
          </ThemedText>
          {debt.currentBalance <= 0 ? (
            <ThemedText style={styles.paid}>{t('debts.statusPaid')}</ThemedText>
          ) : (
            <View style={styles.balanceRow}>
              <ThemedText style={styles.secondary}>{t('debts.currentBalance')}</ThemedText>
              <ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={21} color={colors.icon} />
      </Pressable>
    </ThemedView>
  );

  const payable = debts.filter((item) => item.direction === 'payable');
  const receivable = debts.filter((item) => item.direction === 'receivable');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={[styles.content, debts.length === 0 && styles.emptyContent]}>
        {debts.length === 0 ? (
          <EmptyState
            description={t('debts.archivedDescription')}
            icon="archive-outline"
            title={t('debts.noArchived')}
          />
        ) : (
          <>
            <ThemedText style={[styles.intro, { color: colors.textSecondary }]}>
              {t('debts.archivedDescription')}
            </ThemedText>
            {payable.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="subtitle">{t('debts.payableSection')}</ThemedText>
                {payable.map(renderDebt)}
              </View>
            )}
            {receivable.length > 0 && (
              <View style={styles.section}>
                <ThemedText type="subtitle">{t('debts.receivableSection')}</ThemedText>
                {receivable.map(renderDebt)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 42, gap: 18 },
  emptyContent: { flexGrow: 1, justifyContent: 'center' },
  intro: { lineHeight: 21 },
  section: { gap: 10 },
  card: { borderWidth: 1, borderRadius: 13, padding: 14 },
  cardMain: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 2 },
  secondary: { opacity: 0.64, fontSize: 12 },
  balanceRow: { marginTop: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  paid: { marginTop: 4, color: '#1FAF78', fontWeight: '800' },
  pressed: { opacity: 0.62 },
});
