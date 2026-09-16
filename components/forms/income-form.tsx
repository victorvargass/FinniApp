import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecurringScheduleFields } from '@/components/recurring-schedule-fields';
import { ThemedText } from '@/components/themed-text';
import { Colors, LayoutTokens } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatCLPInput, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { getPaymentMethodOptionGroup } from '@/lib/payment-method-options';
import { showToast } from '@/lib/toast';
import type { Income, NewRecurringSchedule } from '@/lib/types';

import { getDefaultRecurringSchedule, getNameSuggestions, parseDateString } from './helpers';
import { ColorSelect, NameSuggestions } from './shared';
import { styles } from './styles';

type IncomeFormProps = {
  income?: Income;
  templateIncome?: Income;
  initialSavingsGoalId?: number | null;
  onSuccess: () => void;
};

export function IncomeForm({ income, templateIncome, initialSavingsGoalId = null, onSuccess }: IncomeFormProps) {
  const {
    incomeNames,
    addIncome,
    editIncome,
    removeIncome,
    addRecurringIncomeFromSource,
    savingsGoals,
    paymentMethods,
    settings,
    periods,
    selectedPeriod,
    setPeriodEndDate,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const initialIncome = income ?? templateIncome;
  const eligiblePaymentMethods = paymentMethods.filter(
    (method) => method.type !== 'credit' && (method.active || method.id === initialIncome?.paymentMethodId)
  );
  const defaultPaymentMethodId = eligiblePaymentMethods.find(
    (method) => method.id === settings.defaultPaymentMethodId && method.active
  )?.id ?? eligiblePaymentMethods.find((method) => method.active)?.id ?? null;

  const initialSavingsGoal = !income && !templateIncome && initialSavingsGoalId != null
    ? savingsGoals.find((goal) => (
        goal.id === initialSavingsGoalId
        && goal.status === 'active'
        && goal.allowWithdrawals
      ))
    : undefined;
  const isContextualSavingsWithdrawal = initialSavingsGoal != null;
  const [name, setName] = useState(
    initialIncome?.name ?? (initialSavingsGoal
      ? t('savings.withdrawalName', { name: initialSavingsGoal.name })
      : '')
  );
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [amountText, setAmountText] = useState<string>(initialIncome?.amount ? formatCLPInput(initialIncome.amount) : '');
  const [savingsGoalId, setSavingsGoalId] = useState<number | null>(
    income?.savingsGoalId ?? initialSavingsGoal?.id ?? null
  );
  const [isSavingsWithdrawal, setIsSavingsWithdrawal] = useState(
    (income?.savingsGoalId ?? initialSavingsGoal?.id) != null
  );
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(
    initialIncome?.paymentMethodId ?? defaultPaymentMethodId
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
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(Boolean(income || initialSavingsGoal));
  const [incomeSchedule, setIncomeSchedule] = useState<NewRecurringSchedule>(() =>
    getDefaultRecurringSchedule(date)
  );
  const [saving, setSaving] = useState(false);
  const nameSuggestions = getNameSuggestions(incomeNames, name);
  const selectableSavingsGoals = savingsGoals.filter(
    (goal) => (goal.status === 'active' && goal.allowWithdrawals) || goal.id === savingsGoalId
  );
  const moreOptionsHint = isContextualSavingsWithdrawal || isSavingsWithdrawal
    ? t('incomes.moreOptionsWithdrawalHint')
    : selectableSavingsGoals.length > 0
      ? t('incomes.moreOptionsHint')
      : t('incomes.moreOptionsStandardHint');
  const formPeriod = income
    ? periods.find((period) => period.id === income.periodId) ?? selectedPeriod
    : selectedPeriod;
  const todayString = toDateString(new Date());
  const canExtendCurrentPeriod = !income && formPeriod?.id === settings.currentPeriodId;
  const maximumMovementDate = formPeriod
    ? parseDateString(
        canExtendCurrentPeriod && formPeriod.endDate < todayString
          ? todayString
          : formPeriod.endDate
      )
    : undefined;

  const selectMovementDate = (selected: Date) => {
    const selectedDate = toDateString(selected);
    if (!formPeriod || !canExtendCurrentPeriod || selectedDate <= formPeriod.endDate) {
      setDate(selected);
      return;
    }

    Alert.alert(
      t('period.extendForMovementTitle'),
      t('period.extendForMovementMessage', {
        end: formatDate(parseDateString(formPeriod.endDate)),
        date: formatDate(selected),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('period.extendForMovementAction'),
          onPress: () => {
            void setPeriodEndDate(selectedDate)
              .then(() => {
                setDate(selected);
                showToast(t('period.endDateUpdated'));
              })
              .catch((error) => {
                Alert.alert(t('common.error'), error instanceof Error ? error.message : t('period.updateEndError'));
              });
          },
        },
      ]
    );
  };

  const toggleAdvancedOptions = () => {
    if (showAdvancedOptions) {
      setMakeIncomeRecurring(false);
    }
    setShowAdvancedOptions((current) => !current);
  };

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
    if (paymentMethodId == null) {
      Alert.alert(t('common.error'), t('incomes.destinationRequired'));
      return;
    }
    if (isSavingsWithdrawal && savingsGoalId == null) {
      Alert.alert(t('common.error'), t('savings.withdrawalSourceRequired'));
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
      const effectiveSavingsGoalId = isSavingsWithdrawal ? savingsGoalId : null;
      const data = {
        name: name.trim(),
        amount,
        date: toDateString(date),
        savingsGoalId: effectiveSavingsGoalId,
        paymentMethodId,
      };
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
        showToast(effectiveSavingsGoalId != null ? t('savings.withdrawalUpdated') : makeIncomeRecurring ? t('incomes.updatedWithRecurrence') : t('incomes.updated'));
      } else {
        await addIncome(data, makeIncomeRecurring ? {
          ...incomeSchedule,
          startDate: data.date,
          executionDay: incomeSchedule.frequency === 'monthly' || incomeSchedule.frequency === 'custom'
            ? date.getDate()
            : null,
          registrationMode: incomeSchedule.registrationMode,
        } : undefined);
        showToast(effectiveSavingsGoalId != null ? t('savings.withdrawalRegistered') : t('incomes.created'));
      }
      onSuccess();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSaveShort'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteIncome = () => {
    if (!income || saving) return;
    const isWithdrawal = income.savingsGoalId != null;
    Alert.alert(
      isWithdrawal ? t('savings.deleteWithdrawal') : t('incomes.delete'),
      isWithdrawal
        ? t('savings.deleteWithdrawalQuestion', { name: income.name })
        : t('incomes.deleteQuestion', { name: income.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            void removeIncome(income.id)
              .then(() => {
                showToast(isWithdrawal ? t('savings.withdrawalDeleted') : t('incomes.deleted'));
                onSuccess();
              })
              .catch((error) => {
                Alert.alert(
                  t('common.error'),
                  error instanceof Error ? error.message : t('incomes.deleteError')
                );
              })
              .finally(() => setSaving(false));
          },
        },
      ]
    );
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

      <ColorSelect
        label={savingsGoalId != null ? t('incomes.withdrawalDestination') : t('incomes.receiveIn')}
        value={paymentMethodId}
        onChange={setPaymentMethodId}
        options={eligiblePaymentMethods.map((method) => ({
          value: method.id,
          label: `${method.name} · ${t(`paymentMethods.${method.type}`)}`,
          color: method.color,
          ...getPaymentMethodOptionGroup(method.type),
        }))}
      />
      <ThemedText style={styles.shareDescription}>
        {savingsGoalId != null ? t('incomes.withdrawalDestinationHint') : t('incomes.destinationHint')}
      </ThemedText>

      {isContextualSavingsWithdrawal && (
        <>
          <ColorSelect
            label={t('savings.withdrawalSource')}
            value={savingsGoalId}
            onChange={setSavingsGoalId}
            disabled
            options={selectableSavingsGoals.map((goal) => ({
              value: goal.id,
              label: `${goal.name} · ${formatCLP(goal.currentAmount)}`,
              color: goal.color,
            }))}
          />
          <ThemedText style={styles.savingsHint}>
            {t('savings.withdrawalHint')}
          </ThemedText>
        </>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvancedOptions }}
        onPress={toggleAdvancedOptions}
        style={[styles.advancedOptions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.advancedOptionsCopy}>
          <Ionicons name="options-outline" size={21} color={colors.action} />
          <View style={styles.advancedOptionsText}>
            <ThemedText type="defaultSemiBold">{t('incomes.moreOptions')}</ThemedText>
            <ThemedText style={styles.shareDescription}>{moreOptionsHint}</ThemedText>
          </View>
        </View>
        <Ionicons
          name={showAdvancedOptions ? 'chevron-up' : 'chevron-down'}
          size={21}
          color={colors.icon}
        />
      </Pressable>

      {showAdvancedOptions && !isContextualSavingsWithdrawal && income?.recurringIncomeId == null && selectableSavingsGoals.length > 0 && (
        <>
          <View style={styles.shareToggleRow}>
            <View style={styles.shareToggleCopy}>
              <ThemedText style={styles.shareLabel}>{t('savings.withdrawalToggle')}</ThemedText>
              <ThemedText style={styles.shareDescription}>{t('savings.withdrawalToggleHint')}</ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('savings.withdrawalToggle')}
              onValueChange={(enabled) => {
                setIsSavingsWithdrawal(enabled);
                if (enabled) {
                  const nextGoalId = savingsGoalId ?? selectableSavingsGoals[0]?.id ?? null;
                  setSavingsGoalId(nextGoalId);
                  const selectedGoal = selectableSavingsGoals.find((goal) => goal.id === nextGoalId);
                  if (!name.trim() && selectedGoal) {
                    setName(t('savings.withdrawalName', { name: selectedGoal.name }));
                  }
                  setMakeIncomeRecurring(false);
                } else {
                  setSavingsGoalId(null);
                }
              }}
              trackColor={{ true: colors.tint }}
              value={isSavingsWithdrawal}
            />
          </View>
          {isSavingsWithdrawal && (
            <ColorSelect
              label={t('savings.withdrawalSource')}
              value={savingsGoalId}
              onChange={(value) => {
                setSavingsGoalId(value);
                const selectedGoal = selectableSavingsGoals.find((goal) => goal.id === value);
                if (!name.trim() && selectedGoal) {
                  setName(t('savings.withdrawalName', { name: selectedGoal.name }));
                }
              }}
              options={selectableSavingsGoals.map((goal) => ({
                value: goal.id,
                label: `${goal.name} · ${formatCLP(goal.currentAmount)}`,
                color: goal.color,
              }))}
            />
          )}
          {isSavingsWithdrawal && savingsGoalId != null && (
            <ThemedText style={styles.savingsHint}>
              {t('savings.withdrawalHint')}
            </ThemedText>
          )}
        </>
      )}

      {showAdvancedOptions && (
        <>
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
              maximumDate={maximumMovementDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) selectMovementDate(selected);
              }}
            />
          )}
          {Platform.OS === 'ios' && showDatePicker && (
            <Pressable style={styles.doneDate} onPress={() => setShowDatePicker(false)}>
              <ThemedText type="link">{t('common.done')}</ThemedText>
            </Pressable>
          )}
        </>
      )}

      {showAdvancedOptions && !isSavingsWithdrawal && (!income || income.recurringIncomeId == null) && (
        <View style={[styles.recurringBox, { borderColor: colors.border }]}>
          <View style={styles.recurringHeader}>
            <View style={styles.recurringHeaderCopy}>
              <ThemedText type="defaultSemiBold">{t('expenses.makeRecurring')}</ThemedText>
              <ThemedText style={styles.shareDescription}>{t('incomes.recurringDescription')}</ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('expenses.makeRecurring')}
              onValueChange={setMakeIncomeRecurring}
              trackColor={{ false: colors.border, true: colors.tint }}
              value={makeIncomeRecurring}
            />
          </View>
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

      {income && (
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={confirmDeleteIncome}
          style={styles.deleteButton}
          testID="income-delete">
          <ThemedText style={styles.deleteButtonText}>
            {income.savingsGoalId != null ? t('savings.deleteWithdrawal') : t('incomes.delete')}
          </ThemedText>
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
