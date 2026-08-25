import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate, parseAmount, toDateString } from '@/lib/format';
import type { Category, Expense, Income } from '@/lib/types';

function parseDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
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
          onPress={() => onSelect(suggestion)}
          style={styles.nameSuggestion}>
          <ThemedText>{suggestion}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

type CategoryFormProps = {
  category?: Category;
  onSuccess: () => void;
};

export function CategoryForm({ category, onSuccess }: CategoryFormProps) {
  const { addCategory, editCategory } = useDatabase();
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
    </ScrollView>
  );
}

type ExpenseFormProps = {
  expense?: Expense;
  onSuccess: () => void;
};

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const { categories, expenseNames, addExpense, editExpense, settings } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [name, setName] = useState(expense?.name ?? '');
  const [amountText, setAmountText] = useState<String>(expense?.amount ? String(expense?.amount) : '');
  const [isSplitAmount, setIsSplitAmount] = useState(false);
  const [percentageText, setPercentageText] = useState('50');
  const [usesCustomPercentage, setUsesCustomPercentage] = useState(false);
  const [categoryId, setCategoryId] = useState<number | null>(expense?.categoryId ?? null);
  const period = settings?.currentPeriod;
  const [date, setDate] = useState(
    expense?.date
      ? parseDateString(expense.date)
      : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
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

    if (period) {
      const startDate = parseDateString(period.startDate);
      const endDate = parseDateString(period.endDate);

      // Limpiar time por si acaso (comparar sólo fechas)
      const selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const minDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
      const maxDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
      if (selectedDate < minDate || selectedDate > maxDate) {
        Alert.alert(
          'Error',
          `La fecha del gasto debe estar en las fechas del período actual (${formatDate(startDate)} al ${formatDate(endDate)}).`
        );
        return;
      }
    }
    
    setSaving(true);
    try {
      const data = { name: name.trim(), amount: amountToSave, categoryId, date: toDateString(date) };
      if (expense) {
        await editExpense(expense.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Gasto actualizado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Gasto actualizado correctamente');
        }
      } else {
        await addExpense(data)
        if (Platform.OS === 'android') {
          ToastAndroid.show('Gasto creado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Gasto creado correctamente');
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={setName}
        placeholder="Ej: Compra Jumbo"
        placeholderTextColor={colors.icon}
      />
      <NameSuggestions suggestions={nameSuggestions} onSelect={setName} />

      <ThemedText style={styles.label}>Monto total (CLP)</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder="Ej: 25000"
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />
      <View style={styles.shareSection}>
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
      </View>

      <ThemedText style={styles.label}>Categoría (opcional)</ThemedText>
      <View style={styles.categoryList}>
        {categories.map((cat) => (
          <Pressable
            key={cat.id}
            onPress={() => setCategoryId((current) => (current === cat.id ? null : cat.id))}
            style={[
              styles.categoryChip,
              { borderColor: cat.color },
              categoryId === cat.id && { backgroundColor: cat.color + '33' },
            ]}>
            <View style={[styles.chipDot, { backgroundColor: cat.color }]} />
            <ThemedText>{cat.name}</ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={styles.label}>Fecha</ThemedText>
      <Pressable
        style={[styles.dateButton, { borderColor: colors.icon }]}
        onPress={() => setShowDatePicker(true)}>
        <ThemedText>{formatDate(date)}</ThemedText>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={date}
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

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {expense ? 'Actualizar' : 'Guardar'}
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

type IncomeFormProps = {
  income?: Income;
  onSuccess: () => void;
};

export function IncomeForm({ income, onSuccess }: IncomeFormProps) {
  const { incomeNames, addIncome, editIncome, settings } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [name, setName] = useState(income?.name ?? '');
  const [amountText, setAmountText] = useState<String>(income?.amount ? String(income?.amount) : '');
  const currentPeriod = settings.currentPeriod;
  const [date, setDate] = useState(
    income?.date
      ? parseDateString(income.date)
      : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
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

    // Validación: la fecha debe estar dentro del periodo actual
    if (currentPeriod) {
      // Corrección: la fecha final del periodo puede traer hora 00:00 UTC, así que compara usando las fechas normalizadas a local (sin hora)
      // Establece explícitamente las fechas en local
      const periodStart = new Date(currentPeriod.startDate + "T00:00:00");
      const periodEnd = new Date(currentPeriod.endDate + "T00:00:00");
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
          `La fecha del ingreso debe estar en las fechas del período actual (${formatDate(new Date(`${currentPeriod.startDate}T12:00:00`))} al ${formatDate(new Date(`${currentPeriod.endDate}T12:00:00`))}).`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const data = { name: name.trim(), amount, date: toDateString(date) };
      if (income) {
        await editIncome(income.id, data);
        if (Platform.OS === 'android') {
          ToastAndroid.show('Ingreso actualizado correctamente', ToastAndroid.SHORT);
        } else {
          Alert.alert('Guardado', 'Ingreso actualizado correctamente');
        }
      } else {
        await addIncome(data);
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <ThemedText style={styles.label}>Nombre</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={name}
        onChangeText={setName}
        placeholder="Ej: Sueldo"
        placeholderTextColor={colors.icon}
      />
      <NameSuggestions suggestions={nameSuggestions} onSelect={setName} />

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

      <Pressable
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}>
        <ThemedText style={styles.buttonText}>
          {income ? 'Actualizar' : 'Guardar'}
        </ThemedText>

      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 8,
    paddingBottom: 40,    
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
  categoryList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
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
});
