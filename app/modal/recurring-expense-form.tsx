import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecurringScheduleFields } from '@/components/recurring-schedule-fields';
import { ColorSelect } from '@/components/forms/shared';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, parseAmount, toDateString } from '@/lib/format';
import { parseIsoDate } from '@/lib/recurrence';
import { t } from '@/lib/i18n';
import { showToast } from '@/lib/toast';
import type { NewRecurringSchedule } from '@/lib/types';
import { ensureRecurringNotificationPermission } from '@/services/RecurringNotificationService';

function defaultSchedule(date = new Date()): NewRecurringSchedule {
  return {
    frequency: 'monthly',
    intervalMonths: 1,
    executionDay: date.getDate(),
    registrationMode: 'confirmation',
    startDate: toDateString(date),
    endDate: null,
    active: true,
  };
}

function showResult(message: string) {
  showToast(message);
}

function MetadataChip({ label, color }: { label: string; color: string }) {
  return (
    <View style={[styles.metadataChip, { borderColor: color, backgroundColor: `${color}1f` }]}>
      <View style={[styles.metadataDot, { backgroundColor: color }]} />
      <ThemedText style={styles.metadataChipText} numberOfLines={1}>{label}</ThemedText>
    </View>
  );
}

export default function RecurringExpenseFormScreen() {
  const { id, sourceExpenseId: requestedSourceId } = useLocalSearchParams<{
    id?: string;
    sourceExpenseId?: string;
  }>();
  const {
    recurringExpenses,
    expenses,
    categories,
    paymentMethods,
    settings,
    addRecurringExpense,
    editRecurringExpense,
    removeRecurringExpense,
  } = useDatabase();
  const navigation = useNavigation();
  const colors = Colors[useColorScheme() ?? 'light'];
  const recurring = id ? recurringExpenses.find((item) => item.id === Number(id)) : undefined;
  const requestedSource = requestedSourceId
    ? expenses.find((item) => item.id === Number(requestedSourceId))
    : undefined;

  const [schedule, setSchedule] = useState<NewRecurringSchedule>(recurring
    ? {
        frequency: recurring.frequency,
        intervalMonths: recurring.intervalMonths,
        executionDay: recurring.executionDay,
        registrationMode: recurring.registrationMode,
        startDate: recurring.startDate,
        endDate: recurring.endDate,
        active: recurring.active,
      }
    : defaultSchedule(requestedSource ? parseIsoDate(requestedSource.date) : new Date()));
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [useStoredNextDate, setUseStoredNextDate] = useState(recurring != null);

  const expenseDetails = recurring ?? requestedSource;
  const defaultPaymentMethodId = paymentMethods.find(
    (method) => method.id === settings.defaultPaymentMethodId && method.active
  )?.id ?? paymentMethods.find((method) => method.active)?.id ?? null;
  const [name, setName] = useState(expenseDetails?.name ?? '');
  const [amountText, setAmountText] = useState(
    expenseDetails ? formatCLPInput(expenseDetails.amount) : ''
  );
  const [categoryId, setCategoryId] = useState<number | null>(expenseDetails?.categoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(
    expenseDetails?.paymentMethodId ?? defaultPaymentMethodId
  );
  const canEditMovement = expenseDetails == null || (recurring != null && recurring.sourceExpenseId == null);

  useEffect(() => {
    navigation.setOptions({ title: recurring ? t('recurrence.edit') : t('recurrence.newExpense') });
  }, [navigation, recurring]);

  const save = async () => {
    const amount = canEditMovement ? parseAmount(amountText) : expenseDetails?.amount;
    const recurringName = canEditMovement ? name.trim() : expenseDetails?.name ?? '';
    if (!recurringName || amount == null || amount <= 0) {
      return Alert.alert(t('validation.missingData'), t('recurrence.invalidNameAmount'));
    }
    const notificationsGranted = await ensureRecurringNotificationPermission();
    if (!notificationsGranted && schedule.registrationMode === 'confirmation') {
      return Alert.alert(
        t('expenses.notificationsDisabled'), t('expenses.notificationsDisabledHint')
      );
    }
    setSaving(true);
    try {
      const data = {
        name: recurringName,
        amount,
        originalAmount: expenseDetails?.originalAmount ?? null,
        splitPercentage: expenseDetails?.splitPercentage ?? null,
        categoryId: canEditMovement ? categoryId : expenseDetails?.categoryId ?? null,
        paymentMethodId: canEditMovement ? paymentMethodId : expenseDetails?.paymentMethodId ?? null,
        savingsGoalId: expenseDetails?.savingsGoalId ?? null,
        savingsKind: expenseDetails?.savingsKind === 'contribution' ? 'contribution' as const : null,
        ...schedule,
        sourceExpenseId: recurring ? recurring.sourceExpenseId : requestedSource?.id ?? null,
      };
      if (recurring) await editRecurringExpense(recurring.id, data);
      else await addRecurringExpense(data);
      showResult(recurring ? t('recurrence.updated') : t('recurrence.created'));
      router.back();
    } catch (error) {
      Alert.alert(t('errors.couldNotSave'), error instanceof Error ? error.message : t('common.tryAgain'));
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    if (!recurring) return;
    Alert.alert(
      t('recurrence.delete'), t('recurrence.deleteExpenseSchedule'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setRemoving(true);
            try {
              await removeRecurringExpense(recurring.id);
              showResult(t('recurrence.deleted'));
              router.back();
            } catch (error) {
              Alert.alert(
                t('errors.couldNotDelete'), error instanceof Error ? error.message : t('common.tryAgain')
              );
            } finally {
              setRemoving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {expenseDetails && !canEditMovement ? (
          <ThemedView style={[styles.detailsCard, { borderColor: colors.border }]}>
            <View style={styles.detailsHeader}>
              <View style={styles.sourceCopy}>
                <ThemedText style={styles.hint}>{t('navigation.expense')}</ThemedText>
                <ThemedText type="defaultSemiBold">{expenseDetails.name}</ThemedText>
              </View>
              <ThemedText type="defaultSemiBold">{formatCLP(expenseDetails.amount)}</ThemedText>
            </View>
            <View style={styles.metadataChips}>
              <MetadataChip
                label={expenseDetails.categoryName ?? t('expenses.noCategory')}
                color={expenseDetails.categoryColor ?? '#60758E'}
              />
              <MetadataChip
                label={expenseDetails.paymentMethodName ?? t('expenses.noPaymentMethod')}
                color={expenseDetails.paymentMethodColor ?? '#60758E'}
              />
            </View>
            {recurring?.sourceExpenseId != null && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('recurrence.editSourceExpense')}
                onPress={() => router.push({
                  pathname: '/modal/expense-form',
                  params: { id: String(recurring.sourceExpenseId) },
                })}
                style={({ pressed }) => [
                  styles.editSource,
                  { borderColor: colors.border },
                  pressed && styles.disabled,
                ]}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
                <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>
                  {t('recurrence.editSourceExpense')}
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ) : (
          <View style={styles.newMovementFields}>
            <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('expenses.namePlaceholder')}
              placeholderTextColor={colors.icon}
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <ThemedText style={styles.label}>{t('filters.amount')}</ThemedText>
            <TextInput
              value={amountText}
              onChangeText={(value) => setAmountText(formatCLPInput(value))}
              keyboardType="number-pad"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <ColorSelect
              label={t('expenses.categoryOptional')}
              value={categoryId}
              onChange={setCategoryId}
              options={[
                { value: null, label: t('expenses.noCategory'), color: colors.icon },
                ...categories
                  .filter((category) => category.systemKey == null)
                  .map((category) => ({ value: category.id, label: category.name, color: category.color })),
              ]}
            />
            <ColorSelect
              label={t('expenses.paymentMethodOptional')}
              value={paymentMethodId}
              onChange={setPaymentMethodId}
              options={[
                { value: null, label: t('expenses.noPaymentMethod'), color: colors.icon },
                ...paymentMethods
                  .filter((method) => method.active)
                  .map((method) => ({
                    value: method.id,
                    label: `${method.name} · ${t(`paymentMethods.${method.type}`)}`,
                    color: method.color,
                  })),
              ]}
            />
            <ThemedText style={styles.emptyHint}>{t('recurrence.standaloneHint')}</ThemedText>
          </View>
        )}

        <View style={[styles.divider, { borderTopColor: colors.border }]} />
        <RecurringScheduleFields
          value={schedule}
          onChange={(nextSchedule) => {
            const timingChanged =
              nextSchedule.frequency !== schedule.frequency ||
              nextSchedule.intervalMonths !== schedule.intervalMonths ||
              nextSchedule.executionDay !== schedule.executionDay ||
              nextSchedule.startDate !== schedule.startDate ||
              nextSchedule.endDate !== schedule.endDate;
            setSchedule(nextSchedule);
            if (timingChanged) setUseStoredNextDate(false);
          }}
          showActiveToggle
          fixedStartDate={recurring?.startDate ?? requestedSource?.date}
          storedNextDate={useStoredNextDate ? recurring?.nextDate ?? null : undefined}
        />

        <Pressable
          disabled={saving || removing}
          onPress={save}
          style={[styles.save, (saving || removing) && styles.disabled]}>
          <ThemedText style={styles.saveText}>{recurring ? t('common.saveChanges') : t('recurrence.create')}</ThemedText>
        </Pressable>

        {recurring && (
          <Pressable
            disabled={saving || removing}
            onPress={confirmRemove}
            style={[styles.remove, (saving || removing) && styles.disabled]}>
            <ThemedText style={styles.removeText}>
              {removing ? t('recurrence.deleting') : t('recurrence.delete')}
            </ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 20, paddingBottom: LayoutTokens.formScrollBottom, gap: 10 },
  sourceCopy: { flex: 1, gap: 2 },
  hint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  detailsCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metadataChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metadataChip: {
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  metadataDot: { width: 8, height: 8, borderRadius: 4 },
  metadataChipText: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  editSource: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
    marginTop: 2,
  },
  emptyHint: { textAlign: 'center', opacity: 0.65, marginVertical: 16 },
  newMovementFields: { gap: 10 },
  label: { fontFamily: Fonts.bold, marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16, fontFamily: Fonts.regular },
  divider: { borderTopWidth: 1, marginVertical: 10 },
  save: { marginTop: 18, borderRadius: 10, padding: 14, alignItems: 'center', backgroundColor: '#0B315B' },
  saveText: { color: '#fff', fontWeight: '700' },
  remove: { marginTop: 4, borderRadius: 10, padding: 14, alignItems: 'center' },
  removeText: { color: '#C93F4B', fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
