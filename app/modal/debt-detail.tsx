import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OverflowMenu } from '@/components/overflow-menu';
import { Colors, Fonts } from '@/constants/theme';
import { useDebtDatabase, usePeriodDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseAmount } from '@/lib/format';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { DebtPlan } from '@/lib/types';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function showResult(message: string) {
  showToast(message);
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const { periods, selectedPeriodId } = usePeriodDatabase();
  const { getDebtPlan, activateInstallmentPlan, settleInstallmentPlan, setDebtPlanShowOnHome, removeInstallmentPlan } = useDebtDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { fontScale } = useWindowDimensions();
  const usesLargeText = fontScale >= 1.2;
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(selectedPeriodId);
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [periodPickerAction, setPeriodPickerAction] = useState<'select' | null>(null);
  const [pendingPeriodId, setPendingPeriodId] = useState<number | null>(null);
  const load = useCallback(async () => {
    const value = await getDebtPlan(planId);
    setPlan(value);
    if (value) setAmountText((current) => current || formatCLPInput(value.installmentAmount));
  }, [getDebtPlan, planId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!plan) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>{t('installments.loadingPurchase')}</ThemedText></View></SafeAreaView>;
  const actualAmount = parseAmount(amountText);
  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;

  const run = async (action: () => Promise<void>, errorTitle: string, successMessage?: string) => {
    setSaving(true);
    try { await action(); await load(); if (successMessage) showResult(successMessage); }
    catch (error) { Alert.alert(errorTitle, error instanceof Error ? error.message : t('common.tryAgain')); }
    finally { setSaving(false); }
  };

  const openPeriodPicker = (action: 'select') => {
    setPendingPeriodId(periodId ?? selectedPeriodId ?? periods[0]?.id ?? null);
    setPeriodPickerAction(action);
  };

  const closePeriodPicker = () => {
    setPeriodPickerAction(null);
    setPendingPeriodId(null);
  };

  const confirmPeriodSelection = () => {
    if (periodPickerAction == null || pendingPeriodId == null) return;
    const selectedId = pendingPeriodId;
    setPeriodId(selectedId);
    closePeriodPicker();
  };

  const deletePlan = () => {
    Alert.alert(
      t('installments.deletePurchase'),
      t('installments.deleteDescription'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            removeInstallmentPlan(plan.id)
              .then(() => {
                showResult(t('installments.deletedPurchase'));
                router.back();
              })
              .catch((error) => Alert.alert(t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain')))
              .finally(() => setSaving(false));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <Stack.Screen options={{
        headerRight: () => (
          <OverflowMenu
            accessibilityLabel={t('common.moreOptions')}
            actions={[
              {
                label: t('homeVisibility.title'),
                icon: 'home-outline',
                switchValue: plan.showOnHome,
                disabled: saving,
                onSwitchValueChange: (showOnHome) => run(
                  () => setDebtPlanShowOnHome(plan.id, showOnHome),
                  t('errors.couldNotSave')
                ),
              },
              ...(plan.linkedExpenseCount === 0 ? [{
                label: t('installments.deletePurchase'),
                icon: 'trash-outline' as const,
                destructive: true,
                disabled: saving,
                onPress: deletePlan,
              }] : []),
            ]}
          />
        ),
      }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{plan.name}</ThemedText>
        <ThemedText style={styles.secondary}>{t('installments.totalAgreed', { method: plan.paymentMethodName, amount: formatCLP(plan.totalAmount) })}</ThemedText>

        {plan.status === 'projected' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('installments.activateFirst')}</ThemedText>
            <ThemedText style={styles.secondary}>{t('installments.activateDescription')}</ThemedText>
            <ThemedText style={styles.label}>{t('installments.actualAmount')}</ThemedText>
        <TextInput keyboardType="number-pad" value={amountText} onChangeText={(value) => setAmountText(formatCLPInput(value))} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <ThemedText style={styles.label}>{t('installments.registerInPeriod')}</ThemedText>
            <Pressable onPress={() => openPeriodPicker('select')} style={[styles.periodSelect, { borderColor: colors.border }]}>
              <ThemedText>{selectedPeriod ? `${formatDate(parseDate(selectedPeriod.startDate))} – ${formatDate(parseDate(selectedPeriod.endDate))}` : t('common.selectPeriod')}</ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </Pressable>
            <Pressable disabled={saving} onPress={() => {
              if (periodId == null || actualAmount == null) return Alert.alert(t('validation.missingData'), t('installments.missingActivationData'));
              run(() => activateInstallmentPlan(plan.id, periodId, actualAmount), t('installments.activateError'), t('installments.firstRegistered'));
            }} style={styles.primary}>
              <ThemedText style={styles.primaryText}>
                {t('installments.activatePlan')}
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <ThemedText type="subtitle">{t('installments.detail')}</ThemedText>
        {plan.installments?.map((installment) => {
          const isSettled = installment.status === 'cancelled' && plan.settlementExpenseId != null;
          const isCompleted = installment.status === 'posted' || isSettled;
          return (
            <Pressable
              accessibilityLabel={installment.expenseId != null ? t('installments.editInstallment') : undefined}
              accessibilityRole={installment.expenseId != null ? 'button' : undefined}
              disabled={installment.expenseId == null}
              key={installment.id}
              onPress={() => router.push({ pathname: '/modal/expense-form', params: { id: String(installment.expenseId) } })}
              style={({ pressed }) => [styles.installment, usesLargeText && styles.installmentLargeText, pressed && styles.pressed]}>
                <View style={[styles.icon, isCompleted ? styles.posted : installment.status === 'cancelled' ? styles.cancelled : styles.projected]}>
                  <Ionicons name={isCompleted ? 'checkmark' : installment.status === 'cancelled' ? 'close' : 'time-outline'} size={17} color="#fff" />
                </View>
                <View style={styles.copy}><ThemedText type="defaultSemiBold">{t('installments.installmentNumber', { number: installment.number, total: plan.totalInstallments })}</ThemedText><ThemedText style={styles.secondary}>{formatDate(parseDate(installment.dueDate))} · {installment.status === 'posted' ? t('installments.posted') : isSettled ? t('installments.settledInstallment') : installment.status === 'cancelled' ? t('installments.cancelled') : t('installments.projected')}</ThemedText></View>
                <ThemedText style={[styles.installmentAmount, usesLargeText && styles.installmentAmountLargeText]}>{formatCLP(installment.projectedAmount)}</ThemedText>
                {installment.expenseId != null && <Ionicons name="chevron-forward" size={21} color={colors.icon} />}
            </Pressable>
          );
        })}
        {plan.settlementExpenseId != null && (
          <Pressable onPress={() => router.push({ pathname: '/modal/expense-form', params: { id: String(plan.settlementExpenseId) } })} style={styles.inlineAction}>
            <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>{t('installments.editSettlement')}</ThemedText>
          </Pressable>
        )}

        {plan.status === 'active' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">{t('installments.manageBalance')}</ThemedText>
            <ThemedText>{t('installments.projectedBalanceValue', { amount: formatCLP(plan.remainingAmount) })}</ThemedText>
            <ThemedText style={styles.label}>{t('installments.registerSettlementIn')}</ThemedText>
            <Pressable onPress={() => openPeriodPicker('select')} style={[styles.periodSelect, { borderColor: colors.border }]}>
              <ThemedText>{selectedPeriod ? `${formatDate(parseDate(selectedPeriod.startDate))} – ${formatDate(parseDate(selectedPeriod.endDate))}` : t('common.selectPeriod')}</ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </Pressable>
            <Pressable disabled={saving || periodId == null} onPress={() => Alert.alert(t('installments.settleRemaining'), t('installments.settlementDescription', { amount: formatCLP(plan.remainingAmount) }), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('installments.settle'), onPress: () => run(() => settleInstallmentPlan(plan.id, periodId!), t('installments.settleError'), t('installments.settled')) }])} style={styles.primary}><ThemedText style={styles.primaryText}>{t('installments.settleRemaining')}</ThemedText></Pressable>
          </ThemedView>
        )}
      </ScrollView>
      <Modal transparent animationType="slide" visible={periodPickerAction != null} onRequestClose={closePeriodPicker}>
        <Pressable style={styles.modalOverlay} onPress={closePeriodPicker}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{t('common.selectPeriod')}</ThemedText>
              <Pressable accessibilityLabel={t('accessibility.closePeriodPicker')} hitSlop={8} onPress={closePeriodPicker}>
                <Ionicons name="close" size={23} color={colors.icon} />
              </Pressable>
            </View>
            <ScrollView style={styles.periodList}>
              {periods.map((period) => (
                <Pressable
                  key={period.id}
                  onPress={() => setPendingPeriodId(period.id)}
                  style={[styles.periodOption, { borderColor: colors.border }, period.id === pendingPeriodId && styles.selectedOption]}>
                  <ThemedText style={period.id === pendingPeriodId ? styles.selectedOptionText : undefined}>{formatDate(parseDate(period.startDate))} – {formatDate(parseDate(period.endDate))}</ThemedText>
                  {period.id === pendingPeriodId && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              disabled={pendingPeriodId == null || saving}
              onPress={confirmPeriodSelection}
              style={[styles.primary, (pendingPeriodId == null || saving) && styles.disabled]}>
              <ThemedText style={styles.primaryText}>{t('common.select')}</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 13 },
  card: { borderRadius: 12, padding: 15, gap: 11 }, secondary: { opacity: 0.65, lineHeight: 18 }, label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 16, fontFamily: Fonts.regular }, periodSelect: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  primary: { minHeight: 46, backgroundColor: '#0B315B', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }, primaryText: { width: '100%', color: '#fff', fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  installment: { borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, installmentLargeText: { flexWrap: 'wrap', alignItems: 'flex-start' }, installmentAmount: { textAlign: 'right' }, installmentAmountLargeText: { width: '100%', paddingLeft: 38 }, icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, posted: { backgroundColor: '#1FAF78' }, projected: { backgroundColor: '#D88916' }, cancelled: { backgroundColor: '#60758E' }, copy: { flex: 1, minWidth: 0 },
  inlineAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  disabled: { opacity: 0.4 }, pressed: { opacity: 0.68 },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { width: '100%', maxHeight: '70%', borderRadius: 18, padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  periodList: { maxHeight: 420 }, periodOption: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedOption: { borderColor: '#0B315B', backgroundColor: '#20C9B51F' }, selectedOptionText: { color: '#0B315B', fontWeight: '700' },
});
