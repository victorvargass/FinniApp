import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, ToastAndroid, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecurringScheduleFields } from '@/components/recurring-schedule-fields';
import { ThemedText } from '@/components/themed-text';
import { Colors, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Income, NewRecurringSchedule } from '@/lib/types';

import { getDefaultRecurringSchedule, getNameSuggestions, parseDateString } from './helpers';
import { ColorSelect, NameSuggestions } from './shared';
import { styles } from './styles';

type IncomeFormProps = {
  income?: Income;
  initialSavingsGoalId?: number | null;
  onSuccess: () => void;
};

export function IncomeForm({ income, initialSavingsGoalId = null, onSuccess }: IncomeFormProps) {
  const {
    incomeNames,
    addIncome,
    editIncome,
    addRecurringIncomeFromSource,
    savingsGoals,
    periods,
    selectedPeriod,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const initialSavingsGoal = !income && initialSavingsGoalId != null
    ? savingsGoals.find((goal) => goal.id === initialSavingsGoalId && goal.status === 'active')
    : undefined;
  const [name, setName] = useState(
    income?.name ?? (initialSavingsGoal ? `Retiro de ${initialSavingsGoal.name}` : '')
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [amountText, setAmountText] = useState<string>(income?.amount ? formatCLPInput(income.amount) : '');
  const [savingsGoalId, setSavingsGoalId] = useState<number | null>(
    income?.savingsGoalId ?? initialSavingsGoal?.id ?? null
  );
  const [date, setDate] = useState(
    income?.date
      ? parseDateString(income.date)
      : selectedPeriod
        ? (() => {
            const today = new Date();
            const start = parseDateString(selectedPeriod.startDate);
            const end = parseDateString(selectedPeriod.endDate);
            return today >= start && today <= end ? today : end;
          })()
        : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [makeIncomeRecurring, setMakeIncomeRecurring] = useState(false);
  const [incomeSchedule, setIncomeSchedule] = useState<NewRecurringSchedule>(() =>
    getDefaultRecurringSchedule(date)
  );
  const [saving, setSaving] = useState(false);
  const nameSuggestions = getNameSuggestions(incomeNames, name);
  const selectableSavingsGoals = savingsGoals.filter(
    (goal) => goal.status === 'active' || goal.id === savingsGoalId
  );
  const formPeriod = income
    ? periods.find((period) => period.id === income.periodId) ?? selectedPeriod
    : selectedPeriod;

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('validation.invalidIncomeName'));
      return;
    }
    const amount = parseAmount(amountText as string);
    if (amount == null || amount <= 0) {
      Alert.alert(t('common.error'), t('validation.invalidAmount'));
      return;
    }

    // La fecha siempre debe pertenecer al período que el usuario está editando.
    if (formPeriod) {
      // Corrección: la fecha final del periodo puede traer hora 00:00 UTC, así que compara usando las fechas normalizadas a local (sin hora)
      // Establece explícitamente las fechas en local
      const periodStart = new Date(formPeriod.startDate + "T00:00:00");
      const periodEnd = new Date(formPeriod.endDate + "T00:00:00");
      // Elimina la hora para la comparación (local)
      const inputDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const startDateOnly = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
      const endDateOnly = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), periodEnd.getDate());
      if (
        inputDateOnly.getTime() < startDateOnly.getTime() ||
        inputDateOnly.getTime() > endDateOnly.getTime()
      ) {
        Alert.alert(
          t('common.error'),
          t('incomes.dateOutsidePeriod', {
            start: formatDate(new Date(`${formPeriod.startDate}T12:00:00`)),
            end: formatDate(new Date(`${formPeriod.endDate}T12:00:00`)),
          })
        );
        return;
      }
    }

    setSaving(true);
    try {
      const data = { name: name.trim(), amount, date: toDateString(date), savingsGoalId };
      if (income) {
        await editIncome(income.id, data);
        if (makeIncomeRecurring && income.recurringIncomeId == null) {
          await addRecurringIncomeFromSource(income.id, {
            ...incomeSchedule,
            startDate: data.date,
            executionDay: incomeSchedule.frequency === 'monthly' || incomeSchedule.frequency === 'custom'
              ? date.getDate()
              : null,
            registrationMode: incomeSchedule.registrationMode,
          });
        }
        if (Platform.OS === 'android') {
          ToastAndroid.show(savingsGoalId != null ? t('savings.withdrawalUpdated') : makeIncomeRecurring ? t('incomes.updatedWithRecurrence') : t('incomes.updated'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), savingsGoalId != null ? t('savings.withdrawalUpdated') : makeIncomeRecurring ? t('incomes.updatedWithRecurrence') : t('incomes.updated'));
        }
      } else {
        await addIncome(data, makeIncomeRecurring ? {
          ...incomeSchedule,
          startDate: data.date,
          executionDay: incomeSchedule.frequency === 'monthly' || incomeSchedule.frequency === 'custom'
            ? date.getDate()
            : null,
          registrationMode: incomeSchedule.registrationMode,
        } : undefined);
        if (Platform.OS === 'android') {
          ToastAndroid.show(savingsGoalId != null ? t('savings.withdrawalRegistered') : t('incomes.created'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), savingsGoalId != null ? t('savings.withdrawalRegistered') : t('incomes.created'));
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSaveShort'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.formShell}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
      <TextInput
        accessibilityLabel={t('common.name')}
        testID="income-name-input"
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setIsNameFocused(true);
        }}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
        placeholder={t('incomes.namePlaceholder')}
        placeholderTextColor={colors.icon}
      />
      <NameSuggestions
        suggestions={isNameFocused ? nameSuggestions : []}
        onSelect={(suggestion) => {
          setName(suggestion);
          setIsNameFocused(false);
        }}
      />

      <View style={styles.formRemainder} onTouchStart={() => setIsNameFocused(false)}>
      <ThemedText style={styles.label}>{t('incomes.amount')}</ThemedText>
      <TextInput
        accessibilityLabel={t('incomes.amount')}
        testID="income-amount-input"
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={(value) => setAmountText(formatCLPInput(value))}
        placeholder={t('forms.amountPlaceholder')}
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

      {income?.recurringIncomeId == null && selectableSavingsGoals.length > 0 && (
        <>
          <ColorSelect
            label={t('savings.withdrawFromGoalOptional')}
            value={savingsGoalId}
            onChange={(value) => {
              setSavingsGoalId(value);
              if (value != null) {
                setMakeIncomeRecurring(false);
                const selectedGoal = selectableSavingsGoals.find((goal) => goal.id === value);
                if (!name.trim() && selectedGoal) setName(t('savings.withdrawalName', { name: selectedGoal.name }));
              }
            }}
            options={[
              { value: null, label: t('savings.normalIncome'), color: '#1FAF78' },
              ...selectableSavingsGoals.map((goal) => ({
                value: goal.id,
                label: `${goal.name} · ${formatCLP(goal.currentAmount)}`,
                color: goal.color,
              })),
            ]}
          />
          {savingsGoalId != null && (
            <ThemedText style={styles.savingsHint}>
              {t('savings.withdrawalHint')}
            </ThemedText>
          )}
        </>
      )}

      <ThemedText style={styles.label}>{t('forms.date')}</ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: colors.icon }]}
        onPress={() => setShowDatePicker(true)}>
        <ThemedText>{formatDate(date)}</ThemedText>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          minimumDate={formPeriod ? parseDateString(formPeriod.startDate) : undefined}
          maximumDate={formPeriod ? parseDateString(formPeriod.endDate) : undefined}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS === 'android') setShowDatePicker(false);
            if (selected) {
              setDate(selected);
            }
          }}
        />
      )}
      {Platform.OS === 'ios' && showDatePicker && (
        <Pressable style={styles.doneDate} onPress={() => setShowDatePicker(false)}>
          <ThemedText type="link">{t('common.done')}</ThemedText>
        </Pressable>
      )}

      {savingsGoalId == null && (!income || income.recurringIncomeId == null) && (
        <View style={[styles.recurringBox, { borderColor: colors.border }]}>
          <Pressable onPress={() => setMakeIncomeRecurring((current) => !current)} style={styles.recurringHeader}>
            <View style={styles.recurringHeaderCopy}>
              <ThemedText type="defaultSemiBold">{t('expenses.makeRecurring')}</ThemedText>
              <ThemedText style={styles.shareDescription}>{t('incomes.recurringDescription')}</ThemedText>
            </View>
            <Ionicons name={makeIncomeRecurring ? 'chevron-up' : 'chevron-down'} size={21} color={colors.icon} />
          </Pressable>
          {makeIncomeRecurring && (
            <View style={[styles.recurringFields, { borderTopColor: colors.border }]}>
              <RecurringScheduleFields
                value={incomeSchedule}
                onChange={setIncomeSchedule}
                fixedStartDate={toDateString(date)}
                movementKind="ingreso"
              />
            </View>
          )}
        </View>
      )}

      {income?.recurringIncomeId != null && (
        <Pressable
          onPress={() => router.push({ pathname: '/modal/recurring-income-form', params: { id: String(income.recurringIncomeId) } })}
          style={[styles.secondaryAction, { borderColor: colors.border }]}>
          <Ionicons name="repeat-outline" size={19} color={colors.primary} />
          <ThemedText type="defaultSemiBold">{t('recurrence.edit')}</ThemedText>
        </Pressable>
      )}

      </View>
    </ScrollView>
    <View style={[styles.formFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, LayoutTokens.formFooterBottom) }]}>
      <Pressable
        testID="income-save"
        style={[styles.button, styles.footerButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>{income ? t('common.update') : t('common.save')}</ThemedText>
      </Pressable>
    </View>
    </View>
  );
}
