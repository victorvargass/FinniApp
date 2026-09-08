import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import type { Debt, DebtPlan } from '@/lib/types';

const STATUS_LABEL: Record<DebtPlan['status'], string> = {
  projected: t('installments.statusProjected'), active: t('installments.statusActive'), completed: t('installments.statusCompleted'), cancelled: t('installments.statusCancelled'),
};

export default function DebtsScreen() {
  const { paymentMethodId } = useLocalSearchParams<{ paymentMethodId?: string }>();
  const methodId = paymentMethodId ? Number(paymentMethodId) : undefined;
  const { getDebtPlans, getDebts, paymentMethods } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const load = useCallback(async () => {
    const [nextPlans, nextDebts] = await Promise.all([getDebtPlans(methodId), methodId == null ? getDebts() : Promise.resolve([])]);
    setPlans(nextPlans); setDebts(nextDebts);
  }, [getDebtPlans, getDebts, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));
  const method = paymentMethods.find((item) => item.id === methodId);
  const activeDebts = debts.filter((item) => item.status !== 'archived');
  const totalDebtBalance = activeDebts.reduce((sum, item) => sum + item.currentBalance, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {method && <ThemedText type="title">{t('installments.titleForMethod', { name: method.name })}</ThemedText>}
        <ThemedText style={styles.intro}>
          {method ? t('installments.intro') : t('debts.intro')}
        </ThemedText>
        {methodId == null && (
          <>
            <ThemedView style={styles.summaryCard}>
              <ThemedText style={styles.secondary}>{t('debts.totalBalance')}</ThemedText>
              <ThemedText type="title">{formatCLP(totalDebtBalance)}</ThemedText>
            </ThemedView>
            <ThemedText type="subtitle">{t('debts.title')}</ThemedText>
            {debts.length === 0 && (
              <ThemedView style={styles.empty}>
                <Ionicons name="document-text-outline" size={34} color={colors.icon} />
                <ThemedText>{t('debts.empty')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('debts.emptyHint')}</ThemedText>
              </ThemedView>
            )}
            {debts.map((debt) => (
              <Pressable key={debt.id} onPress={() => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(debt.id) } })}>
                <ThemedView style={[styles.card, debt.status === 'archived' && styles.archived]}>
                  <View style={styles.header}>
                    <View style={[styles.debtIcon, { backgroundColor: debt.type === 'fixed' ? '#0B315B' : '#D88916' }]}><Ionicons name={debt.type === 'fixed' ? 'calendar-outline' : 'analytics-outline'} size={17} color="#fff" /></View>
                    <View style={styles.copy}><ThemedText type="defaultSemiBold">{debt.name}</ThemedText><ThemedText style={styles.secondary}>{debt.creditor ?? (debt.type === 'fixed' ? t('debts.fixed') : t('debts.variable'))}</ThemedText></View>
                    <Ionicons name="chevron-forward" size={21} color={colors.icon} />
                  </View>
                  <View style={styles.row}><ThemedText>{t('debts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
                  {debt.nextDueDate && <ThemedText style={styles.secondary}>{t('debts.nextDueValue', { date: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${debt.nextDueDate}T12:00:00`)) })}</ThemedText>}
                  <ThemedText style={[styles.status, { color: debt.status === 'paid' ? '#1FAF78' : debt.status === 'archived' ? '#60758E' : colors.primary }]}>{debt.status === 'paid' ? t('debts.statusPaid') : debt.status === 'archived' ? t('debts.statusArchived') : t('debts.statusActive')}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            <ThemedText type="subtitle" style={styles.sectionTitle}>{t('debts.cardPurchases')}</ThemedText>
          </>
        )}
        {plans.length === 0 && (
          <ThemedView style={styles.empty}>
            <Ionicons name="wallet-outline" size={34} color={colors.icon} />
            <ThemedText>{t('installments.noPurchases')}</ThemedText>
            <ThemedText style={styles.secondary}>{t('installments.createHint')}</ThemedText>
          </ThemedView>
        )}
        {plans.map((plan) => (
          <Pressable key={plan.id} onPress={() => router.push({ pathname: '/modal/debt-detail', params: { id: String(plan.id) } })}>
            <ThemedView style={styles.card}>
              <View style={styles.header}>
                <View style={[styles.dot, { backgroundColor: plan.paymentMethodColor }]} />
                <View style={styles.copy}>
                  <ThemedText type="defaultSemiBold">{plan.name}</ThemedText>
                  <ThemedText style={styles.secondary}>{plan.paymentMethodName}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={21} color={colors.icon} />
              </View>
              <View style={styles.row}><ThemedText>{t('installments.progress')}</ThemedText><ThemedText type="defaultSemiBold">{t('installments.progressValue', { posted: plan.postedInstallments, total: plan.totalInstallments })}</ThemedText></View>
              <View style={styles.row}><ThemedText>{t('installments.projectedBalance')}</ThemedText><ThemedText>{formatCLP(plan.remainingAmount)}</ThemedText></View>
              <ThemedText style={[styles.status, { color: plan.status === 'active' ? '#1FAF78' : colors.primary }]}>{STATUS_LABEL[plan.status]}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
      {methodId == null && (
        <FloatingActionButton
          accessibilityLabel={t('debts.new')}
          avoidBottomInset
          href="/modal/manual-debt-form"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 110, gap: 12 },
  intro: { opacity: 0.7, lineHeight: 20 }, empty: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 8 },
  card: { borderRadius: 12, padding: 15, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 16, height: 16, borderRadius: 6 }, copy: { flex: 1 }, secondary: { opacity: 0.62, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, status: { fontSize: 12, fontWeight: '700' },
  summaryCard: { borderRadius: 12, padding: 16, gap: 5 },
  debtIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, archived: { opacity: 0.62 }, sectionTitle: { marginTop: 6 },
});
