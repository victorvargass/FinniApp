import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { usePaymentDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate, formatEventDateTime } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getCardDueDate } from '@/lib/payment-method-calculations';
import type { PaymentMethodMovement } from '@/lib/types';
import { getPaymentMethodMovements } from '@/repositories/payment-methods';

export default function PaymentMethodDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = Number(id);
  const { paymentMethods } = usePaymentDatabase();
  const method = paymentMethods.find((item) => item.id === methodId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [movements, setMovements] = useState<PaymentMethodMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [movementsError, setMovementsError] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);
  const [showCalculation, setShowCalculation] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);

  useFocusEffect(useCallback(() => {
    if (!Number.isInteger(methodId)) return undefined;
    let active = true;
    setLoadingMovements(true);
    setMovementsError(false);
    getPaymentMethodMovements(methodId, 200)
      .then((items) => {
        if (active) setMovements(items);
      })
      .catch(() => {
        if (active) setMovementsError(true);
      })
      .finally(() => {
        if (active) setLoadingMovements(false);
      });
    return () => { active = false; };
  }, [methodId]));

  useEffect(() => {
    if (method?.availableBalance != null && method.availableBalance < 0) {
      setShowCalculation(true);
    }
  }, [method?.availableBalance]);

  if (!method) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ThemedText>{t('common.loading')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const isCredit = method.type === 'credit';
  const progress = isCredit && method.creditLimit
    ? Math.min(1, Math.max(0, (method.usedAmount ?? 0) / method.creditLimit))
    : 0;
  const dueDate = isCredit ? getCardDueDate(method) : null;
  const typeLabel = {
    cash: t('paymentMethods.cash'),
    debit: t('paymentMethods.debit'),
    prepaid: t('paymentMethods.prepaid'),
    credit: t('paymentMethods.credit'),
  }[method.type];
  const recentMovements = showAllMovements ? movements : movements.slice(0, 3);
  const hasMoreMovements = movements.length > 3;
  const action = (
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void
  ) => (
    <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.border }]}>
      <Ionicons name={icon} size={22} color={colors.action} />
      <ThemedText type="defaultSemiBold" style={styles.actionText}>{label}</ThemedText>
      <Ionicons name="chevron-forward" size={20} color={colors.icon} />
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.accountCard, { backgroundColor: method.color }]}>
          <View style={styles.accountHeader}>
            <View>
              <ThemedText style={styles.onCardType}>{typeLabel}</ThemedText>
              <ThemedText style={styles.onCardName}>{method.name}</ThemedText>
            </View>
            <Ionicons name={isCredit ? 'card' : 'wallet'} size={30} color="#fff" />
          </View>
          <ThemedText style={styles.onCardLabel}>
            {isCredit ? t('paymentMethods.availableCredit') : t('paymentMethods.availableBalance')}
          </ThemedText>
          <ThemedText style={styles.balance}>
            {method.availableBalance == null ? '—' : formatCLP(method.availableBalance)}
          </ThemedText>
          {isCredit && method.creditLimit != null && (
            <>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${progress * 100}%` }]} />
              </View>
              <View style={styles.accountFooter}>
                <ThemedText style={styles.onCardSmall}>
                  {t('paymentMethods.used')} {formatCLP(method.usedAmount ?? 0)}
                </ThemedText>
                <ThemedText style={styles.onCardSmall}>
                  {t('paymentMethods.totalCredit')} {formatCLP(method.creditLimit)}
                </ThemedText>
              </View>
            </>
          )}
          {method.balanceUpdatedAt && (
            <ThemedText style={styles.onCardSmall}>
              {t('paymentMethods.balanceEffectiveAt', {
                date: formatDate(new Date(`${method.balanceUpdatedAt}T12:00:00`)),
              })}
            </ThemedText>
          )}
        </View>

        {method.availableBalance == null && (
          <ThemedView style={[styles.setupCard, { borderColor: colors.secondary }]}>
            <View style={[styles.setupIcon, { backgroundColor: `${colors.secondary}22` }]}>
              <Ionicons name="sync-outline" size={23} color={colors.action} />
            </View>
            <View style={styles.setupCopy}>
              <ThemedText type="defaultSemiBold">{t('paymentMethods.startingPointTitle')}</ThemedText>
              <ThemedText style={styles.hint}>{t('paymentMethods.balanceNotConfigured')}</ThemedText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({
                pathname: '/modal/payment-method-balance',
                params: { id: String(method.id) },
              })}
              style={[styles.setupButton, { backgroundColor: colors.secondary }]}>
              <ThemedText style={[styles.setupButtonText, { color: colors.onSecondary }]}>
                {t('common.configure')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}
        {isCredit && (
          <ThemedView style={styles.statement}>
            <ThemedText type="subtitle">{t('paymentMethods.billedToPay')}</ThemedText>
            <ThemedText type="title">{formatCLP(method.billedAmount)}</ThemedText>
            <ThemedText style={styles.hint}>
              {dueDate
                ? t(dueDate.estimated
                  ? 'paymentMethods.nextEstimatedDueDate'
                  : 'paymentMethods.dueDate', { date: formatDate(dueDate.date) })
                : t('paymentMethods.noStatement')}
            </ThemedText>
          </ThemedView>
        )}

        <View style={styles.actions}>
          {method.availableBalance != null && action(
            'refresh-outline',
            t('paymentMethods.updateBalance'),
            () => router.push({ pathname: '/modal/payment-method-balance', params: { id: String(method.id) } })
          )}
          {isCredit && action(
            'cash-outline',
            t('paymentMethods.payCard'),
            () => router.push({ pathname: '/modal/expense-form', params: { creditPaymentTargetId: String(method.id) } })
          )}
          {!isCredit && action(
            'swap-horizontal-outline',
            t('transfers.action'),
            () => router.push({ pathname: '/modal/account-transfer-form', params: { sourcePaymentMethodId: String(method.id) } } as never)
          )}
        </View>

        <View style={styles.movementsSection}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle">{t('paymentMethods.recentMovements')}</ThemedText>
            <ThemedText style={styles.hint}>{t('paymentMethods.recentMovementsHint')}</ThemedText>
          </View>
          {loadingMovements ? (
            <View style={styles.movementState}>
              <ActivityIndicator color={colors.action} />
              <ThemedText style={styles.hint}>{t('paymentMethods.loadingMovements')}</ThemedText>
            </View>
          ) : movementsError ? (
            <ThemedView style={styles.movementState}>
              <ThemedText style={styles.hint}>{t('paymentMethods.movementsError')}</ThemedText>
            </ThemedView>
          ) : movements.length === 0 ? (
            <ThemedView style={styles.movementState}>
              <Ionicons name="receipt-outline" size={28} color={colors.icon} />
              <ThemedText style={styles.hint}>{t('paymentMethods.noMovements')}</ThemedText>
            </ThemedView>
          ) : recentMovements.map((movement) => {
            const isPaymentReceived = movement.kind === 'credit_payment';
            const isAdjustment = movement.kind === 'credit_adjustment';
            const isInstallmentPurchase = movement.kind === 'installment_purchase';
            const isIncome = movement.kind === 'income' || movement.kind === 'savings_withdrawal';
            const isTransfer = movement.kind === 'transfer_in' || movement.kind === 'transfer_out';
            const isIncoming = isPaymentReceived || isAdjustment || isIncome || movement.kind === 'transfer_in';
            const detail = movement.kind === 'transfer_in'
              ? t('transfers.receivedFrom', { name: movement.relatedPaymentMethodName ?? t('common.notSpecified') })
              : movement.kind === 'transfer_out'
                ? t('transfers.sentTo', { name: movement.relatedPaymentMethodName ?? t('common.notSpecified') })
                : isInstallmentPurchase
              ? t('paymentMethods.installmentPurchaseTotal')
              : isAdjustment
                ? t('paymentMethods.sameCardAdjustment')
              : isPaymentReceived
              ? t('paymentMethods.paymentReceivedFrom', {
                  name: movement.relatedPaymentMethodName ?? t('common.notSpecified'),
                })
              : movement.kind === 'savings_withdrawal'
                ? t('paymentMethods.savingsWithdrawalReceivedFrom', {
                    name: movement.relatedPaymentMethodName ?? t('savings.goal'),
                  })
                : isIncome
                  ? t('paymentMethods.incomeReceived')
              : movement.relatedPaymentMethodName
                ? t('paymentMethods.paymentSentTo', { name: movement.relatedPaymentMethodName })
                : movement.categoryName ?? t('expenses.noCategory');
            return (
              <Pressable
                accessibilityRole="button"
                key={`${movement.kind}-${movement.id}`}
                onPress={() => router.push((isTransfer
                  ? { pathname: '/modal/account-transfer-form', params: { id: String(movement.id) } }
                  : isAdjustment
                    ? { pathname: '/modal/expense-form', params: { adjustmentId: String(movement.id) } }
                  : isInstallmentPurchase
                  ? { pathname: '/modal/debt-detail', params: { id: String(movement.id) } }
                  : isIncome
                    ? { pathname: '/modal/income-form', params: { id: String(movement.id) } }
                  : { pathname: '/modal/expense-form', params: { id: String(movement.id) } }) as never)}
                style={({ pressed }) => [
                  styles.movementRow,
                  { borderColor: colors.border },
                  pressed && styles.pressed,
                ]}>
                <View style={[
                  styles.movementIcon,
                  { backgroundColor: isIncoming ? `${colors.success}20` : `${colors.expense}18` },
                ]}>
                  <Ionicons
                    name={isTransfer ? 'swap-horizontal-outline' : isIncoming ? 'arrow-down' : isInstallmentPurchase ? 'card-outline' : 'arrow-up'}
                    size={19}
                    color={isIncoming ? colors.success : colors.expense}
                  />
                </View>
                <View style={styles.movementCopy}>
                  <ThemedText type="defaultSemiBold" numberOfLines={1}>{movement.name || t('transfers.defaultName')}</ThemedText>
                  <ThemedText style={styles.movementMeta} numberOfLines={1}>
                    {formatEventDateTime(movement.date, movement.time)} · {detail}
                  </ThemedText>
                </View>
                <ThemedText style={[
                  styles.movementAmount,
                  { color: isIncoming ? colors.success : colors.expense },
                ]}>
                  {isIncoming ? '+' : '−'}{formatCLP(movement.amount)}
                </ThemedText>
              </Pressable>
            );
          })}
          {hasMoreMovements && (
            <Pressable
              accessibilityRole="button"
              testID="payment-method-view-all-movements"
              onPress={() => setShowAllMovements((current) => !current)}
              style={({ pressed }) => [
                styles.viewMoreButton,
                { borderColor: colors.primary },
                pressed && styles.pressed,
              ]}>
              <Ionicons name={showAllMovements ? 'chevron-up' : 'list-outline'} size={20} color={colors.primary} />
              <ThemedText type="defaultSemiBold" style={[styles.viewMoreText, { color: colors.primary }]}>
                {t(showAllMovements ? 'paymentMethods.showFewerMovements' : 'paymentMethods.viewMoreExpenses')}
              </ThemedText>
              <Ionicons name={showAllMovements ? 'chevron-up' : 'chevron-down'} size={19} color={colors.primary} />
            </Pressable>
          )}
        </View>

        {method.reportedBalance != null && method.availableBalance != null && (
          <ThemedView style={styles.disclosureCard}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: showCalculation }}
              onPress={() => setShowCalculation((current) => !current)}
              style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}>
              <View style={styles.disclosureCopy}>
                <ThemedText type="subtitle">
                  {t(isCredit ? 'paymentMethods.howCreditIsCalculated' : 'paymentMethods.howBalanceIsCalculated')}
                </ThemedText>
                <ThemedText style={styles.hint}>
                  {t('paymentMethods.calculationSummary', {
                    reported: formatCLP(method.reportedBalance),
                    calculated: formatCLP(method.availableBalance),
                  })}
                </ThemedText>
              </View>
              <Ionicons name={showCalculation ? 'chevron-up' : 'chevron-down'} size={21} color={colors.icon} />
            </Pressable>
            {showCalculation && (
              <View style={[styles.disclosureBody, { borderTopColor: colors.border }]}>
                {method.balanceUpdatedAt && (
                  <ThemedText style={styles.hint}>
                    {t('paymentMethods.calculationSince', {
                      date: formatDate(new Date(`${method.balanceUpdatedAt}T12:00:00`)),
                    })}
                  </ThemedText>
                )}
                <View style={styles.calculationRow}>
                  <ThemedText>{t('paymentMethods.reportedAvailable')}</ThemedText>
                  <ThemedText type="defaultSemiBold">{formatCLP(method.reportedBalance)}</ThemedText>
                </View>
                {method.registeredCharges > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('paymentMethods.registeredExpenses')}</ThemedText>
                    <ThemedText style={{ color: colors.expense }}>−{formatCLP(method.registeredCharges)}</ThemedText>
                  </View>
                )}
                {isCredit && method.installmentCommitments > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('paymentMethods.installmentCommitments')}</ThemedText>
                    <ThemedText style={{ color: colors.expense }}>−{formatCLP(method.installmentCommitments)}</ThemedText>
                  </View>
                )}
                {method.registeredPayments > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('paymentMethods.registeredPayments')}</ThemedText>
                    <ThemedText style={{ color: colors.success }}>+{formatCLP(method.registeredPayments)}</ThemedText>
                  </View>
                )}
                {method.registeredAdjustments > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('paymentMethods.registeredAdjustments')}</ThemedText>
                    <ThemedText style={{ color: colors.success }}>+{formatCLP(method.registeredAdjustments)}</ThemedText>
                  </View>
                )}
                {method.registeredIncomes > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('paymentMethods.registeredIncomes')}</ThemedText>
                    <ThemedText style={{ color: colors.success }}>+{formatCLP(method.registeredIncomes)}</ThemedText>
                  </View>
                )}
                {method.registeredTransfersOut > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('transfers.sent')}</ThemedText>
                    <ThemedText style={{ color: colors.expense }}>−{formatCLP(method.registeredTransfersOut)}</ThemedText>
                  </View>
                )}
                {method.registeredTransfersIn > 0 && (
                  <View style={styles.calculationRow}>
                    <ThemedText>{t('transfers.received')}</ThemedText>
                    <ThemedText style={{ color: colors.success }}>+{formatCLP(method.registeredTransfersIn)}</ThemedText>
                  </View>
                )}
                <View style={[styles.calculationRow, styles.calculationTotal, { borderTopColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">{t('paymentMethods.calculatedAvailable')}</ThemedText>
                  <ThemedText type="defaultSemiBold">{formatCLP(method.availableBalance)}</ThemedText>
                </View>
                {method.availableBalance < 0 && (
                  <ThemedText style={{ color: colors.danger }}>
                    {t('paymentMethods.overLimitAmount', {
                      amount: formatCLP(Math.abs(method.availableBalance)),
                    })}
                  </ThemedText>
                )}
              </View>
            )}
          </ThemedView>
        )}

        <ThemedView style={styles.disclosureCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showMoreOptions }}
            onPress={() => setShowMoreOptions((current) => !current)}
            style={({ pressed }) => [styles.disclosureHeader, pressed && styles.pressed]}>
            <View style={styles.disclosureCopy}>
              <ThemedText type="subtitle">{t('paymentMethods.moreOptions')}</ThemedText>
              <ThemedText style={styles.hint}>
                {t(isCredit ? 'paymentMethods.moreOptionsHint' : 'paymentMethods.moreOptionsAccountHint')}
              </ThemedText>
            </View>
            <Ionicons name={showMoreOptions ? 'chevron-up' : 'chevron-down'} size={21} color={colors.icon} />
          </Pressable>
          {showMoreOptions && (
            <View style={[styles.secondaryActions, { borderTopColor: colors.border }]}>
              {isCredit && action(
                'wallet-outline',
                t('paymentMethods.installmentPurchases'),
                () => router.push({ pathname: '/modal/debts', params: { paymentMethodId: String(method.id) } })
              )}
              {isCredit && action(
                'receipt-outline',
                t('paymentMethods.cycles'),
                () => router.push({ pathname: '/modal/card-cycles', params: { id: String(method.id) } })
              )}
              {action(
                'settings-outline',
                t('paymentMethods.editSettings'),
                () => router.push({ pathname: '/modal/payment-method-form', params: { id: String(method.id) } })
              )}
            </View>
          )}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 70, gap: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  accountCard: { borderRadius: 20, padding: 20, minHeight: 205, gap: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, elevation: 5 },
  accountHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  onCardType: { color: '#fff', opacity: 0.82, fontSize: 13 },
  onCardName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  onCardLabel: { color: '#fff', opacity: 0.82 },
  balance: { color: '#fff', fontSize: 30, fontWeight: '700' },
  track: { height: 7, borderRadius: 4, backgroundColor: '#ffffff55', overflow: 'hidden', marginTop: 7 },
  fill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  accountFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  onCardSmall: { color: '#fff', opacity: 0.88, fontSize: 12 },
  statement: { borderRadius: 14, padding: 17, gap: 6 },
  setupCard: { borderWidth: 1, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 11, flexWrap: 'wrap' },
  setupIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  setupCopy: { flex: 1, minWidth: 180, gap: 2 },
  setupButton: { minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  setupButtonText: { fontWeight: '700' },
  disclosureCard: { borderRadius: 14, padding: 17, gap: 12 },
  disclosureHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  disclosureCopy: { flex: 1, gap: 3 },
  disclosureBody: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8 },
  calculationRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 4 },
  calculationTotal: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 2, paddingTop: 10 },
  hint: { opacity: 0.68, lineHeight: 19 },
  actions: { gap: 10 },
  secondaryActions: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 9 },
  action: { minHeight: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionText: { flex: 1 },
  movementsSection: { gap: 10, marginTop: 6 },
  sectionHeader: { gap: 2 },
  movementState: { minHeight: 92, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 18 },
  movementRow: { minHeight: 72, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 },
  movementIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  movementCopy: { flex: 1, gap: 3 },
  movementMeta: { color: '#60758E', fontSize: 12 },
  movementAmount: { fontWeight: '700', fontSize: 14 },
  viewMoreButton: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewMoreText: { flex: 1 },
  pressed: { opacity: 0.72 },
});
