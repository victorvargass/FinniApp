import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OverflowMenu } from '@/components/overflow-menu';
import { Colors } from '@/constants/theme';
import { useMovementDatabase } from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { errorMessage } from '@/lib/feedback';
import { formatEventDateTime, formatMoney } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { ExpenseWithCategory, Income } from '@/lib/types';
import { showToast } from '@/lib/toast';
import { getExpenseById, getExpenseShares, getIncomeById } from '@/repositories/movements';

type MovementKind = 'expense' | 'income';
type Movement = ExpenseWithCategory | Income;

function DetailRow({ label, value, color }: { label: string; value: string; color?: string | null }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <View style={styles.valueRow}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <ThemedText style={styles.value}>{value}</ThemedText>
      </View>
    </View>
  );
}

export default function MovementDetailScreen() {
  const { id, kind: requestedKind } = useLocalSearchParams<{ id?: string; kind?: MovementKind }>();
  const movementId = Number(id);
  const kind: MovementKind = requestedKind === 'income' ? 'income' : 'expense';
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const { removeExpense, removeIncome } = useMovementDatabase();
  const [movement, setMovement] = useState<Movement | null>(null);
  const [expenseShareCount, setExpenseShareCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isInteger(movementId)) {
      setMovement(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [result, shares] = kind === 'expense'
      ? await Promise.all([getExpenseById(movementId), getExpenseShares(movementId)])
      : [await getIncomeById(movementId), []];
    setMovement(result);
    setExpenseShareCount(shares.length);
    setLoading(false);
  }, [kind, movementId]);

  useFocusEffect(useCallback(() => {
    load().catch(() => {
      setMovement(null);
      setLoading(false);
    });
  }, [load]));

  const expense = kind === 'expense' ? movement as ExpenseWithCategory | null : null;
  const income = kind === 'income' ? movement as Income | null : null;
  const canDuplicate = expense
    ? expense.debtPlanId == null
      && expense.debtId == null
      && expense.installmentNumber == null
      && expense.savingsGoalId == null
      && expense.creditPaymentTargetId == null
    : income?.savingsGoalId == null;
  const canManageRecurrence = expense != null && (
    expense.recurringExpenseId != null
    || (
      expense.debtPlanId == null
      && expense.debtId == null
      && expense.creditPaymentTargetId == null
      && expenseShareCount === 0
    )
  );

  const editMovement = useCallback(() => {
    if (!movement) return;
    router.push({
      pathname: kind === 'expense' ? '/modal/expense-form' : '/modal/income-form',
      params: { id: String(movement.id) },
    });
  }, [kind, movement]);

  const duplicateMovement = useCallback(() => {
    if (!movement || !canDuplicate) return;
    router.push({
      pathname: kind === 'expense' ? '/modal/expense-form' : '/modal/income-form',
      params: { repeatId: String(movement.id) },
    });
  }, [canDuplicate, kind, movement]);

  const manageRecurrence = useCallback(() => {
    if (!expense || !canManageRecurrence) return;
    router.push({
      pathname: '/modal/recurring-expense-form',
      params: expense.recurringExpenseId != null
        ? { id: String(expense.recurringExpenseId) }
        : { sourceExpenseId: String(expense.id) },
    });
  }, [canManageRecurrence, expense]);

  const confirmDelete = useCallback(() => {
    if (!movement) return;
    const isExpense = kind === 'expense';
    Alert.alert(
      t(isExpense ? 'expenses.delete' : 'incomes.delete'),
      t(isExpense ? 'expenses.deleteQuestion' : 'incomes.deleteQuestion', { name: movement.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setWorking(true);
            try {
              if (isExpense) await removeExpense(movement.id);
              else await removeIncome(movement.id);
              showToast(t(isExpense ? 'expenses.deleted' : 'incomes.deleted'));
              router.back();
            } catch (error) {
              Alert.alert(t('expenses.cannotDelete'), errorMessage(error, isExpense ? 'expenses.deleteError' : 'incomes.deleteError'));
            } finally {
              setWorking(false);
            }
          },
        },
      ]
    );
  }, [kind, movement, removeExpense, removeIncome]);

  useEffect(() => {
    navigation.setOptions({
      title: t(kind === 'expense' ? 'movementDetail.expenseTitle' : 'movementDetail.incomeTitle'),
      headerRight: () => (
        <OverflowMenu
          accessibilityLabel={t('common.moreOptions')}
          actions={movement ? [
            { label: t('common.edit'), icon: 'create-outline', onPress: editMovement },
            ...(canDuplicate ? [{ label: t('common.repeat'), icon: 'copy-outline' as const, onPress: duplicateMovement }] : []),
            ...(canManageRecurrence ? [{
              label: t(expense?.recurringExpenseId != null ? 'recurrence.edit' : 'expenses.makeRecurring'),
              icon: 'repeat-outline' as const,
              onPress: manageRecurrence,
            }] : []),
            { label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: confirmDelete },
            { label: t('common.cancel'), icon: 'close-outline' },
          ] : []}
          disabled={!movement || working}
          iconColor={colors.primary}
        />
      ),
    });
  }, [canDuplicate, canManageRecurrence, colors.primary, confirmDelete, duplicateMovement, editMovement, expense?.recurringExpenseId, kind, manageRecurrence, movement, navigation, working]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText>{t('common.loading')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  if (!movement) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="document-text-outline" size={42} color={colors.icon} />
          <ThemedText type="subtitle">{t('movementDetail.notFound')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const accent = kind === 'expense' ? colors.expense : colors.success;
  const categoryName = movement.categoryName ?? t('movementDetail.noCategory');
  const paymentMethodName = movement.paymentMethodName ?? t('movementDetail.noPaymentMethod');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.hero, { borderTopColor: accent }]}>
          <View style={[styles.iconBox, { backgroundColor: `${accent}18` }]}>
            <Ionicons
              name={kind === 'expense' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'}
              size={28}
              color={accent}
            />
          </View>
          <ThemedText style={[styles.kind, { color: accent }]}>
            {t(kind === 'expense' ? 'movementDetail.expense' : 'movementDetail.income')}
          </ThemedText>
          <ThemedText type="title" style={styles.name}>{movement.name}</ThemedText>
          <ThemedText style={[styles.amount, { color: accent }]}>
            {kind === 'expense' ? '−' : '+'}{formatMoney(movement.amount, expense?.currency ?? 'CLP')}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">{t('movementDetail.information')}</ThemedText>
          <DetailRow label={t('movementDetail.date')} value={formatEventDateTime(movement.date, movement.time)} />
          <DetailRow label={t('movementDetail.category')} value={categoryName} color={movement.categoryColor} />
          <DetailRow label={t('movementDetail.paymentMethod')} value={paymentMethodName} color={movement.paymentMethodColor} />
          {expense?.originalAmount != null && expense.splitPercentage != null ? (
            <>
              <DetailRow label={t('movementDetail.originalAmount')} value={formatMoney(expense.originalAmount, expense.currency)} />
              <DetailRow label={t('movementDetail.yourShare')} value={`${expense.splitPercentage}%`} />
            </>
          ) : null}
          {expense?.installmentNumber != null ? (
            <DetailRow
              label={t('movementDetail.installment')}
              value={expense.totalInstallments
                ? t('movementDetail.installmentValue', { current: expense.installmentNumber, total: expense.totalInstallments })
                : String(expense.installmentNumber)}
            />
          ) : null}
          {movement.savingsGoalName ? (
            <DetailRow label={t('movementDetail.savingsGoal')} value={movement.savingsGoalName} color={movement.savingsGoalColor} />
          ) : null}
          {(expense?.recurringExpenseId != null || income?.recurringIncomeId != null) ? (
            <DetailRow label={t('movementDetail.origin')} value={t('movementDetail.recurring')} />
          ) : null}
          {(expense?.debtId != null || income?.debtId != null) ? (
            <DetailRow label={t('movementDetail.origin')} value={t('movementDetail.debt')} />
          ) : null}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hero: {
    alignItems: 'center',
    borderRadius: 18,
    borderTopWidth: 5,
    paddingHorizontal: 20,
    paddingVertical: 24,
    gap: 7,
  },
  iconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  kind: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  name: { textAlign: 'center' },
  amount: { fontSize: 30, lineHeight: 38, fontWeight: '700' },
  card: { borderRadius: 18, padding: 20, gap: 4 },
  detailRow: {
    minHeight: 56,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#AEBBC755',
    gap: 5,
  },
  label: { opacity: 0.65, fontSize: 13 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  dot: { width: 11, height: 11, borderRadius: 5.5 },
});
