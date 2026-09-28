import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { getDebtPlans, getDebts, paymentMethods } = useDatabase();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
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
        <Pressable
          accessibilityLabel={t('debts.moreOptions')}
          hitSlop={10}
          onPress={() => setMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={23} color={colors.icon} />
        </Pressable>
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
  const renderDebt = (debt: Debt) => (
    <Pressable key={debt.id} onPress={() => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(debt.id) } })}>
      <ThemedView style={[styles.card, debt.status === 'archived' && styles.archived]}>
        <View style={styles.header}>
          <View style={[styles.debtIcon, { backgroundColor: debt.direction === 'receivable' ? '#20A486' : debt.type === 'fixed' ? '#0B315B' : '#D88916' }]}><Ionicons name={debt.direction === 'receivable' ? 'arrow-down-outline' : debt.type === 'fixed' ? 'calendar-outline' : 'analytics-outline'} size={17} color="#fff" /></View>
          <View style={styles.copy}><ThemedText type="defaultSemiBold">{debt.name}</ThemedText><ThemedText style={styles.secondary}>{debt.contactName ?? debt.creditor ?? (debt.type === 'fixed' ? t('debts.fixed') : t('debts.variable'))}</ThemedText></View>
          <Ionicons name="chevron-forward" size={21} color={colors.icon} />
        </View>
        <View style={styles.row}><ThemedText>{t('debts.currentBalance')}</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(debt.currentBalance)}</ThemedText></View>
        {debt.nextDueDate && <ThemedText style={styles.secondary}>{t('debts.nextDueValue', { date: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${debt.nextDueDate}T12:00:00`)) })}</ThemedText>}
        <ThemedText style={[styles.status, { color: debt.status === 'paid' ? '#1FAF78' : debt.status === 'archived' ? '#60758E' : colors.primary }]}>{debt.status === 'paid' ? t('debts.statusPaid') : debt.status === 'archived' ? t('debts.statusArchived') : t('debts.statusActive')}</ThemedText>
      </ThemedView>
    </Pressable>
  );
  const renderContactGroup = (group: ContactDebtGroup, direction: Debt['direction']) => (
    <View key={`${direction}-contact-${group.contactId}`} style={styles.contactGroup}>
      <ThemedView style={[styles.contactSummary, { borderColor: colors.border }]}>
        <View style={styles.header}>
          <View style={[styles.debtIcon, { backgroundColor: direction === 'receivable' ? '#20A486' : '#0B315B' }]}>
            <Ionicons name="people-outline" size={18} color="#fff" />
          </View>
          <View style={styles.copy}>
            <ThemedText type="defaultSemiBold">{group.contactName}</ThemedText>
            <ThemedText style={styles.secondary}>{t('debts.debtsIncluded', { count: group.debts.length })}</ThemedText>
          </View>
          <ThemedText type="defaultSemiBold">{formatCLP(group.total)}</ThemedText>
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
      <View style={styles.groupedDebts}>{group.debts.map(renderDebt)}</View>
    </View>
  );
  const planList = (
    <>
      {plans.length === 0 && (
        <ThemedView style={styles.empty}>
          <Ionicons name="wallet-outline" size={34} color={colors.icon} />
          <ThemedText>{t('installments.noPurchases')}</ThemedText>
          <ThemedText style={styles.secondary}>{t('installments.createHint')}</ThemedText>
        </ThemedView>
      )}
      {plans.map((plan) => (
        <Pressable
          key={plan.id}
          onPress={() => router.push({
            pathname: '/modal/debt-detail',
            params: { id: String(plan.id) },
          })}>
          <ThemedView style={styles.card}>
            <View style={styles.header}>
              <View style={[styles.dot, { backgroundColor: plan.paymentMethodColor }]} />
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{plan.name}</ThemedText>
                <ThemedText style={styles.secondary}>{plan.paymentMethodName}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.icon} />
            </View>
            <View style={styles.row}>
              <ThemedText>{t('installments.progress')}</ThemedText>
              <ThemedText type="defaultSemiBold">
                {t('installments.progressValue', {
                  posted: plan.postedInstallments,
                  total: plan.totalInstallments,
                })}
              </ThemedText>
            </View>
            <View style={styles.row}>
              <ThemedText>{t('installments.projectedBalance')}</ThemedText>
              <ThemedText>{formatCLP(plan.remainingAmount)}</ThemedText>
            </View>
            <ThemedText
              style={[
                styles.status,
                { color: plan.status === 'active' ? '#1FAF78' : colors.primary },
              ]}>
              {statusLabel(plan.status)}
            </ThemedText>
          </ThemedView>
        </Pressable>
      ))}
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
            <View style={styles.sectionHeading}>
              <View style={styles.copy}>
                <ThemedText type="subtitle">{t('debts.cardPurchases')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('debts.cardPurchasesHint')}</ThemedText>
              </View>
            </View>
            {planList}
            <View style={styles.sectionHeading}>
              <View style={styles.copy}>
                <ThemedText type="subtitle">{t('debts.otherDebts')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('debts.otherDebtsHint')}</ThemedText>
              </View>
            </View>
            {visibleDebts.length === 0 && (
              <ThemedView style={styles.empty}>
                <Ionicons name="document-text-outline" size={34} color={colors.icon} />
                <ThemedText>{t('debts.empty')}</ThemedText>
                <ThemedText style={styles.secondary}>{t('debts.emptyHint')}</ThemedText>
              </ThemedView>
            )}
            {payableDebts.length > 0 && <ThemedText type="defaultSemiBold">{t('debts.payableSection')}</ThemedText>}
            {payableContactGroups.groups.map((group) => renderContactGroup(group, 'payable'))}
            {payableContactGroups.remaining.map(renderDebt)}
            {receivableDebts.length > 0 && <ThemedText type="defaultSemiBold">{t('debts.receivableSection')}</ThemedText>}
            {receivableContactGroups.groups.map((group) => renderContactGroup(group, 'receivable'))}
            {receivableContactGroups.remaining.map(renderDebt)}
          </>
        )}
        {method?.type === 'credit' && (
          <ThemedView style={styles.methodSummary}>
            <View style={styles.row}><ThemedText>{t('paymentMethods.availableCredit')}</ThemedText><ThemedText type="defaultSemiBold">{method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}</ThemedText></View>
            <View style={styles.row}><ThemedText>{t('paymentMethods.used')}</ThemedText><ThemedText>{formatCLP(method.usedAmount ?? 0)}</ThemedText></View>
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
            {planList}
          </>
        )}
      </ScrollView>
      <Modal
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
        transparent
        visible={menuVisible}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuVisible(false)}>
          <Pressable
            onPress={(event) => event.stopPropagation()}
            style={[
              styles.menu,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.border,
                top: insets.top + 48,
              },
            ]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setMenuVisible(false);
                router.push('/modal/archived-debts' as never);
              }}
              style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}>
              <Ionicons name="archive-outline" size={20} color={colors.icon} />
              <ThemedText type="defaultSemiBold">{t('debts.archivedMenu')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  receivable: { color: '#138F73', fontWeight: '700', marginTop: 4 },
  debtIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, archived: { opacity: 0.62 },
  sectionHeading: { marginTop: 4 }, methodSummary: { borderRadius: 12, padding: 16, gap: 10 }, methodActions: { flexDirection: 'row', gap: 10 }, methodButton: { flex: 1, minHeight: 45, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  contactGroup: { gap: 8 }, contactSummary: { borderWidth: 1, borderRadius: 12, padding: 15, gap: 12 }, contactAction: { minHeight: 44, borderWidth: 1, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, groupedDebts: { paddingLeft: 12, gap: 8 },
  menuOverlay: { flex: 1 },
  menu: { position: 'absolute', right: 12, minWidth: 180, borderWidth: 1, borderRadius: 12, padding: 6, elevation: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  menuItem: { minHeight: 46, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 8 },
  pressed: { opacity: 0.62 },
});
