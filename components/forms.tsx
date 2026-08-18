import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ColorPicker } from '@/components/ColorPicker';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate, parseAmount, toDateString } from '@/lib/format';
import type { Category, Expense, Income } from '@/lib/types';

function parseDateString(value: string) {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
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
      } else {
        await addCategory(data);
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
  const { categories, addExpense, editExpense, settings } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [name, setName] = useState(expense?.name ?? '');
  const [amountText, setAmountText] = useState<String>(expense?.amount ? String(expense?.amount) : '');
  const [categoryId, setCategoryId] = useState<number | null>(expense?.categoryId ?? null);
  const period = settings?.currentPeriod;
  const [date, setDate] = useState(
    expense?.date
      ? parseDateString(expense.date)
      : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Ingresa un nombre para el gasto');
      return;
    }
    const amount = parseAmount(amountText as string);
    if (amount == null) {
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
          `La fecha del ingreso debe estar en las fechas del período actual (${formatDate(startDate)} al ${formatDate(endDate)}).`
        );
        return;
      }
    }
    
    setSaving(true);
    try {
      const data = { name: name.trim(), amount, categoryId, date: toDateString(date) };
      if (expense) {
        await editExpense(expense.id, data);
      } else {
        await addExpense(data)
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

      <ThemedText style={styles.label}>Monto (CLP)</ThemedText>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.icon }]}
        value={amountText as string}
        onChangeText={setAmountText}
        placeholder="Ej: 25000"
        placeholderTextColor={colors.icon}
        keyboardType="number-pad"
      />

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
  const { addIncome, editIncome, settings } = useDatabase();
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
      } else {
        await addIncome(data);
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
