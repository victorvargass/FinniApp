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
      <ThemedText style={styles.nameSuggestionsLabel}>Sugerencias</ThemedText>
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
                <ThemedText type="defaultSemiBold">Cancelar</ThemedText>
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
      Alert.alert('Error', 'Ingresa un nombre para la categoría');
      return;
    }
    if (!/^#[0-9a-f]{6}$/i.test(color)) {
      Alert.alert('Error', 'El color debe ser un hex válido (ej: #0a7ea4)');
      return;
    }

    const periodLimit = limitText.trim() ? parseAmount(limitText) : null;
    if (limitText.trim() && periodLimit == null) {
      Alert.alert('Error', 'Ingresa un límite de período válido');
      return;
    }

    setSaving(true);
    try {
      const data = { name: name.trim(), color, periodLimit };
      if (category) {
        await editCategory(category.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Categoría actualizada correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Categoría actualizada correctamente');
        }
      } else {
        await addCategory(data);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Categoría creada correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Categoría creada correctamente');
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar');
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
      Alert.alert('Error', 'No se pudo comprobar si la categoría está en uso.');
      return;
    }

    const hasExpenses = expenseCount > 0;
    const message = hasExpenses
      ? `Hay ${expenseCount} ${expenseCount === 1 ? 'gasto asociado' : 'gastos asociados'} a "${category.name}". Si eliminas la categoría, ${expenseCount === 1 ? 'el gasto quedará' : 'los gastos quedarán'} sin categoría.\n\n¿Deseas eliminarla de todas formas?`
      : `¿Eliminar "${category.name}"?`;

    Alert.alert(
      'Eliminar categoría',
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: hasExpenses ? 'Eliminar igualmente' : 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await removeCategory(category.id, hasExpenses);
              const successMessage = hasExpenses
                ? 'Categoría eliminada. Los gastos asociados quedaron sin categoría.'
                : 'Categoría eliminada';
              if (Platform.OS === 'android') ToastAndroid.show(successMessage, ToastAndroid.LONG);
              else Alert.alert('Eliminada', successMessage);
              onSuccess();
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo eliminar');
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
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={setName}
        placeholder="Ej: Supermercado"
        placeholderTextColor={colors.icon}
      />

      <ThemedText style={styles.label}>Color</ThemedText>
      <ColorPicker value={color} onChange={setColor} />

      <ThemedText style={styles.label}>Límite período (opcional)</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={limitText}
        onChangeText={setLimitText}
        placeholder="Ej: 150000"
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {category ? 'Actualizar' : 'Guardar'}
        </ThemedText>
      </Pressable>
      {category && (
        <Pressable
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}>
          <ThemedText style={styles.deleteButtonText}>Eliminar categoría</ThemedText>
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
            `${method.active ? '' : `El medio de pago ${method.name} está desactivado, pero sigue asociado a este gasto. `}Pertenece al ciclo que factura el ${formatDate(parseDateString(actualCycle.endDate))}.`
          );
          return;
        }
        setBillingCycleHint(
          `${method.active ? '' : `El medio de pago ${method.name} está desactivado, pero sigue asociado a este gasto. `}Se estima para la facturación del ${formatDate(getEstimatedBillingDate(date, method.billingDay!))}. La fecha real se confirma al registrar el ciclo.`
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
      Alert.alert('Error', 'Ingresa un nombre para el gasto');
      return;
    }
    if (isSplitAmount && !hasValidPercentage) {
      Alert.alert('Error', 'Ingresa un porcentaje entre 1% y 100%');
      return;
    }
    if (amountToSave == null || amountToSave <= 0) {
      Alert.alert('Error', 'Ingresa un monto válido');
      return;
    }
    if (!expense && makeRecurring) {
      const granted = await ensureRecurringNotificationPermission();
      if (!granted && recurringSchedule.registrationMode === 'confirmation') {
        Alert.alert(
          'Notificaciones desactivadas',
          'Activa las notificaciones del sistema para usar el modo con confirmación.'
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
          'Error',
          `La fecha del gasto debe estar dentro del período seleccionado (${formatDate(startDate)} al ${formatDate(endDate)}).`
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
          ToastAndroid.show('Gasto actualizado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Gasto actualizado correctamente');
        }
      } else {
        if (isInstallmentPurchase) {
          if (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 600) {
            throw new Error('El número de cuotas debe estar entre 2 y 600');
          }
          if (!estimatedFirstDueDate || paymentMethodId == null || totalAmount == null) {
            throw new Error('No se pudo calcular la primera cuota');
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
            isInstallmentPurchase ? 'Compra proyectada en cuotas' : makeRecurring ? 'Gasto y recurrencia creados' : 'Gasto creado correctamente',
            ToastAndroid.SHORT
          );
        } else {
          Alert.alert(
            'Guardado',
            isInstallmentPurchase ? 'Compra proyectada. Activa la primera cuota desde Deudas y cuotas.' : makeRecurring ? 'Gasto y recurrencia creados' : 'Gasto creado correctamente',
            [{ text: 'Aceptar' }],
            { cancelable: true }
          );
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.formShell}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setIsNameFocused(true);
        }}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
        placeholder="Ej: Compra Jumbo"
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
      <ThemedText style={styles.label}>Monto total (CLP)</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder="Ej: 25000"
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />
      {!isInstallmentPurchase && <View style={styles.shareSection}>
        <View style={styles.shareToggleRow}>
          <View style={styles.shareToggleCopy}>
            <ThemedText style={styles.shareLabel}>Dividir monto</ThemedText>
            <ThemedText style={styles.shareDescription}>
              Registra solamente el porcentaje que pagaste tú
            </ThemedText>
          </View>
          <Switch
            accessibilityLabel="Dividir monto del gasto"
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
                  Otro
                </ThemedText>
              </Pressable>
            </View>

            {usesCustomPercentage && (
              <View style={styles.manualPercentageRow}>
                <ThemedText style={styles.manualPercentageLabel}>
                  Tu porcentaje
                </ThemedText>
                <View style={[styles.percentageInputContainer, { borderColor: colors.icon }]}>
                  <TextInput
                    accessibilityLabel="Porcentaje manual"
                    autoFocus
                    keyboardType="decimal-pad"
                    maxLength={6}
                    onChangeText={(value) =>
                      setPercentageText(value.replace(/[^0-9.,]/g, '').replace(',', '.'))
                    }
                    placeholder="Ej: 33"
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
            Se registrará {formatCLP(amountToSave)} como tu gasto.
          </ThemedText>
        )}
      </View>}

      <ColorSelect
        label="Categoría (opcional)"
        value={categoryId}
        onChange={setCategoryId}
        options={[
          { value: null, label: 'Sin categoría', color: '#95a5a6' },
          ...categories.map((category) => ({
            value: category.id,
            label: category.name,
            color: category.color,
          })),
        ]}
      />

      <ColorSelect
        label="Medio de pago (opcional)"
        value={paymentMethodId}
        onChange={setPaymentMethodId}
        options={[
          { value: null, label: 'No especificado', color: '#95a5a6' },
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
              <ThemedText type="defaultSemiBold">Compra en cuotas</ThemedText>
              <ThemedText style={styles.shareDescription}>Proyecta la deuda y activa la primera cuota cuando sea facturada</ThemedText>
            </View>
            <Switch
              accessibilityLabel="Registrar compra en cuotas"
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
                label="Número de cuotas"
                value={installmentPreset}
                showColor={false}
                onChange={(value) => {
                  setInstallmentPreset(value);
                  if (value != null) setInstallmentCountText(String(value));
                  else setInstallmentCountText('');
                }}
                options={[
                  ...[2, 3, 6, 12, 24, 36, 48].map((count) => ({ value: count, label: `${count} cuotas`, color: colors.primary })),
                  { value: null, label: 'Personalizado', color: colors.primary },
                ]}
              />
              {installmentPreset == null && (
                <View style={styles.customInstallments}>
                  <ThemedText style={styles.customInstallmentsLabel}>Cantidad personalizada</ThemedText>
                  <TextInput
                    accessibilityLabel="Número personalizado de cuotas"
                    autoFocus
                    keyboardType="number-pad"
                    maxLength={3}
                    placeholder="2 a 600"
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
                <ThemedText style={styles.shareResult}>Estimado desde {formatCLP(estimatedInstallmentAmount)} por cuota. La diferencia se reparte en las últimas cuotas.</ThemedText>
              )}
              <ThemedText style={styles.installmentSectionLabel}>Primera cuota</ThemedText>
              <View style={styles.shareOptions}>
                {([['current', 'Este cierre'], ['next', 'Próximo cierre']] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setFirstInstallmentTiming(value)}
                    style={[styles.shareButton, { borderColor: colors.icon }, firstInstallmentTiming === value && styles.shareButtonSelected]}>
                    <ThemedText style={firstInstallmentTiming === value ? styles.shareButtonTextSelected : undefined}>{label}</ThemedText>
                  </Pressable>
                ))}
              </View>
              {estimatedFirstDueDate && <ThemedText style={styles.paymentHint}>Fecha estimada: {formatDate(estimatedFirstDueDate)}</ThemedText>}
            </View>
          )}
        </View>
      )}

      <ThemedText style={styles.label}>Fecha</ThemedText>
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
          <ThemedText type="link">Listo</ThemedText>
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
              <ThemedText type="defaultSemiBold">Hacer recurrente</ThemedText>
              <ThemedText style={styles.shareDescription}>
                Programa la creación de este gasto de manera recurrente
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
                {expense.recurringExpenseId ? 'Editar recurrencia' : 'Hacer recurrente'}
              </ThemedText>
            </Pressable>
          )}
          {expense.debtPlanId != null && (
            <Pressable
              onPress={() => router.push({ pathname: '/modal/debt-detail', params: { id: String(expense.debtPlanId) } })}
              style={[styles.secondaryAction, { borderColor: colors.border }]}> 
              <Ionicons name="card-outline" size={19} color={colors.primary} />
              <ThemedText type="defaultSemiBold">Ver detalle de cuotas</ThemedText>
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
          {expense ? 'Actualizar' : 'Guardar'}
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
      Alert.alert('Error', 'Ingresa un nombre para el ingreso');
      return;
    }
    const amount = parseAmount(amountText as string);
    if (amount == null) {
      Alert.alert('Error', 'Ingresa un monto válido');
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
          'Error',
          `La fecha del ingreso debe estar dentro del período seleccionado (${formatDate(new Date(`${selectedPeriod.startDate}T12:00:00`))} al ${formatDate(new Date(`${selectedPeriod.endDate}T12:00:00`))}).`
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
          ToastAndroid.show(makeIncomeRecurring ? 'Ingreso actualizado y recurrencia creada' : 'Ingreso actualizado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', makeIncomeRecurring ? 'Ingreso actualizado y recurrencia creada' : 'Ingreso actualizado correctamente');
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
          ToastAndroid.show('Ingreso creado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Ingreso creado correctamente');
        }
      }
      onSuccess();
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.formShell}>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setIsNameFocused(true);
        }}
        onFocus={() => setIsNameFocused(true)}
        onBlur={() => setIsNameFocused(false)}
        placeholder="Ej: Sueldo"
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
      <ThemedText style={styles.label}>Monto (CLP)</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder="Ej: 25000"
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

      <ThemedText style={styles.label}>Fecha</ThemedText>
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
          <ThemedText type="link">Listo</ThemedText>
        </Pressable>
      )}

      {(!income || income.recurringIncomeId == null) && (
        <View style={[styles.recurringBox, { borderColor: colors.border }]}> 
          <Pressable onPress={() => setMakeIncomeRecurring((current) => !current)} style={styles.recurringHeader}>
            <View style={styles.recurringHeaderCopy}>
              <ThemedText type="defaultSemiBold">Hacer recurrente</ThemedText>
              <ThemedText style={styles.shareDescription}>Registra automáticamente este ingreso en las próximas fechas</ThemedText>
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
          <ThemedText type="defaultSemiBold">Editar recurrencia</ThemedText>
        </Pressable>
      )}

      </View>
    </ScrollView>
    <View style={[styles.formFooter, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable
        style={[styles.button, styles.footerButton, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>{income ? 'Actualizar' : 'Guardar'}</ThemedText>
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
