import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import { showToast } from '@/lib/toast';
import { VIRTUAL_SAVINGS_PAYMENT_METHOD_ID } from '@/lib/types';
import type { Expense, NewRecurringSchedule, SavingsExpenseKind } from '@/lib/types';
import { ensureRecurringNotificationPermission } from '@/services/RecurringNotificationService';

import { getDefaultRecurringSchedule, getEstimatedBillingDate, getNameSuggestions, parseDateString } from './helpers';
import { ColorSelect, NameSuggestions } from './shared';
import { styles } from './styles';

const LAST_EXPENSE_PAYMENT_METHOD_KEY = '@finniapp/last-expense-payment-method-id';

type ExpenseFormProps = {
  expense?: Expense;
  templateExpense?: Expense;
  initialCreditPaymentTargetId?: number;
  onSuccess: () => void;
};

export function ExpenseForm({ expense, templateExpense, initialCreditPaymentTargetId, onSuccess }: ExpenseFormProps) {
  const {
    categories,
    paymentMethods,
    expenseNames,
    addExpense,
    addInstallmentPurchase,
    editExpense,
    savingsGoals,
    periods,
    selectedPeriod,
    getCreditCardCycles,
    settings,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const initialExpense = expense ?? templateExpense;

  const [name, setName] = useState(initialExpense?.name ?? '');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const expenseWasSplit =
    initialExpense?.originalAmount != null && initialExpense.splitPercentage != null;
  const [amountText, setAmountText] = useState<string>(
    initialExpense ? formatCLPInput(initialExpense.originalAmount ?? initialExpense.amount) : ''
  );
  const [isSplitAmount, setIsSplitAmount] = useState(expenseWasSplit);
  const [splitMode, setSplitMode] = useState<'percentage' | 'amount'>('percentage');
  const [percentageText, setPercentageText] = useState(
    expenseWasSplit ? String(initialExpense?.splitPercentage) : '50'
  );
  const [shareAmountText, setShareAmountText] = useState(
    expenseWasSplit && initialExpense ? formatCLPInput(initialExpense.amount) : ''
  );
  const [usesCustomPercentage, setUsesCustomPercentage] = useState(
    expenseWasSplit && ![50, 25].includes(initialExpense!.splitPercentage!)
  );
  const creditPaymentCategory = categories.find((category) => category.systemKey === 'credit_payment');
  const [categoryId, setCategoryId] = useState<number | null>(
    initialExpense?.categoryId ?? (initialCreditPaymentTargetId ? creditPaymentCategory?.id ?? null : null)
  );
  const [creditPaymentTargetId, setCreditPaymentTargetId] = useState<number | null>(
    expense?.creditPaymentTargetId ?? initialCreditPaymentTargetId ?? null
  );
  const [savingsGoalId, setSavingsGoalId] = useState<number | null>(expense?.savingsGoalId ?? null);
  const [savingsKind, setSavingsKind] = useState<SavingsExpenseKind | null>(expense?.savingsKind ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(
    initialExpense?.paymentMethodId ?? settings.defaultPaymentMethodId
  );
  const [hasLoadedLastPaymentMethod, setHasLoadedLastPaymentMethod] = useState(false);
  const [date, setDate] = useState(
    expense?.date
      ? parseDateString(expense.date)
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
  const [makeRecurring, setMakeRecurring] = useState(false);
  const [isInstallmentPurchase, setIsInstallmentPurchase] = useState(false);
  const [installmentCountText, setInstallmentCountText] = useState('3');
  const [installmentPreset, setInstallmentPreset] = useState<number | null>(3);
  const [firstInstallmentTiming, setFirstInstallmentTiming] = useState<'current' | 'next'>('current');
  const [recurringSchedule, setRecurringSchedule] = useState<NewRecurringSchedule>(() =>
    getDefaultRecurringSchedule(date)
  );
  const [billingCycleHint, setBillingCycleHint] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(Boolean(expense || expenseWasSplit));
  const [saving, setSaving] = useState(false);
  const totalAmount = parseAmount(amountText as string);
  const percentage = Number(percentageText.replace(',', '.'));
  const hasValidPercentage =
    Number.isFinite(percentage) && percentage > 0 && percentage <= 100;
  const shareAmount = parseAmount(shareAmountText);
  const hasValidShareAmount = shareAmount != null
    && totalAmount != null
    && shareAmount <= totalAmount;
  const amountToSave =
    totalAmount == null
      ? null
      : !isSplitAmount
        ? totalAmount
        : splitMode === 'amount'
          ? (hasValidShareAmount ? shareAmount : null)
          : (hasValidPercentage ? Math.round(totalAmount * percentage / 100) : null);
  const splitPercentageToSave = isSplitAmount && totalAmount != null && amountToSave != null
    ? splitMode === 'percentage'
      ? percentage
      : Number(((amountToSave / totalAmount) * 100).toFixed(6))
    : null;
  const nameSuggestions = getNameSuggestions(expenseNames, name);
  const visiblePaymentMethods = paymentMethods.filter(
    (method) => method.active || method.id === paymentMethodId
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const isSavingsCategory = selectedCategory?.purpose === 'savings';
  const isCardPayment = selectedCategory?.systemKey === 'credit_payment';
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === paymentMethodId);
  const targetCreditCard = paymentMethods.find((method) => method.id === creditPaymentTargetId);
  const canUseCreditPayment = paymentMethods.some((method) => method.active && method.type === 'credit')
    || targetCreditCard?.type === 'credit';
  const isCreditPaymentTargetLocked = expense == null
    && initialCreditPaymentTargetId != null
    && targetCreditCard?.type === 'credit';
  const balanceReferenceMethods = isCardPayment
    ? [selectedPaymentMethod, targetCreditCard]
    : [selectedPaymentMethod];
  const historicalBalanceMethod = balanceReferenceMethods.find(
    (method) => method?.balanceUpdatedAt != null && toDateString(date) < method.balanceUpdatedAt
  );
  const trackedAvailableBalance = selectedPaymentMethod?.type === 'cash'
    ? null
    : selectedPaymentMethod?.availableBalance ?? null;
  const exceedsAvailableBalance = !expense
    && amountToSave != null
    && trackedAvailableBalance != null
    && amountToSave > trackedAvailableBalance;
  const isSavingsRelated = isSavingsCategory || savingsKind != null;
  const selectablePaymentMethods = visiblePaymentMethods.filter(
    (method) => (!isSavingsRelated && !isCardPayment) || method.type !== 'credit'
  );
  const selectableSavingsGoals = savingsGoals.filter(
    (goal) => goal.status === 'active' || goal.id === savingsGoalId
  );
  const withdrawableSavingsGoals = savingsGoals.filter(
    (goal) => (goal.status === 'active' && goal.allowWithdrawals)
      || (goal.id === savingsGoalId && savingsKind === 'funded_expense')
  );
  const formPeriod = expense
    ? periods.find((period) => period.id === expense.periodId) ?? selectedPeriod
    : selectedPeriod;
  const isCreditPurchase = !isCardPayment && !isSavingsRelated && selectedPaymentMethod?.type === 'credit';
  const installmentCount = Number(installmentCountText);
  const estimatedInstallmentAmount = amountToSave != null && Number.isInteger(installmentCount) && installmentCount > 0
    ? Math.floor(amountToSave / installmentCount)
    : null;
  const estimatedFirstDueDate = isCreditPurchase && selectedPaymentMethod.billingDay != null
    ? (() => {
        const estimated = getEstimatedBillingDate(date, selectedPaymentMethod.billingDay!);
        if (firstInstallmentTiming === 'next') estimated.setMonth(estimated.getMonth() + 1);
        return estimated;
      })()
    : null;
  const moreOptionsHint = isCardPayment
    ? t('expenses.moreOptionsCardPaymentHint')
    : savingsKind === 'funded_expense'
      ? t('expenses.moreOptionsSavingsWithdrawalHint')
      : isSavingsCategory
        ? t('expenses.moreOptionsSavingsHint')
        : isInstallmentPurchase
          ? t('expenses.moreOptionsInstallmentHint')
          : isCreditPurchase
            ? t('expenses.moreOptionsHint')
            : t('expenses.moreOptionsStandardHint');

  useEffect(() => {
    if (hasLoadedLastPaymentMethod) return;
    if (initialExpense || initialCreditPaymentTargetId || settings.defaultPaymentMethodId != null) {
      setHasLoadedLastPaymentMethod(true);
      return;
    }
    if (paymentMethods.length === 0) return;

    let cancelled = false;
    AsyncStorage.getItem(LAST_EXPENSE_PAYMENT_METHOD_KEY)
      .then((storedId) => {
        if (cancelled || storedId == null) return;
        const parsedId = Number(storedId);
        const rememberedMethod = paymentMethods.find(
          (method) => method.id === parsedId && method.active
        );
        if (rememberedMethod) setPaymentMethodId(rememberedMethod.id);
      })
      .finally(() => {
        if (!cancelled) setHasLoadedLastPaymentMethod(true);
      });
    return () => { cancelled = true; };
  }, [hasLoadedLastPaymentMethod, initialCreditPaymentTargetId, initialExpense, paymentMethods, settings.defaultPaymentMethodId]);

  useEffect(() => {
    if (!isCreditPurchase) setIsInstallmentPurchase(false);
  }, [isCreditPurchase]);

  useEffect(() => {
    if (!initialCreditPaymentTargetId || expense || !creditPaymentCategory) return;
    setCategoryId(creditPaymentCategory.id);
  }, [creditPaymentCategory, expense, initialCreditPaymentTargetId]);

  useEffect(() => {
    if (!isCardPayment) {
      setCreditPaymentTargetId(null);
      return;
    }
    if (creditPaymentTargetId == null) {
      const defaultTarget = paymentMethods.find(
        (method) => method.type === 'credit' && method.active
      );
      if (defaultTarget) {
        setCreditPaymentTargetId(defaultTarget.id);
        return;
      }
    }
    setIsInstallmentPurchase(false);
    setMakeRecurring(false);
    setIsSplitAmount(false);
    setSavingsGoalId(null);
    setSavingsKind(null);
    if (selectedPaymentMethod?.type === 'credit') setPaymentMethodId(null);
    const target = paymentMethods.find((method) => method.id === creditPaymentTargetId);
    if (!expense && target && (!name.trim() || name === creditPaymentCategory?.name)) {
      setName(`${creditPaymentCategory?.name ?? ''} · ${target.name}`);
    }
  }, [creditPaymentCategory?.name, creditPaymentTargetId, expense, isCardPayment, name, paymentMethods, selectedPaymentMethod]);

  useEffect(() => {
    if (isSavingsRelated && selectedPaymentMethod?.type === 'credit') {
      setPaymentMethodId(null);
    }
  }, [isSavingsRelated, selectedPaymentMethod]);

  useEffect(() => {
    if (isInstallmentPurchase) {
      setSavingsGoalId(null);
      setSavingsKind(null);
      return;
    }
    if (isSavingsCategory && savingsKind === 'funded_expense') {
      setSavingsGoalId(null);
      setSavingsKind(null);
    } else if (!isSavingsCategory && savingsKind === 'contribution') {
      setSavingsGoalId(null);
      setSavingsKind(null);
    }
  }, [isInstallmentPurchase, isSavingsCategory, savingsKind]);

  useEffect(() => {
    const method = paymentMethods.find((item) => item.id === paymentMethodId);
    if (method?.type !== 'credit' || method.billingDay == null) {
      setBillingCycleHint(null);
      return;
    }
    let cancelled = false;
    const purchaseIso = toDateString(date);
    getCreditCardCycles(method.id)
      .then((cycles) => {
        if (cancelled) return;
        const actualCycle = cycles.find(
          (cycle) => purchaseIso >= cycle.startDate && purchaseIso <= cycle.endDate
        );
        if (actualCycle) {
          setBillingCycleHint(
            t('paymentMethods.belongsToCycle', {
              prefix: method.active ? '' : t('paymentMethods.inactiveAssociated', { name: method.name }),
              date: formatDate(parseDateString(actualCycle.endDate)),
            })
          );
          return;
        }
        setBillingCycleHint(
          t('paymentMethods.estimatedCycle', {
            prefix: method.active ? '' : t('paymentMethods.inactiveAssociated', { name: method.name }),
            date: formatDate(getEstimatedBillingDate(date, method.billingDay!)),
          })
        );
      })
      .catch(() => setBillingCycleHint(null));
    return () => { cancelled = true; };
  }, [date, getCreditCardCycles, paymentMethodId, paymentMethods]);

  useEffect(() => {
    if (expense || !makeRecurring) return;
    setRecurringSchedule((current) => ({
      ...current,
      startDate: toDateString(date),
      executionDay: current.frequency === 'monthly' || current.frequency === 'custom'
        ? date.getDate()
        : null,
    }));
  }, [date, expense, makeRecurring]);

  const handleSave = async (skipAvailableBalanceWarning = false) => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('validation.invalidExpenseName'));
      return;
    }
    if (isSplitAmount && splitMode === 'percentage' && !hasValidPercentage) {
      Alert.alert(t('common.error'), t('validation.invalidPercentage'));
      return;
    }
    if (isSplitAmount && splitMode === 'amount' && !hasValidShareAmount) {
      Alert.alert(t('common.error'), t('validation.invalidSplitAmount'));
      return;
    }
    if (amountToSave == null || amountToSave <= 0) {
      Alert.alert(t('common.error'), t('validation.invalidAmount'));
      return;
    }
    if (isCardPayment && creditPaymentTargetId == null) {
      Alert.alert(t('common.error'), t('database.creditPaymentTargetRequired'));
      return;
    }
    if (isCardPayment && paymentMethodId == null) {
      Alert.alert(t('common.error'), t('database.creditPaymentSourceRequired'));
      return;
    }
    if (exceedsAvailableBalance && !skipAvailableBalanceWarning && selectedPaymentMethod) {
      Alert.alert(
        selectedPaymentMethod.type === 'credit'
          ? t('expenses.insufficientCreditTitle')
          : t('expenses.insufficientBalanceTitle'),
        t('expenses.availableBalanceWarning', {
          amount: formatCLP(amountToSave),
          available: formatCLP(trackedAvailableBalance),
          difference: formatCLP(amountToSave - trackedAvailableBalance),
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('expenses.continueAnyway'),
            onPress: () => { void handleSave(true); },
          },
        ]
      );
      return;
    }
    if (!expense && makeRecurring) {
      const granted = await ensureRecurringNotificationPermission();
      if (!granted && recurringSchedule.registrationMode === 'confirmation') {
        Alert.alert(
          t('expenses.notificationsDisabled'),
          t('expenses.notificationsDisabledHint')
        );
        return;
      }
    }

    if (formPeriod) {
      const startDate = parseDateString(formPeriod.startDate);
      const endDate = parseDateString(formPeriod.endDate);

      // Limpiar time por si acaso (comparar sólo fechas)
      const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const minDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const maxDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      if (selectedDate < minDate || selectedDate > maxDate) {
        Alert.alert(
          t('common.error'),
          t('expenses.dateOutsidePeriod', { start: formatDate(startDate), end: formatDate(endDate) })
        );
        return;
      }
    }
    
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        amount: amountToSave,
        originalAmount: isSplitAmount ? totalAmount : null,
        splitPercentage: splitPercentageToSave,
        categoryId,
        paymentMethodId,
        savingsGoalId,
        savingsKind,
        creditPaymentTargetId: isCardPayment ? creditPaymentTargetId : null,
        date: toDateString(date),
      };
      if (expense) {
        await editExpense(expense.id, data);
        showToast(t('expenses.updated'));
      } else {
        if (isInstallmentPurchase) {
          if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 600) {
            throw new Error(t('installments.invalidCount'));
          }
          if (!estimatedFirstDueDate || paymentMethodId == null || totalAmount == null) {
            throw new Error(t('installments.calculateFirstError'));
          }
          await addInstallmentPurchase({
            name: data.name,
            totalAmount: amountToSave!,
            categoryId: data.categoryId,
            paymentMethodId,
            purchaseDate: data.date,
            firstDueDate: toDateString(estimatedFirstDueDate),
            totalInstallments: installmentCount,
          });
        } else {
          await addExpense(
            data,
            makeRecurring
              ? { ...recurringSchedule, startDate: data.date, active: true }
              : undefined
          );
        }
        showToast(isInstallmentPurchase ? t('installments.projectedToast') : makeRecurring ? t('expenses.createdWithRecurrence') : t('expenses.created'));
      }
      if (paymentMethodId != null && !isSavingsRelated && !isCardPayment) {
        await AsyncStorage.setItem(LAST_EXPENSE_PAYMENT_METHOD_KEY, String(paymentMethodId))
          .catch(() => undefined);
      }
      onSuccess();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
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
        testID="expense-name-input"
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setIsNameFocused(true);
        }}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
        placeholder={t('expenses.namePlaceholder')}
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
      <ThemedText style={styles.label}>{t('expenses.amountTotal')}</ThemedText>
      <TextInput
        accessibilityLabel={t('expenses.amountTotal')}
        testID="expense-amount-input"
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={(value) => setAmountText(formatCLPInput(value))}
        placeholder={t('forms.amountPlaceholder')}
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />
      {showAdvancedOptions && !isInstallmentPurchase && !isCardPayment && <View style={styles.shareSection}>
        <View style={styles.shareToggleRow}>
          <View style={styles.shareToggleCopy}>
            <ThemedText style={styles.shareLabel}>{t('forms.splitAmount')}</ThemedText>
            <ThemedText style={styles.shareDescription}>
              {t('expenses.splitDescription')}
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel={t('accessibility.toggleExpenseSplit')}
            onValueChange={setIsSplitAmount}
            trackColor={{ true: colors.tint }}
            value={isSplitAmount}
          />
        </View>

        {isSplitAmount && (
          <>
            <View style={styles.shareOptions}>
              <Pressable
                onPress={() => setSplitMode('percentage')}
                style={[
                  styles.shareButton,
                  { borderColor: colors.icon },
                  splitMode === 'percentage' && styles.shareButtonSelected,
                ]}>
                <ThemedText style={splitMode === 'percentage' ? styles.shareButtonTextSelected : undefined}>
                  {t('expenses.byPercentage')}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (!shareAmountText && amountToSave != null) {
                    setShareAmountText(formatCLPInput(amountToSave));
                  }
                  setSplitMode('amount');
                }}
                style={[
                  styles.shareButton,
                  { borderColor: colors.icon },
                  splitMode === 'amount' && styles.shareButtonSelected,
                ]}>
                <ThemedText style={splitMode === 'amount' ? styles.shareButtonTextSelected : undefined}>
                  {t('expenses.byExactAmount')}
                </ThemedText>
              </Pressable>
            </View>

            {splitMode === 'percentage' ? (
              <>
                <View style={styles.shareOptions}>
                  {[50, 25].map((preset) => {
                    const selected = !usesCustomPercentage && percentage === preset;
                    return (
                      <Pressable
                        key={preset}
                        onPress={() => {
                          setUsesCustomPercentage(false);
                          setPercentageText(String(preset));
                        }}
                        style={[
                          styles.shareButton,
                          { borderColor: colors.icon },
                          selected && styles.shareButtonSelected,
                        ]}>
                        <ThemedText style={selected ? styles.shareButtonTextSelected : undefined}>
                          {preset}%
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => setUsesCustomPercentage(true)}
                    style={[
                      styles.shareButton,
                      { borderColor: colors.icon },
                      usesCustomPercentage && styles.shareButtonSelected,
                    ]}>
                    <ThemedText style={usesCustomPercentage ? styles.shareButtonTextSelected : undefined}>
                      {t('expenses.otherPercentage')}
                    </ThemedText>
                  </Pressable>
                </View>

                {usesCustomPercentage && (
                  <View style={styles.manualPercentageRow}>
                    <ThemedText style={styles.manualPercentageLabel}>
                      {t('expenses.customPercentage')}
                    </ThemedText>
                    <View style={[styles.percentageInputContainer, { borderColor: colors.icon }]}>
                      <TextInput
                        accessibilityLabel={t('forms.manualPercentage')}
                        keyboardType="decimal-pad"
                        maxLength={6}
                        onChangeText={(value) =>
                          setPercentageText(value.replace(/[^0-9.,]/g, '').replace(',', '.'))
                        }
                        placeholder={t('forms.percentagePlaceholder')}
                        placeholderTextColor={colors.icon}
                        selectTextOnFocus
                        style={[styles.percentageInput, { color: colors.text }]}
                        value={percentageText}
                      />
                      <ThemedText style={styles.percentageSuffix}>%</ThemedText>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.exactAmountField}>
                <ThemedText style={styles.manualPercentageLabel}>{t('expenses.yourAmount')}</ThemedText>
                <TextInput
                  accessibilityLabel={t('expenses.yourAmount')}
                  keyboardType="number-pad"
                  onChangeText={(value) => setShareAmountText(formatCLPInput(value))}
                  placeholder={t('forms.amountPlaceholder')}
                  placeholderTextColor={colors.icon}
                  style={[styles.input, styles.exactAmountInput, { color: colors.text, borderColor: colors.icon }]}
                  value={shareAmountText}
                />
              </View>
            )}
          </>
        )}

        {isSplitAmount && amountToSave != null && (
          <ThemedText style={styles.shareResult}>
            {t('expenses.splitResult', { amount: formatCLP(amountToSave) })}
          </ThemedText>
        )}
      </View>}

      <ColorSelect
        label={t('expenses.categoryOptional')}
        value={categoryId}
        onChange={setCategoryId}
        options={[
          { value: null, label: t('expenses.noCategory'), color: '#60758E' },
          ...categories
            .filter((category) => category.systemKey !== 'credit_payment' || canUseCreditPayment)
            .map((category) => ({
            value: category.id,
            label: category.name,
            color: category.color,
            })),
        ]}
      />

      {isCardPayment && (
        <ColorSelect
          label={t('paymentMethods.targetCreditCard')}
          value={creditPaymentTargetId}
          onChange={setCreditPaymentTargetId}
          disabled={isCreditPaymentTargetLocked}
          options={paymentMethods
            .filter((method) => method.type === 'credit' && (method.active || method.id === creditPaymentTargetId))
            .map((method) => ({ value: method.id, label: method.name, color: method.color }))}
        />
      )}

      {isSavingsCategory && !isInstallmentPurchase && (
        <>
          <ColorSelect
            label={t('savings.assignContributionOptional')}
            value={savingsKind === 'contribution' ? savingsGoalId : null}
            onChange={(value) => {
              setSavingsGoalId(value);
              setSavingsKind(value == null ? null : 'contribution');
            }}
            options={[
              { value: null, label: t('savings.noSpecificGoal'), color: '#60758E' },
              ...selectableSavingsGoals.map((goal) => ({
                value: goal.id,
                label: goal.name,
                color: goal.color,
              })),
            ]}
          />
          <ThemedText style={styles.savingsHint}>
            {t('savings.contributionHint')}
          </ThemedText>
          {selectableSavingsGoals.length === 0 && (
            <Pressable
              onPress={() => router.push('/modal/savings-goals')}
              style={[styles.secondaryAction, { borderColor: colors.border }]}>
              <Ionicons name="flag-outline" size={19} color={colors.primary} />
              <ThemedText type="defaultSemiBold">{t('savings.createGoal')}</ThemedText>
            </Pressable>
          )}
        </>
      )}

      {savingsKind === 'funded_expense' ? (
        <>
          <ThemedText style={styles.label}>{t('expenses.paymentMethodOptional')}</ThemedText>
          <View style={[styles.selectButton, { borderColor: colors.border }]}>
            <View style={styles.selectValue}>
              <View style={[styles.selectDot, { backgroundColor: '#20B9DB' }]} />
              <ThemedText type="defaultSemiBold">{t('savings.withdrawalPaymentMethod')}</ThemedText>
            </View>
            <Ionicons name="lock-closed-outline" size={18} color={colors.icon} />
          </View>
        </>
      ) : (
        <ColorSelect
          label={isCardPayment ? t('paymentMethods.sourcePaymentMethod') : t('expenses.paymentMethodOptional')}
          value={paymentMethodId}
          onChange={(value) => {
            if (value === VIRTUAL_SAVINGS_PAYMENT_METHOD_ID) {
              setPaymentMethodId(null);
              setSavingsKind('funded_expense');
              setSavingsGoalId(withdrawableSavingsGoals[0]?.id ?? null);
              setMakeRecurring(false);
              return;
            }
            setPaymentMethodId(value);
          }}
          options={[
            { value: null, label: t('common.notSpecified'), color: '#60758E' },
            ...(!isCardPayment && !isSavingsCategory && !isInstallmentPurchase && withdrawableSavingsGoals.length > 0
              ? [{
                  value: VIRTUAL_SAVINGS_PAYMENT_METHOD_ID,
                  label: t('savings.withdrawalPaymentMethod'),
                  color: '#20B9DB',
                }]
              : []),
            ...selectablePaymentMethods.map((method) => ({
              value: method.id,
              label: `${method.name}${method.active ? '' : t('paymentMethods.inactiveSuffix')}`,
              color: method.color,
            })),
          ]}
        />
      )}
      {savingsKind !== 'funded_expense' && selectedPaymentMethod && selectedPaymentMethod.type !== 'cash' && (
        selectedPaymentMethod.availableBalance == null ? (
          <ThemedText style={[styles.paymentHint, { color: colors.textSecondary }]}>
            {t('paymentMethods.balanceNotConfigured')}
          </ThemedText>
        ) : (
          <>
            <ThemedText style={[styles.paymentHint, { color: exceedsAvailableBalance ? colors.expense : colors.textSecondary }]}>
              {t('expenses.availableAmount', {
                label: t(selectedPaymentMethod.type === 'credit'
                  ? 'paymentMethods.availableCredit'
                  : 'paymentMethods.availableBalance'),
                amount: formatCLP(selectedPaymentMethod.availableBalance),
              })}
            </ThemedText>
            {exceedsAvailableBalance && amountToSave != null && (
              <ThemedText style={[styles.paymentHint, { color: colors.expense }]}>
                {t('expenses.exceedsAvailableHint', {
                  difference: formatCLP(amountToSave - selectedPaymentMethod.availableBalance),
                })}
              </ThemedText>
            )}
          </>
        )
      )}
      {historicalBalanceMethod?.balanceUpdatedAt && (
        <View style={[styles.balanceNotice, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name="time-outline" size={19} color={colors.action} />
          <ThemedText style={[styles.balanceNoticeText, { color: colors.textSecondary }]}>
            {t('expenses.historicalBalanceHint', {
              date: formatDate(new Date(`${historicalBalanceMethod.balanceUpdatedAt}T12:00:00`)),
            })}
          </ThemedText>
        </View>
      )}
      {savingsKind === 'funded_expense' && withdrawableSavingsGoals.length > 0 && (
        <>
          <ColorSelect
            label={t('savings.savingsFund')}
            value={savingsGoalId}
            onChange={setSavingsGoalId}
            options={withdrawableSavingsGoals.map((goal) => ({
              value: goal.id,
              label: `${goal.name} · ${formatCLP(goal.currentAmount)}`,
              color: goal.color,
            }))}
          />
          <Pressable
            onPress={() => {
              setSavingsKind(null);
              setSavingsGoalId(null);
            }}
            style={[styles.secondaryAction, { borderColor: colors.border }]}>
            <Ionicons name="swap-horizontal-outline" size={19} color={colors.primary} />
            <ThemedText type="defaultSemiBold">{t('savings.useAnotherPaymentMethod')}</ThemedText>
          </Pressable>
        </>
      )}
      {billingCycleHint && (
        <ThemedText style={[styles.paymentHint, { color: colors.tint }]}>
          {billingCycleHint}
        </ThemedText>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: showAdvancedOptions }}
        onPress={() => setShowAdvancedOptions((current) => !current)}
        style={[styles.advancedOptions, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={styles.advancedOptionsCopy}>
          <Ionicons name="options-outline" size={21} color={colors.action} />
          <View style={styles.advancedOptionsText}>
            <ThemedText type="defaultSemiBold">{t('expenses.moreOptions')}</ThemedText>
            <ThemedText style={styles.shareDescription}>{moreOptionsHint}</ThemedText>
          </View>
        </View>
        <Ionicons
          name={showAdvancedOptions ? 'chevron-up' : 'chevron-down'}
          size={21}
          color={colors.icon}
        />
      </Pressable>

      {showAdvancedOptions && !expense && isCreditPurchase && (
        <View style={[styles.installmentBox, { borderColor: colors.border }]}> 
          <View style={styles.installmentHeader}>
            <View style={styles.shareToggleCopy}>
              <ThemedText type="defaultSemiBold">{t('installments.installmentPurchase')}</ThemedText>
              <ThemedText style={styles.shareDescription}>{t('installments.projectDescription')}</ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('installments.registerPurchase')}
              value={isInstallmentPurchase}
              onValueChange={(value) => {
                setIsInstallmentPurchase(value);
                if (value) {
                  setMakeRecurring(false);
                  setIsSplitAmount(false);
                }
              }}
              trackColor={{ true: colors.tint }}
            />
          </View>
          {isInstallmentPurchase && (
            <View style={[styles.installmentBody, { borderTopColor: colors.border }]}> 
              <ColorSelect
                label={t('installments.number')}
                value={installmentPreset}
                showColor={false}
                onChange={(value) => {
                  setInstallmentPreset(value);
                  if (value != null) setInstallmentCountText(String(value));
                  else setInstallmentCountText('');
                }}
                options={[
                  ...[2, 3, 6, 12, 24, 36, 48].map((count) => ({ value: count, label: t('installments.countLabel', { count }), color: colors.primary })),
                  { value: null, label: t('recurrence.custom'), color: colors.primary },
                ]}
              />
              {installmentPreset == null && (
                <View style={styles.customInstallments}>
                  <ThemedText style={styles.customInstallmentsLabel}>{t('installments.customCount')}</ThemedText>
                  <TextInput
                    accessibilityLabel={t('installments.customCountAccessibility')}
                    autoFocus
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder={t('installments.countRange')}
                    placeholderTextColor={colors.icon}
                    value={installmentCountText}
                    onChangeText={(value) => setInstallmentCountText(value.replace(/\D/g, ''))}
                    onBlur={() => {
                      const value = Number(installmentCountText);
                      if (!Number.isInteger(value) || value < 2) setInstallmentCountText('2');
                      else if (value > 600) setInstallmentCountText('600');
                    }}
                    style={[styles.input, styles.customInstallmentInput, { color: colors.text, borderColor: colors.icon }]}
                  />
                </View>
              )}
              {estimatedInstallmentAmount != null && (
                <ThemedText style={styles.shareResult}>{t('installments.estimatedAmount', { amount: formatCLP(estimatedInstallmentAmount) })}</ThemedText>
              )}
              <ThemedText style={styles.installmentSectionLabel}>{t('installments.firstInstallment')}</ThemedText>
              <View style={styles.shareOptions}>
                {([['current', t('installments.currentClosing')], ['next', t('installments.nextClosing')]] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setFirstInstallmentTiming(value)}
                    style={[styles.shareButton, { borderColor: colors.icon }, firstInstallmentTiming === value && styles.shareButtonSelected]}>
                    <ThemedText style={firstInstallmentTiming === value ? styles.shareButtonTextSelected : undefined}>{label}</ThemedText>
                  </Pressable>
                ))}
              </View>
              {estimatedFirstDueDate && <ThemedText style={styles.paymentHint}>{t('installments.estimatedDate', { date: formatDate(estimatedFirstDueDate) })}</ThemedText>}
            </View>
          )}
        </View>
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
              maximumDate={formPeriod ? parseDateString(formPeriod.endDate) : undefined}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, selected) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selected) setDate(selected);
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

      {showAdvancedOptions && !expense && !isCardPayment && !isInstallmentPurchase && savingsKind !== 'funded_expense' && (
        <View style={[styles.recurringBox, { borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: makeRecurring }}
            onPress={() => setMakeRecurring((current) => !current)}
            style={styles.recurringHeader}>
            <View style={styles.recurringHeaderCopy}>
              <ThemedText type="defaultSemiBold">{t('expenses.makeRecurring')}</ThemedText>
              <ThemedText style={styles.shareDescription}>
                {t('expenses.recurringDescription')}
              </ThemedText>
            </View>
            <Ionicons
              name={makeRecurring ? 'chevron-up' : 'chevron-down'}
              size={21}
              color={colors.icon}
            />
          </Pressable>
          {makeRecurring && (
            <View style={[styles.recurringFields, { borderTopColor: colors.border }]}>
              <RecurringScheduleFields
                value={recurringSchedule}
                onChange={setRecurringSchedule}
                fixedStartDate={toDateString(date)}
              />
            </View>
          )}
        </View>
      )}

      {expense && (
        <View style={styles.recurringExpenseActions}>
          {expense.debtPlanId == null && !isCardPayment && (
            <Pressable
              onPress={() => router.push({
                pathname: '/modal/recurring-expense-form',
                params: expense.recurringExpenseId
                  ? { id: String(expense.recurringExpenseId) }
                  : { sourceExpenseId: String(expense.id) },
              })}
              style={[styles.secondaryAction, { borderColor: colors.border }]}> 
              <Ionicons name="repeat-outline" size={19} color={colors.primary} />
              <ThemedText type="defaultSemiBold">
                {expense.recurringExpenseId ? t('recurrence.edit') : t('expenses.makeRecurring')}
              </ThemedText>
            </Pressable>
          )}
          {expense.debtPlanId != null && (
            <Pressable
              onPress={() => router.push({ pathname: '/modal/debt-detail', params: { id: String(expense.debtPlanId) } })}
              style={[styles.secondaryAction, { borderColor: colors.border }]}> 
              <Ionicons name="card-outline" size={19} color={colors.primary} />
              <ThemedText type="defaultSemiBold">{t('installments.viewDetail')}</ThemedText>
            </Pressable>
          )}
        </View>
      )}

      </View>
    </ScrollView>
    <View style={[styles.formFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, LayoutTokens.formFooterBottom) }]}>
      <Pressable
        testID="expense-save"
        style={[styles.button, styles.footerButton, saving && styles.buttonDisabled]}
        onPress={() => { void handleSave(); }}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {expense ? t('common.update') : t('common.save')}
        </ThemedText>
      </Pressable>
    </View>
    </View>
  );
}
