import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import { Alert } from '@/lib/alert';
import type { DebtPlan, ManualDebt } from '@/lib/types';

const STATUS_LABEL: Record<DebtPlan['status'], string> = {
  projected: t('installments.statusProjected'), active: t('installments.statusActive'), completed: t('installments.statusCompleted'), cancelled: t('installments.statusCancelled'),
};

export default function DebtsScreen() {
  const { paymentMethodId } = useLocalSearchParams<{ paymentMethodId?: string }>();
  const methodId = paymentMethodId ? Number(paymentMethodId) : undefined;
  const { getDebtPlans, getManualDebts, paymentMethods } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const [manualDebts, setManualDebts] = useState<ManualDebt[]>([]);
  const load = useCallback(async () => {
    const [nextPlans, nextManualDebts] = await Promise.all([getDebtPlans(methodId), methodId == null ? getManualDebts() : Promise.resolve([])]);
    setPlans(nextPlans); setManualDebts(nextManualDebts);
  }, [getDebtPlans, getManualDebts, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));
  const method = paymentMethods.find((item) => item.id === methodId);
  const openNewDebt = () => Alert.alert(t('manualDebts.new'), t('manualDebts.chooseType'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('manualDebts.fixed'), onPress: () => router.push({ pathname: '/modal/manual-debt-form', params: { type: 'fixed' } }) },
    { text: t('manualDebts.variable'), onPress: () => router.push({ pathname: '/modal/manual-debt-form', params: { type: 'variable' } }) },
  ]);
  const activeManualDebts = manualDebts.filter((item) => item.status !== 'archived');
  const totalManualBalance = activeManualDebts.reduce((sum, item) => sum + item.currentBalance, 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{method ? t('installments.titleForMethod', { name: method.name }) : t('navigation.debts')}</ThemedText>
        <ThemedText style={styles.intro}>
          {method ? t('installments.intro') : t('manualDebts.debtsIntro')}
        </ThemedText>
        {methodId == null && (
          <>
            <ThemedView style={styles.summaryCard}>
              <ThemedText style={styles.secondary}>{t('manualDebts.manualDebtTotal')}</ThemedText>
              <ThemedText type="title">{formatCLP(totalManualBalance)}</ThemedText>
            </ThemedView>
            <Pressable onPress={openNewDebt} style={styles.primaryButton}>
              <Ionicons name="add" size={21} color="#fff" />
              <ThemedText style={styles.primaryText}>{t('manualDebts.new')}</ThemedText>
            </Pressable>
            <ThemedText type="subtitle">{t('manualDebts.manualDebts')}</ThemedText>
            {manualDebts.length === 0 && (
              <ThemedView style={styles.empty}>
                <Ionicons name="document-text-outline" size={34} color={colors.icon} />
                <ThemedText>{t('manualDebts.noManualDebts')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('manualDebts.noManualDebtsHint')}</ThemedText>
              </ThemedView>
            )}
            {manualDebts.map((debt) => (
              <Pressable key={debt.id} onPress={() => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(debt.id) } })}>
                <ThemedView style={[styles.card, debt.status === 'archived' && styles.archived]}>
                  <View style={styles.header}>
                    <View style={[styles.debtIcon, { backgroundColor: debt.type === 'fixed' ? '#0a7ea4' : '#d97706' }]}><Ionicons name={debt.type === 'fixed' ? 'calendar-outline' : 'analytics-outline'} size={17} color="#fff" /></View>
                    <View style={styles.copy}><ThemedText type="defaultSemiBold">{debt.name}</ThemedText><ThemedText style={styles.secondary}>{debt.creditor ?? (debt.type === 'fixed' ? t('manualDebts.fixed') : t('manualDebts.variable'))}</ThemedText></View>
                    <Ionicons name="chevron-forward" size={21} color={colors.icon} />
                  </View>
                  <View style={styles.row}><ThemedText>{t('manualDebts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
                  {debt.nextDueDate && <ThemedText style={styles.secondary}>{t('manualDebts.nextDueValue', { date: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${debt.nextDueDate}T12:00:00`)) })}</ThemedText>}
                  <ThemedText style={[styles.status, { color: debt.status === 'paid' ? '#2e9d63' : debt.status === 'archived' ? '#64748b' : colors.primary }]}>{debt.status === 'paid' ? t('manualDebts.statusPaid') : debt.status === 'archived' ? t('manualDebts.statusArchived') : t('manualDebts.statusActive')}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            <ThemedText type="subtitle" style={styles.sectionTitle}>{t('manualDebts.cardPurchases')}</ThemedText>
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
              <ThemedText style={[styles.status, { color: plan.status === 'active' ? '#2e9d63' : colors.primary }]}>{STATUS_LABEL[plan.status]}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 12 },
  intro: { opacity: 0.7, lineHeight: 20 }, empty: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 8 },
  card: { borderRadius: 12, padding: 15, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 16, height: 16, borderRadius: 6 }, copy: { flex: 1 }, secondary: { opacity: 0.62, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, status: { fontSize: 12, fontWeight: '700' },
  summaryCard: { borderRadius: 12, padding: 16, gap: 5 }, primaryButton: { minHeight: 48, borderRadius: 10, backgroundColor: '#0a7ea4', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, primaryText: { color: '#fff', fontWeight: '700' },
  debtIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, archived: { opacity: 0.62 }, sectionTitle: { marginTop: 6 },
});
