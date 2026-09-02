import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ColorPicker } from '@/components/ColorPicker';
import { RecurringScheduleFields } from '@/components/recurring-schedule-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, parseAmount, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import type { Category, Expense, Income, NewRecurringSchedule } from '@/lib/types';
import { ensureRecurringNotificationPermission } from '@/services/RecurringNotificationService';

type ColorSelectOption = {
  value: number | null;
  label: string;
  color: string;
};

function parseDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

function getEstimatedBillingDate(purchaseDate: Date, billingDay: number) {
  const monthOffset = purchaseDate.getDate() <= billingDay ? 0 : 1;
  const year = purchaseDate.getFullYear();
  const month = purchaseDate.getMonth() + monthOffset;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(billingDay, lastDay), 12);
}

function getDefaultRecurringSchedule(date: Date): NewRecurringSchedule {
  return {
    frequency: 'monthly',
    intervalMonths: 2,
    executionDay: date.getDate(),
    registrationMode: 'confirmation',
    startDate: toDateString(date),
    endDate: null,
    active: true,
  };
}

function getNameSuggestions(names: string[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('es');
  if (!normalizedQuery) return [];

  const uniqueNames = new Map<string, string>();
  names.forEach((item) => {
    const name = item.trim();
    const normalizedName = name.toLocaleLowerCase('es');
    if (
      normalizedName.includes(normalizedQuery) &&
      normalizedName !== normalizedQuery &&
      !uniqueNames.has(normalizedName)
    ) {
      uniqueNames.set(normalizedName, name);
    }
  });

  return [...uniqueNames.values()].slice(0, 5);
}

type NameSuggestionsProps = {
  suggestions: string[];
  onSelect: (name: string) => void;
};

function NameSuggestions({ suggestions, onSelect }: NameSuggestionsProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (suggestions.length === 0) return null;

  return (
    <View style={[styles.nameSuggestions, { borderColor: colors.icon }]}>
      <ThemedText style={styles.nameSuggestionsLabel}>{t('common.suggestions')}</ThemedText>
      {suggestions.map((suggestion) => (
        <Pressable
          key={suggestion}
          onPressIn={() => onSelect(suggestion)}
          style={styles.nameSuggestion}>
          <ThemedText>{suggestion}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function ColorSelect({
  label,
  value,
  options,
  onChange,
  showColor = true,
}: {
  label: string;
  value: number | null;
  options: ColorSelectOption[];
  onChange: (value: number | null) => void;
  showColor?: boolean;
}) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected.label}`}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.selectButton,
          { borderColor: colors.border },
          pressed && styles.selectPressed,
        ]}>
        <View style={styles.selectValue}>
          {showColor && <View style={[styles.selectDot, { backgroundColor: selected.color }]} />}
          <ThemedText type="defaultSemiBold" numberOfLines={1}>{selected.label}</ThemedText>
        </View>
        <Ionicons name="chevron-down" size={20} color={colors.icon} />
      </Pressable>

      <Modal
        animationType="slide"
        transparent
        visible={visible}
        onRequestClose={() => setVisible(false)}>
        <Pressable style={styles.selectOverlay} onPress={() => setVisible(false)}>
          <Pressable style={styles.selectSheet} onPress={(event) => event.stopPropagation()}>
            <ThemedView
              style={[
                styles.selectContent,
                {
                  backgroundColor: colors.surfaceRaised,
                  paddingBottom: Math.max(insets.bottom, 16) + 12,
                },
              ]}>
              <View style={styles.selectHandle} />
              <ThemedText type="subtitle">{label}</ThemedText>
              <ScrollView style={styles.selectOptions} showsVerticalScrollIndicator={false}>
                {options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <Pressable
                      key={option.value ?? 'none'}
                      onPress={() => {
                        onChange(option.value);
                        setVisible(false);
                      }}
                      style={[
                        styles.selectOption,
                        { borderColor: isSelected ? option.color : colors.border },
                        isSelected && { backgroundColor: option.color + '18' },
                      ]}>
                      <View style={styles.selectValue}>
                        {showColor && <View style={[styles.selectDot, { backgroundColor: option.color }]} />}
                        <ThemedText style={isSelected ? styles.selectOptionSelectedText : undefined}>
                          {option.label}
                        </ThemedText>
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={21} color={option.color} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Pressable
                onPress={() => setVisible(false)}
                style={[styles.selectClose, { borderColor: colors.border }]}>
                <ThemedText type="defaultSemiBold">{t('common.cancel')}</ThemedText>
              </Pressable>
            </ThemedView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

type CategoryFormProps = {
  category?: Category;
  onSuccess: () => void;
};

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const { addCategory, editCategory, getCategoryExpenseCount, removeCategory } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? '#0a7ea4');
  const [limitText, setLimitText] = useState(
    category?.periodLimit != null ? String(category.periodLimit) : ''
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('categories.missingName'));
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      Alert.alert(t('common.error'), t('validation.invalidCategoryColor'));
      return;
    }

    const periodLimit = limitText.trim() ? parseAmount(limitText) : null;
    if (limitText.trim() && periodLimit == null) {
      Alert.alert(t('common.error'), t('validation.invalidCategoryLimit'));
      return;
    }

    setSaving(true);
    try {
      const data = { name: name.trim(), color, periodLimit };
      if (category) {
        await editCategory(category.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('categories.updated'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('categories.updated'));
        }
      } else {
        await addCategory(data);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('categories.created'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('categories.created'));
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!category || saving) return;

    let expenseCount: number;
    try {
      expenseCount = await getCategoryExpenseCount(category.id);
    } catch {
      Alert.alert(t('common.error'), t('categories.usageCheckError'));
      return;
    }

    const hasExpenses = expenseCount > 0;
    const message = hasExpenses
      ? t('categories.deleteWithExpenses', {
          count: expenseCount,
          expenseLabel: expenseCount === 1 ? t('categories.associatedExpense') : t('categories.associatedExpenses'),
          name: category.name,
          result: expenseCount === 1 ? t('categories.expenseWillRemain') : t('categories.expensesWillRemain'),
        })
      : t('categories.deleteQuestion', { name: category.name });

    Alert.alert(
      t('categories.delete'),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: hasExpenses ? t('categories.deleteAnyway') : t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeCategory(category.id, hasExpenses);
              const successMessage = hasExpenses
                ? t('categories.deletedDetached')
                : t('categories.deleted');
              if (Platform.OS === 'android') ToastAndroid.show(successMessage, ToastAndroid.LONG);
              else Alert.alert(t('common.deleted'), successMessage);
              onSuccess();
            } catch (error) {
              Alert.alert(t('common.error'), error instanceof Error ? error.message : t('errors.couldNotDelete'));
            } finally {
              setSaving(false);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>{t('common.name')}</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={setName}
        placeholder={t('categories.placeholderName')}
        placeholderTextColor={colors.icon}
      />

      <ThemedText style={styles.label}>{t('categories.color')}</ThemedText>
      <ColorPicker value={color} onChange={setColor} />

      <ThemedText style={styles.label}>{t('categories.limitOptional')}</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={limitText}
        onChangeText={setLimitText}
        placeholder={t('categories.placeholderLimit')}
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {category ? t('common.update') : t('common.save')}
        </ThemedText>
      </Pressable>
      {category && (
        <Pressable
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}>
          <ThemedText style={styles.deleteButtonText}>{t('categories.delete')}</ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

type ExpenseFormProps = {
  expense?: Expense;
  onSuccess: () => void;
};

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const {
    categories,
    paymentMethods,
    expenseNames,
    addExpense,
    addInstallmentPurchase,
    editExpense,
    selectedPeriod,
    getCreditCardCycles,
    settings,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(expense?.name ?? '');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const expenseWasSplit =
    expense?.originalAmount != null && expense.splitPercentage != null;
  const [amountText, setAmountText] = useState<string>(
    expense ? String(expense.originalAmount ?? expense.amount) : ''
  );
  const [isSplitAmount, setIsSplitAmount] = useState(expenseWasSplit);
  const [percentageText, setPercentageText] = useState(
    expenseWasSplit ? String(expense.splitPercentage) : '50'
  );
  const [usesCustomPercentage, setUsesCustomPercentage] = useState(
    expenseWasSplit && ![50, 25].includes(expense.splitPercentage!)
  );
  const [categoryId, setCategoryId] = useState<number | null>(expense?.categoryId ?? null);
  const [paymentMethodId, setPaymentMethodId] = useState<number | null>(
    expense ? expense.paymentMethodId : settings.defaultPaymentMethodId
  );
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
  const [saving, setSaving] = useState(false);
  const totalAmount = parseAmount(amountText as string);
  const percentage = Number(percentageText.replace(',', '.'));
  const hasValidPercentage =
    Number.isFinite(percentage) && percentage > 0 && percentage <= 100;
  const amountToSave =
    totalAmount == null || (isSplitAmount && !hasValidPercentage)
      ? null
      : Math.round(totalAmount * (isSplitAmount ? percentage / 100 : 1));
  const nameSuggestions = getNameSuggestions(expenseNames, name);
  const visiblePaymentMethods = paymentMethods.filter(
    (method) => method.active || method.id === paymentMethodId
  );
  const selectedPaymentMethod = paymentMethods.find((method) => method.id === paymentMethodId);
  const isCreditPayment = selectedPaymentMethod?.type === 'credit';
  const installmentCount = Number(installmentCountText);
  const estimatedInstallmentAmount = amountToSave != null && Number.isInteger(installmentCount) && installmentCount > 0
    ? Math.floor(amountToSave / installmentCount)
    : null;
  const estimatedFirstDueDate = isCreditPayment && selectedPaymentMethod.billingDay != null
    ? (() => {
        const estimated = getEstimatedBillingDate(date, selectedPaymentMethod.billingDay!);
        if (firstInstallmentTiming === 'next') estimated.setMonth(estimated.getMonth() + 1);
        return estimated;
      })()
    : null;

  useEffect(() => {
    if (!isCreditPayment) setIsInstallmentPurchase(false);
  }, [isCreditPayment]);

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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('validation.invalidExpenseName'));
      return;
    }
    if (isSplitAmount && !hasValidPercentage) {
      Alert.alert(t('common.error'), t('validation.invalidPercentage'));
      return;
    }
    if (amountToSave == null || amountToSave <= 0) {
      Alert.alert(t('common.error'), t('validation.invalidAmount'));
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

    if (selectedPeriod) {
      const startDate = parseDateString(selectedPeriod.startDate);
      const endDate = parseDateString(selectedPeriod.endDate);

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
        splitPercentage: isSplitAmount ? percentage : null,
        categoryId,
        paymentMethodId,
        date: toDateString(date),
      };
      if (expense) {
        await editExpense(expense.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show(t('expenses.updated'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('expenses.updated'));
        }
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
        if (Platform.OS === 'android') {
          ToastAndroid.show(
            isInstallmentPurchase ? t('installments.projectedToast') : makeRecurring ? t('expenses.createdWithRecurrence') : t('expenses.created'),
            ToastAndroid.SHORT
          );
        } else {
          Alert.alert(
            t('common.saved'),
            isInstallmentPurchase ? t('installments.projectedMessage') : makeRecurring ? t('expenses.createdWithRecurrence') : t('expenses.created'),
            [{ text: t('common.accept') }],
            { cancelable: true }
          );
        }
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
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder={t('forms.amountPlaceholder')}
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />
      {!isInstallmentPurchase && <View style={styles.shareSection}>
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
                    <ThemedText
                      style={selected ? styles.shareButtonTextSelected : undefined}>
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
                <ThemedText
                  style={
                    usesCustomPercentage
                      ? styles.shareButtonTextSelected
                      : undefined
                  }>
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
                    autoFocus
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
          { value: null, label: t('expenses.noCategory'), color: '#95a5a6' },
          ...categories.map((category) => ({
            value: category.id,
            label: category.name,
            color: category.color,
          })),
        ]}
      />

      <ColorSelect
        label={t('expenses.paymentMethodOptional')}
        value={paymentMethodId}
        onChange={setPaymentMethodId}
        options={[
          { value: null, label: t('common.notSpecified'), color: '#95a5a6' },
          ...visiblePaymentMethods.map((method) => ({
            value: method.id,
            label: `${method.name}${method.active ? '' : ' (desactivado)'}`,
            color: method.color,
          })),
        ]}
      />
      {billingCycleHint && (
        <ThemedText style={[styles.paymentHint, { color: colors.tint }]}>
          {billingCycleHint}
        </ThemedText>
      )}

      {!expense && isCreditPayment && (
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

      <ThemedText style={styles.label}>{t('forms.date')}</ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: colors.icon }]}
        onPress={() => setShowDatePicker(true)}>
        <ThemedText>{formatDate(date)}</ThemedText>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          minimumDate={selectedPeriod ? parseDateString(selectedPeriod.startDate) : undefined}
          maximumDate={selectedPeriod ? parseDateString(selectedPeriod.endDate) : undefined}
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

      {!expense && !isInstallmentPurchase && (
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
          {expense.debtPlanId == null && (
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
    <View style={[styles.formFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        style={[styles.button, styles.footerButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {expense ? t('common.update') : t('common.save')}
        </ThemedText>
      </Pressable>
    </View>
    </View>
  );
}

type IncomeFormProps = {
  income?: Income;
  onSuccess: () => void;
};

export function IncomeForm({ income, onSuccess }: IncomeFormProps) {
  const { incomeNames, addIncome, editIncome, addRecurringIncomeFromSource, selectedPeriod } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();

  const [name, setName] = useState(income?.name ?? '');
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [amountText, setAmountText] = useState<string>(income?.amount ? String(income?.amount) : '');
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

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('validation.invalidIncomeName'));
      return;
    }
    const amount = parseAmount(amountText as string);
    if (amount == null) {
      Alert.alert(t('common.error'), t('validation.invalidAmount'));
      return;
    }

    // La fecha siempre debe pertenecer al período que el usuario está editando.
    if (selectedPeriod) {
      // Corrección: la fecha final del periodo puede traer hora 00:00 UTC, así que compara usando las fechas normalizadas a local (sin hora)
      // Establece explícitamente las fechas en local
      const periodStart = new Date(selectedPeriod.startDate + "T00:00:00");
      const periodEnd = new Date(selectedPeriod.endDate + "T00:00:00");
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
            start: formatDate(new Date(`${selectedPeriod.startDate}T12:00:00`)),
            end: formatDate(new Date(`${selectedPeriod.endDate}T12:00:00`)),
          })
        );
        return;
      }
    }

    setSaving(true);
    try {
      const data = { name: name.trim(), amount, date: toDateString(date) };
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
          ToastAndroid.show(makeIncomeRecurring ? t('incomes.updatedWithRecurrence') : t('incomes.updated'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), makeIncomeRecurring ? t('incomes.updatedWithRecurrence') : t('incomes.updated'));
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
          ToastAndroid.show(t('incomes.created'), ToastAndroid.SHORT);
        } else {
          Alert.alert(t('common.saved'), t('incomes.created'));
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
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder={t('forms.amountPlaceholder')}
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

      <ThemedText style={styles.label}>{t('forms.date')}</ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: colors.icon }]}
        onPress={() => setShowDatePicker(true)}>
        <ThemedText>{formatDate(date)}</ThemedText>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
          minimumDate={selectedPeriod ? parseDateString(selectedPeriod.startDate) : undefined}
          maximumDate={selectedPeriod ? parseDateString(selectedPeriod.endDate) : undefined}
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

      {(!income || income.recurringIncomeId == null) && (
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
    <View style={[styles.formFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        style={[styles.button, styles.footerButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>{income ? t('common.update') : t('common.save')}</ThemedText>
      </Pressable>
    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  formShell: { flex: 1 },
  formFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10 },
  footerButton: { marginTop: 0 },
  container: {
    padding: 20,
    gap: 8,
    paddingBottom: 40,    
  },
  formRemainder: {
    gap: 8,
  },
  label: {
    marginTop: 8,
    marginBottom: 4,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  nameSuggestions: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
    marginTop: -2,
  },
  nameSuggestionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.6,
    paddingHorizontal: 12,
    paddingTop: 9,
    paddingBottom: 4,
  },
  nameSuggestion: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  shareSection: {
    gap: 8,
    marginBottom: 4,
    paddingVertical: 8,
  },
  shareToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareToggleCopy: {
    flex: 1,
    gap: 3,
  },
  shareLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  shareDescription: {
    fontSize: 12,
    opacity: 0.65,
  },
  shareOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  shareButton: {
    flex: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 9,
  },
  shareButtonSelected: {
    borderColor: '#0a7ea4',
    backgroundColor: '#0a7ea412',
  },
  shareButtonTextSelected: {
    color: '#0a7ea4',
    fontWeight: '700',
  },
  shareResult: {
    color: '#0a7ea4',
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0a7ea412',
  },
  manualPercentageLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  manualPercentageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 2,
  },
  percentageInputContainer: {
    width: 120,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  percentageInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 9,
  },
  percentageSuffix: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
  },
  selectButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 13,
    gap: 12,
  },
  selectPressed: { opacity: 0.7 },
  selectValue: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  selectDot: { width: 14, height: 14, borderRadius: 5 },
  selectOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  selectSheet: { maxHeight: '72%' },
  selectContent: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, gap: 14 },
  selectHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#9ba1a6', opacity: 0.55, alignSelf: 'center' },
  selectOptions: { maxHeight: 390 },
  selectOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 8, gap: 12 },
  selectOptionSelectedText: { fontWeight: '700' },
  selectClose: { borderWidth: 1, borderRadius: 10, paddingVertical: 13, alignItems: 'center' },
  paymentHint: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 4,
    opacity: 0.9,
  },
  dateButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  doneDate: {
    alignSelf: 'flex-end',
  },
  button: {
    marginTop: 16,
    backgroundColor: '#0a7ea4',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  recurringBox: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 10,
    overflow: 'hidden',
  },
  installmentBox: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 14,
    overflow: 'hidden',
  },
  installmentHeader: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  installmentBody: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 18,
    gap: 14,
  },
  installmentSectionLabel: { fontWeight: '700', marginTop: 4 },
  customInstallments: { gap: 7 },
  customInstallmentsLabel: { fontSize: 13, fontWeight: '600', opacity: 0.75 },
  customInstallmentInput: { marginTop: 0 },
  recurringHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  recurringHeaderCopy: { flex: 1, gap: 2 },
  recurringFields: { borderTopWidth: 1, padding: 13 },
  recurringExpenseActions: { gap: 8, marginTop: 10 },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  deleteButton: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#be1b1b',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#be1b1b',
    fontWeight: '700',
  },
});
