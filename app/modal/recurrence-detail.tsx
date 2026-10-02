import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { OverflowMenu } from '@/components/overflow-menu';
import { Colors } from '@/constants/theme';
import {
  useOrganizerDatabase,
  usePaymentDatabase,
  useRecurrenceDatabase,
} from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import { t } from '@/lib/i18n';
import { describeRecurrence, parseIsoDate } from '@/lib/recurrence';
import { showToast } from '@/lib/toast';

type RecurrenceKind = 'expense' | 'income';

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

export default function RecurrenceDetailScreen() {
  const { id, kind: requestedKind } = useLocalSearchParams<{ id?: string; kind?: RecurrenceKind }>();
  const recurrenceId = Number(id);
  const kind: RecurrenceKind = requestedKind === 'income' ? 'income' : 'expense';
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const {
    recurringExpenses,
    recurringIncomes,
    setRecurringExpenseActive,
    setRecurringIncomeActive,
    removeRecurringExpense,
    removeRecurringIncome,
  } = useRecurrenceDatabase();
  const { paymentMethods } = usePaymentDatabase();
  const { incomeCategories } = useOrganizerDatabase();

  const recurringExpense = kind === 'expense'
    ? recurringExpenses.find((item) => item.id === recurrenceId) ?? null
    : null;
  const recurringIncome = kind === 'income'
    ? recurringIncomes.find((item) => item.id === recurrenceId) ?? null
    : null;
  const recurrence = recurringExpense ?? recurringIncome;
  const isSavings = recurringExpense?.savingsGoalId != null;
  const paymentMethod = recurringIncome
    ? paymentMethods.find((item) => item.id === recurringIncome.paymentMethodId)
    : null;
  const incomeCategory = recurringIncome
    ? incomeCategories.find((item) => item.id === recurringIncome.categoryId)
    : null;

  const editRecurrence = useCallback(() => {
    if (!recurrence) return;
    router.push({
      pathname: kind === 'income' ? '/modal/recurring-income-form' : '/modal/recurring-expense-form',
      params: { id: String(recurrence.id) },
    });
  }, [kind, recurrence]);

  const viewSourceMovement = useCallback(() => {
    const sourceId = recurringExpense?.sourceExpenseId ?? recurringIncome?.sourceIncomeId;
    if (sourceId == null) return;
    router.push({
      pathname: '/modal/movement-detail',
      params: { id: String(sourceId), kind },
    } as never);
  }, [kind, recurringExpense?.sourceExpenseId, recurringIncome?.sourceIncomeId]);

  const toggleActive = useCallback(async () => {
    if (!recurrence) return;
    const active = !recurrence.active;
    try {
      if (kind === 'income') await setRecurringIncomeActive(recurrence.id, active);
      else await setRecurringExpenseActive(recurrence.id, active);
      showToast(t(active ? 'recurrence.activatedToast' : 'recurrence.deactivatedToast', { name: recurrence.name }));
    } catch (error) {
      Alert.alert(t('errors.couldNotChange'), error instanceof Error ? error.message : t('common.tryAgain'));
    }
  }, [kind, recurrence, setRecurringExpenseActive, setRecurringIncomeActive]);

  const confirmDelete = useCallback(() => {
    if (!recurrence) return;
    const question = kind === 'income'
      ? t('recurrence.removeIncomeQuestion', { name: recurrence.name })
      : t(isSavings ? 'recurrence.removeSavingsQuestion' : 'recurrence.removeExpenseQuestion', { name: recurrence.name });
    Alert.alert(t('recurrence.delete'), question, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            if (kind === 'income') await removeRecurringIncome(recurrence.id);
            else await removeRecurringExpense(recurrence.id);
            showToast(t('recurrence.deleted'));
            router.back();
          } catch (error) {
            Alert.alert(t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain'));
          }
        },
      },
    ]);
  }, [isSavings, kind, recurrence, removeRecurringExpense, removeRecurringIncome]);

  useEffect(() => {
    navigation.setOptions({
      title: t('recurrence.detail'),
      headerRight: () => (
        <OverflowMenu
          accessibilityLabel={t('common.moreOptions')}
          actions={recurrence ? [
            { label: t('common.edit'), icon: 'create-outline', onPress: editRecurrence },
            ...((recurringExpense?.sourceExpenseId ?? recurringIncome?.sourceIncomeId) != null ? [{
              label: t('recurrence.viewSourceMovement'),
              icon: 'document-text-outline' as const,
              onPress: viewSourceMovement,
            }] : []),
            {
              label: t(recurrence.active ? 'recurrence.deactivate' : 'recurrence.activate'),
              icon: recurrence.active ? 'pause-circle-outline' : 'play-circle-outline',
              onPress: () => { void toggleActive(); },
            },
            { label: t('common.delete'), icon: 'trash-outline', destructive: true, onPress: confirmDelete },
            { label: t('common.cancel'), icon: 'close-outline' },
          ] : []}
          disabled={!recurrence}
          iconColor={colors.primary}
        />
      ),
    });
  }, [colors.primary, confirmDelete, editRecurrence, navigation, recurrence, recurringExpense?.sourceExpenseId, recurringIncome?.sourceIncomeId, toggleActive, viewSourceMovement]);

  if (!recurrence) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.center}>
          <Ionicons name="repeat-outline" size={42} color={colors.icon} />
          <ThemedText type="subtitle">{t('recurrence.notFound')}</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const accent = kind === 'income'
    ? colors.success
    : isSavings ? recurringExpense?.savingsGoalColor ?? colors.savings : recurringExpense?.categoryColor ?? colors.expense;
  const typeLabel = kind === 'income'
    ? t('recurrence.incomeType')
    : t(isSavings ? 'recurrence.savingsType' : 'recurrence.expenseType');
  const categoryName = recurringExpense?.categoryName ?? incomeCategory?.name ?? t('common.notSpecified');
  const categoryColor = recurringExpense?.categoryColor ?? incomeCategory?.color;
  const paymentName = recurringExpense?.paymentMethodName ?? paymentMethod?.name ?? t('common.notSpecified');
  const paymentColor = recurringExpense?.paymentMethodColor ?? paymentMethod?.color;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView style={[styles.hero, { borderTopColor: accent }]}>
          <View style={[styles.iconBox, { backgroundColor: `${accent}18` }]}>
            <Ionicons name={isSavings ? 'flag-outline' : 'repeat-outline'} size={28} color={accent} />
          </View>
          <ThemedText style={[styles.type, { color: accent }]}>{typeLabel}</ThemedText>
          <ThemedText type="title" style={styles.name}>{recurrence.name}</ThemedText>
          <ThemedText style={[styles.amount, { color: accent }]}>{formatCLP(recurrence.amount)}</ThemedText>
          <View style={[styles.statusBadge, { borderColor: recurrence.active ? colors.success : colors.border }]}>
            <View style={[styles.statusDot, { backgroundColor: recurrence.active ? colors.success : colors.icon }]} />
            <ThemedText style={styles.statusText}>{t(recurrence.active ? 'recurrence.active' : 'recurrence.inactive')}</ThemedText>
          </View>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">{t('recurrence.information')}</ThemedText>
          <DetailRow label={t('recurrence.schedule')} value={describeRecurrence(recurrence)} />
          <DetailRow label={t('recurrence.nextExecution')} value={recurrence.nextDate ? formatDate(parseIsoDate(recurrence.nextDate)) : t('recurrence.noNextExecutions')} />
          <DetailRow label={t('recurrence.startDate')} value={formatDate(parseIsoDate(recurrence.startDate))} />
          <DetailRow label={t('recurrence.endDateLabel')} value={recurrence.endDate ? formatDate(parseIsoDate(recurrence.endDate)) : t('recurrence.noEndDate')} />
          <DetailRow label={t('recurrence.registrationMode')} value={recurrence.registrationMode === 'automatic' ? t('common.automatic') : t('recurrence.confirmation')} />
          <DetailRow label={t('recurrence.pendingExecutions')} value={String(recurrence.pendingCount)} />
          {isSavings && recurringExpense?.savingsGoalName ? (
            <DetailRow label={t('recurrence.savingsGoalLabel')} value={recurringExpense.savingsGoalName} color={recurringExpense.savingsGoalColor} />
          ) : (
            <DetailRow label={t('recurrence.category')} value={categoryName} color={categoryColor} />
          )}
          <DetailRow label={t('recurrence.paymentMethod')} value={paymentName} color={paymentColor} />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hero: { borderRadius: 18, borderTopWidth: 5, padding: 24, alignItems: 'center', gap: 7 },
  iconBox: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  type: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  name: { textAlign: 'center' },
  amount: { fontSize: 28, lineHeight: 36, fontWeight: '700' },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700' },
  card: { borderRadius: 18, padding: 20, gap: 4 },
  detailRow: { minHeight: 56, paddingVertical: 11, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#AEBBC755' },
  label: { opacity: 0.65, fontSize: 13 },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  value: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  dot: { width: 11, height: 11, borderRadius: 5.5 },
});
