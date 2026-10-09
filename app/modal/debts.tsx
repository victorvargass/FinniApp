import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FloatingActionButton } from '@/components/floating-action-button';
import { FinancialExplanationModal, type FinancialExplanation } from '@/components/financial-explanation-modal';
import { FinancialInfoButton } from '@/components/financial-info-button';
import { FeatureGuide, FeatureGuideButton, useFeatureGuide } from '@/components/feature-guide';
import { OverflowMenu } from '@/components/overflow-menu';
import { SegmentedTabs } from '@/components/segmented-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDebtDatabase, usePaymentDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useLargeTextLayout } from '@/hooks/use-large-text-layout';
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

type ContactDebtGroup = {
  contactId: number;
  contactName: string;
  debts: Debt[];
  total: number;
};

function groupContactDebts(debts: Debt[]): { groups: ContactDebtGroup[]; remaining: Debt[] } {
  const candidates = new Map<number, ContactDebtGroup>();
  debts.forEach((debt) => {
    if (debt.status !== 'active' || debt.currentBalance <= 0 || debt.contactId == null || !debt.contactName) return;
    const group = candidates.get(debt.contactId) ?? {
      contactId: debt.contactId,
      contactName: debt.contactName,
      debts: [],
      total: 0,
    };
    group.debts.push(debt);
    group.total += debt.currentBalance;
    candidates.set(debt.contactId, group);
  });
  const groups = Array.from(candidates.values()).filter((group) => group.debts.length > 1);
  const groupedIds = new Set(groups.flatMap((group) => group.debts.map((debt) => debt.id)));
  return { groups, remaining: debts.filter((debt) => !groupedIds.has(debt.id)) };
}

