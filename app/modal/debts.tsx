import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import { APP_LOCALE, t } from '@/lib/i18n';
import type { Debt, DebtPlan } from '@/lib/types';

function statusLabel(status: DebtPlan['status']): string {
  const keys: Record<DebtPlan['status'], Parameters<typeof t>[0]> = {
    projected: 'installments.statusProjected',
    active: 'installments.statusActive',
    completed: 'installments.statusCompleted',
    cancelled: 'installments.statusCancelled',
  };
  return t(keys[status]);
}

export default function DebtsScreen() {
  const { paymentMethodId } = useLocalSearchParams<{ paymentMethodId?: string }>();
  const methodId = paymentMethodId ? Number(paymentMethodId) : undefined;
  const { getDebtPlans, getDebts, paymentMethods } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const guide = useFeatureGuide('debts');
  const guideSlides = [
    {
      icon: 'documents-outline' as const,
      title: t('featureGuides.debts.typesTitle'),
      body: t('featureGuides.debts.typesBody'),
    },
    {
      icon: 'card-outline' as const,
      title: t('featureGuides.debts.installmentsTitle'),
      body: t('featureGuides.debts.installmentsBody'),
    },
    {
      icon: 'cash-outline' as const,
      title: t('featureGuides.debts.paymentsTitle'),
      body: t('featureGuides.debts.paymentsBody'),
    },
  ];
  const load = useCallback(async () => {
    const [nextPlans, nextDebts] = await Promise.all([getDebtPlans(methodId), methodId == null ? getDebts() : Promise.resolve([])]);
    setPlans(nextPlans); setDebts(nextDebts);
  }, [getDebtPlans, getDebts, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));
  const method = paymentMethods.find((item) => item.id === methodId);
  const creditCards = paymentMethods.filter((item) => item.type === 'credit');
  const activeDebts = debts.filter((item) => item.status !== 'archived');
  const totalDebtBalance = activeDebts.reduce((sum, item) => sum + item.currentBalance, 0)
    + creditCards.reduce((sum, item) => sum + (item.usedAmount ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        {method && <ThemedText type="title">{method.name}</ThemedText>}
        <View style={styles.guideHeader}>
          <ThemedText style={[styles.intro, styles.guideTitle]}>
            {method ? t('installments.intro') : t('debts.intro')}
          </ThemedText>
          <FeatureGuideButton onPress={guide.open} />
        </View>
        {methodId == null && (
          <>
            <ThemedView style={styles.summaryCard}>
              <ThemedText style={styles.secondary}>{t('debts.totalFinancialDebt')}</ThemedText>
              <ThemedText type="title">{formatCLP(totalDebtBalance)}</ThemedText>
            </ThemedView>
            <View style={styles.sectionHeading}>
              <View style={styles.copy}><ThemedText type="subtitle">{t('debts.creditCards')}</ThemedText><ThemedText style={styles.secondary}>{t('debts.creditCardsHint')}</ThemedText></View>
            </View>
            {creditCards.map((card) => (
              <Pressable key={`card-${card.id}`} onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(card.id) } })}>
                <ThemedView style={styles.card}>
                  <View style={styles.header}>
                    <View style={[styles.debtIcon, { backgroundColor: card.color }]}><Ionicons name="card-outline" size={18} color="#fff" /></View>
                    <View style={styles.copy}><ThemedText type="defaultSemiBold">{card.name}</ThemedText><ThemedText style={styles.secondary}>{t('paymentMethods.availableCredit')}: {card.availableBalance == null ? '—' : formatCLP(card.availableBalance)}</ThemedText></View>
                    <Ionicons name="chevron-forward" size={21} color={colors.icon} />
                  </View>
                  <View style={styles.row}><ThemedText>{t('paymentMethods.used')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(card.usedAmount ?? 0)}</ThemedText></View>
                  <View style={styles.row}><ThemedText>{t('paymentMethods.billedToPay')}</ThemedText><ThemedText>{formatCLP(card.billedAmount)}</ThemedText></View>
                </ThemedView>
              </Pressable>
            ))}
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
        {method?.type === 'credit' && (
          <ThemedView style={styles.methodSummary}>
            <View style={styles.row}><ThemedText>{t('paymentMethods.availableCredit')}</ThemedText><ThemedText type="defaultSemiBold">{method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}</ThemedText></View>
            <View style={styles.row}><ThemedText>{t('paymentMethods.used')}</ThemedText><ThemedText>{formatCLP(method.usedAmount ?? 0)}</ThemedText></View>
            <View style={styles.methodActions}>
              <Pressable onPress={() => router.push({ pathname: '/modal/expense-form', params: { creditPaymentTargetId: String(method.id) } })} style={[styles.methodButton, { backgroundColor: colors.action }]}><ThemedText style={{ color: colors.onSecondary, fontWeight: '700' }}>{t('paymentMethods.payCard')}</ThemedText></Pressable>
              <Pressable onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(method.id) } })} style={[styles.methodButton, { borderColor: colors.border, borderWidth: 1 }]}><ThemedText type="defaultSemiBold">{t('paymentMethods.account')}</ThemedText></Pressable>
            </View>
          </ThemedView>
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
              <ThemedText style={[styles.status, { color: plan.status === 'active' ? '#1FAF78' : colors.primary }]}>{statusLabel(plan.status)}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
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
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, guideTitle: { flex: 1 },
  intro: { opacity: 0.7, lineHeight: 20 }, empty: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 8 },
  card: { borderRadius: 12, padding: 15, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 16, height: 16, borderRadius: 6 }, copy: { flex: 1 }, secondary: { opacity: 0.62, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, status: { fontSize: 12, fontWeight: '700' },
  summaryCard: { borderRadius: 12, padding: 16, gap: 5 },
  debtIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, archived: { opacity: 0.62 }, sectionTitle: { marginTop: 6 },
  sectionHeading: { marginTop: 4 }, methodSummary: { borderRadius: 12, padding: 16, gap: 10 }, methodActions: { flexDirection: 'row', gap: 10 }, methodButton: { flex: 1, minHeight: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
});