export default function DebtsScreen() {
  const { paymentMethodId } = useLocalSearchParams<{ paymentMethodId?: string }>();
  const methodId = paymentMethodId ? Number(paymentMethodId) : undefined;
  const { getDebtPlans, getDebts } = useDebtDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const usesLargeText = useLargeTextLayout();
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [explanation, setExplanation] = useState<FinancialExplanation | null>(null);
  const [debtSection, setDebtSection] = useState<'cards' | 'other'>(() =>
    paymentMethods.some((item) => item.type === 'credit') ? 'cards' : 'other'
  );
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
  useEffect(() => {
    navigation.setOptions({
      headerRight: methodId == null ? () => (
        <OverflowMenu
          accessibilityLabel={t('debts.moreOptions')}
          actions={[
            {
              label: t('debts.archivedMenu'),
              icon: 'archive-outline',
              onPress: () => router.push('/modal/archived-debts' as never),
            },
          ]}
          iconColor={colors.icon}
        />
      ) : undefined,
    });
  }, [colors.icon, methodId, navigation]);
  const method = paymentMethods.find((item) => item.id === methodId);
  const creditCards = paymentMethods.filter((item) => item.type === 'credit');
  const visibleDebts = debts.filter((item) => item.status !== 'archived');
  const payableDebts = visibleDebts.filter((item) => item.direction === 'payable');
  const receivableDebts = visibleDebts.filter((item) => item.direction === 'receivable');
  const payableContactGroups = groupContactDebts(payableDebts);
  const receivableContactGroups = groupContactDebts(receivableDebts);
  const totalDebtBalance = visibleDebts.filter((item) => item.direction === 'payable').reduce((sum, item) => sum + item.currentBalance, 0)
    + creditCards.reduce((sum, item) => sum + (item.usedAmount ?? 0), 0);
  const totalReceivable = visibleDebts.filter((item) => item.direction === 'receivable').reduce((sum, item) => sum + item.currentBalance, 0);
  const renderDebt = (debt: Debt, hideContactName = false) => (
    <Pressable key={debt.id} onPress={() => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(debt.id) } })}>
      <ThemedView style={[styles.card, debt.status === 'archived' && styles.archived]}>
        <View style={[styles.header, usesLargeText && styles.headerLargeText]}>
          <View style={[styles.debtIcon, { backgroundColor: debt.direction === 'receivable' ? '#20A486' : debt.type === 'fixed' ? '#0B315B' : '#D88916' }]}><Ionicons name={debt.direction === 'receivable' ? 'arrow-down-outline' : debt.type === 'fixed' ? 'calendar-outline' : 'analytics-outline'} size={17} color="#fff" /></View>
          <View style={styles.copy}>
            <ThemedText type="defaultSemiBold">{debt.name}</ThemedText>
            {!hideContactName && (
              <ThemedText style={styles.secondary}>
                {debt.contactName ?? debt.creditor ?? (debt.type === 'fixed' ? t('debts.fixed') : t('debts.variable'))}
              </ThemedText>
            )}
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.icon} />
        </View>
        <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('debts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
        {debt.nextDueDate && <ThemedText style={styles.secondary}>{t('debts.nextDueValue', { date: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${debt.nextDueDate}T12:00:00`)) })}</ThemedText>}
        {debt.status !== 'active' && (
          <ThemedText style={[styles.status, { color: debt.status === 'paid' ? '#1FAF78' : '#60758E' }]}>
            {debt.status === 'paid' ? t('debts.statusPaid') : t('debts.statusArchived')}
          </ThemedText>
        )}
      </ThemedView>
    </Pressable>
  );
  const renderContactGroup = (group: ContactDebtGroup, direction: Debt['direction']) => (
    <View key={`${direction}-contact-${group.contactId}`} style={styles.contactGroup}>
      <ThemedView style={[styles.contactSummary, { borderColor: colors.border }]}>
        <View style={[styles.header, usesLargeText && styles.headerLargeText]}>
          <View style={[styles.debtIcon, { backgroundColor: direction === 'receivable' ? '#20A486' : '#0B315B' }]}>
            <Ionicons name="people-outline" size={18} color="#fff" />
          </View>
          <View style={styles.copy}>
            <ThemedText type="defaultSemiBold">{group.contactName}</ThemedText>
            <ThemedText style={styles.secondary}>{t('debts.debtsIncluded', { count: group.debts.length })}</ThemedText>
          </View>
          <View style={styles.valueWithInfo}><ThemedText type="defaultSemiBold">{formatCLP(group.total)}</ThemedText><FinancialInfoButton onPress={() => setExplanation({ title: group.contactName, description: t('financialExplanation.descriptions.contactDebt'), lines: group.debts.map((debt) => ({ label: debt.name, value: formatCLP(debt.currentBalance) })), totalLabel: t('financialExplanation.total'), total: formatCLP(group.total) })} /></View>
        </View>
        <Pressable
          onPress={() => router.push({
            pathname: '/modal/manual-debt-payment',
            params: { direction, contactId: String(group.contactId) },
          })}
          style={[styles.contactAction, { borderColor: colors.primary }]}>
          <Ionicons name={direction === 'receivable' ? 'download-outline' : 'cash-outline'} size={18} color={colors.primary} />
          <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>
            {t(direction === 'receivable' ? 'debts.collectContactTotal' : 'debts.payContactTotal')}
          </ThemedText>
        </Pressable>
      </ThemedView>
      <View style={styles.groupedDebts}>{group.debts.map((debt) => renderDebt(debt, true))}</View>
    </View>
  );
  const renderPlan = (plan: DebtPlan) => (
    <Pressable
      key={plan.id}
      onPress={() => router.push({
        pathname: '/modal/debt-detail',
        params: { id: String(plan.id) },
      })}>
      <ThemedView style={[styles.card, styles.planCard]}>
        <View style={[styles.header, usesLargeText && styles.headerLargeText]}>
          <View style={[styles.dot, { backgroundColor: plan.paymentMethodColor }]} />
          <View style={styles.copy}>
            <ThemedText type="defaultSemiBold">{plan.name}</ThemedText>
            {methodId != null && (
              <ThemedText style={styles.secondary}>{plan.paymentMethodName}</ThemedText>
            )}
          </View>
          <Ionicons name="chevron-forward" size={21} color={colors.icon} />
        </View>
        <View style={styles.planMeta}>
          <ThemedText style={styles.planMetaText} type="defaultSemiBold">
            {t('installments.progressValue', {
              posted: plan.postedInstallments,
              total: plan.totalInstallments,
            })}
          </ThemedText>
          <ThemedText style={styles.planMetaText}>·</ThemedText>
          <ThemedText style={styles.planMetaText}>{formatCLP(plan.remainingAmount)}</ThemedText>
          <ThemedText
            style={[styles.compactStatus, { color: plan.status === 'active' ? '#1FAF78' : colors.primary }]}>
            {statusLabel(plan.status)}
          </ThemedText>
        </View>
      </ThemedView>
    </Pressable>
  );
  const renderPlanList = (items: DebtPlan[], showEmpty = false) => (
    <>
      {showEmpty && items.length === 0 && (
        <ThemedView style={styles.empty}>
          <Ionicons name="wallet-outline" size={34} color={colors.icon} />
          <ThemedText>{t('installments.noPurchases')}</ThemedText>
          <ThemedText style={styles.secondary}>{t('installments.createHint')}</ThemedText>
        </ThemedView>
      )}
      {items.map(renderPlan)}
    </>
  );

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
              {totalReceivable > 0 && <ThemedText style={styles.receivable}>{t('debts.totalReceivable', { amount: formatCLP(totalReceivable) })}</ThemedText>}
            </ThemedView>
            <SegmentedTabs
              value={debtSection}
              onChange={setDebtSection}
              options={[
                { value: 'cards', label: t('debts.cardsTab') },
                { value: 'other', label: t('debts.otherDebtsTab') },
              ]}
            />
            {debtSection === 'cards' ? (
              <>
                <ThemedText style={[styles.sectionHint, { color: colors.textSecondary }]}>{t('debts.creditCardsHint')}</ThemedText>
                {creditCards.length === 0 && (
                  <ThemedView style={styles.empty}>
                    <Ionicons name="card-outline" size={34} color={colors.icon} />
                    <ThemedText>{t('debts.noCreditCards')}</ThemedText>
                    <ThemedText style={styles.secondary}>{t('debts.noCreditCardsHint')}</ThemedText>
                  </ThemedView>
                )}
                {creditCards.map((card) => {
                  const cardPlans = plans.filter((plan) => plan.paymentMethodId === card.id);
                  return (
                    <View key={`card-${card.id}`} style={styles.cardGroup}>
                      <Pressable onPress={() => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(card.id) } })}>
                        <ThemedView style={styles.card}>
                          <View style={[styles.header, usesLargeText && styles.headerLargeText]}>
                            <View style={[styles.debtIcon, { backgroundColor: card.color }]}><Ionicons name="card-outline" size={18} color="#fff" /></View>
                            <View style={styles.copy}><ThemedText type="defaultSemiBold">{card.name}</ThemedText><ThemedText style={styles.secondary}>{t('paymentMethods.availableCredit')}: {card.availableBalance == null ? '—' : formatCLP(card.availableBalance)}</ThemedText></View>
                            <Ionicons name="chevron-forward" size={21} color={colors.icon} />
                          </View>
                          <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('paymentMethods.used')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(card.usedAmount ?? 0)}</ThemedText></View>
                          <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('paymentMethods.billedToPay')}</ThemedText><ThemedText>{formatCLP(card.billedAmount)}</ThemedText></View>
                        </ThemedView>
                      </Pressable>
                      {cardPlans.length > 0 && (
                        <View style={[styles.cardPlans, { borderLeftColor: card.color }]}>
                          <ThemedText style={styles.cardPlansTitle}>{t('debts.installmentPurchases')}</ThemedText>
                          {renderPlanList(cardPlans)}
                        </View>
                      )}
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <ThemedText style={[styles.sectionHint, { color: colors.textSecondary }]}>{t('debts.otherDebtsHint')}</ThemedText>
                {visibleDebts.length === 0 && (
                  <ThemedView style={styles.empty}>
                    <Ionicons name="document-text-outline" size={34} color={colors.icon} />
                    <ThemedText>{t('debts.empty')}</ThemedText>
                    <ThemedText style={styles.secondary}>{t('debts.emptyHint')}</ThemedText>
                  </ThemedView>
                )}
                {payableDebts.length > 0 && <ThemedText type="defaultSemiBold">{t('debts.payableSection')}</ThemedText>}
                {payableContactGroups.groups.map((group) => renderContactGroup(group, 'payable'))}
                {payableContactGroups.remaining.map((debt) => renderDebt(debt))}
                {receivableDebts.length > 0 && <ThemedText type="defaultSemiBold">{t('debts.receivableSection')}</ThemedText>}
                {receivableContactGroups.groups.map((group) => renderContactGroup(group, 'receivable'))}
                {receivableContactGroups.remaining.map((debt) => renderDebt(debt))}
              </>
            )}
          </>
        )}
        {method?.type === 'credit' && (
          <ThemedView style={styles.methodSummary}>
            <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('paymentMethods.availableCredit')}</ThemedText><ThemedText type="defaultSemiBold">{method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}</ThemedText></View>
            <View style={[styles.row, usesLargeText && styles.rowLargeText]}><ThemedText>{t('paymentMethods.used')}</ThemedText><ThemedText>{formatCLP(method.usedAmount ?? 0)}</ThemedText></View>
            <View style={styles.methodActions}>
              <Pressable onPress={() => router.push({ pathname: '/modal/expense-form', params: { creditPaymentTargetId: String(method.id) } })} style={[styles.methodButton, { backgroundColor: colors.action }]}><ThemedText style={{ color: colors.onSecondary, fontWeight: '700' }}>{t('paymentMethods.payCard')}</ThemedText></Pressable>
            </View>
          </ThemedView>
        )}
        {methodId != null && (
          <>
            <View style={styles.sectionHeading}>
              <View style={styles.copy}>
                <ThemedText type="subtitle">{t('debts.cardPurchases')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('debts.cardPurchasesHint')}</ThemedText>
              </View>
            </View>
            {renderPlanList(plans, true)}
          </>
        )}
      </ScrollView>
      <FeatureGuide visible={guide.visible} slides={guideSlides} onClose={guide.close} />
      <FinancialExplanationModal explanation={explanation} onClose={() => setExplanation(null)} />
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
  headerLargeText: { flexWrap: 'wrap', alignItems: 'flex-start' },
  planCard: { paddingVertical: 11, gap: 6 },
  planMeta: { paddingLeft: 25, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  planMetaText: { fontSize: 12, opacity: 0.72 },
  compactStatus: { marginLeft: 'auto', fontSize: 11, fontWeight: '700' },
  cardGroup: { gap: 9 }, cardPlans: { marginLeft: 16, paddingLeft: 12, borderLeftWidth: 2, gap: 8 }, cardPlansTitle: { fontSize: 12, fontWeight: '700', opacity: 0.68 },
  dot: { width: 16, height: 16, borderRadius: 6 }, copy: { flex: 1 }, secondary: { opacity: 0.62, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, status: { fontSize: 12, fontWeight: '700' },
  rowLargeText: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  summaryCard: { borderRadius: 12, padding: 16, gap: 5 },
  receivable: { color: '#138F73', fontWeight: '700', marginTop: 4 },
  debtIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, archived: { opacity: 0.62 },
  sectionHint: { fontSize: 13, lineHeight: 18 },
  sectionHeading: { marginTop: 4 }, methodSummary: { borderRadius: 12, padding: 16, gap: 10 }, methodActions: { flexDirection: 'row', gap: 10 }, methodButton: { flex: 1, minHeight: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  contactGroup: { gap: 8 }, contactSummary: { borderWidth: 1, borderRadius: 12, padding: 15, gap: 12 }, contactAction: { minHeight: 44, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, groupedDebts: { paddingLeft: 12, gap: 8 },
  valueWithInfo: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pressed: { opacity: 0.62 },
});
