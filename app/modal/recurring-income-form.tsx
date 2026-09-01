import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecurringScheduleFields } from '@/components/recurring-schedule-fields';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { parseAmount } from '@/lib/format';
import type { NewRecurringSchedule } from '@/lib/types';

export default function RecurringIncomeFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recurringIncomes, editRecurringIncome, removeRecurringIncome } = useDatabase();
  const recurring = recurringIncomes.find((item) => item.id === Number(id));
  const colors = Colors[useColorScheme() ?? 'light'];
  const [name, setName] = useState(recurring?.name ?? '');
  const [amountText, setAmountText] = useState(recurring ? String(recurring.amount) : '');
  const [schedule, setSchedule] = useState<NewRecurringSchedule>(() => recurring ? {
    frequency: recurring.frequency, intervalMonths: recurring.intervalMonths,
    executionDay: recurring.executionDay, startDate: recurring.startDate,
    endDate: recurring.endDate, active: recurring.active, registrationMode: 'automatic',
  } : { frequency: 'monthly', intervalMonths: 1, executionDay: new Date().getDate(), startDate: '', endDate: null, active: true, registrationMode: 'automatic' });
  const [saving, setSaving] = useState(false);

  if (!recurring) return <SafeAreaView style={styles.safe}><ThemedText style={styles.empty}>El ingreso recurrente ya no existe.</ThemedText></SafeAreaView>;

  const save = async () => {
    const amount = parseAmount(amountText);
    if (!name.trim() || amount == null) return Alert.alert('Faltan datos', 'Ingresa un nombre y monto válidos.');
    setSaving(true);
    try {
      await editRecurringIncome(recurring.id, {
        name: name.trim(), amount, sourceIncomeId: recurring.sourceIncomeId,
        frequency: schedule.frequency, intervalMonths: schedule.intervalMonths,
        executionDay: schedule.executionDay, startDate: schedule.startDate,
        endDate: schedule.endDate, active: schedule.active,
      });
      router.back();
    } catch (error) { Alert.alert('No se pudo guardar', error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safe} edges={['bottom']}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <ThemedText style={styles.label}>Nombre</ThemedText><TextInput value={name} onChangeText={setName} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
    <ThemedText style={styles.label}>Monto</ThemedText><TextInput value={amountText} onChangeText={setAmountText} keyboardType="number-pad" style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
    <RecurringScheduleFields value={schedule} onChange={(value) => setSchedule({ ...value, registrationMode: 'automatic' })} showActiveToggle fixedStartDate={recurring.startDate} storedNextDate={recurring.nextDate} hideRegistrationMode movementKind="ingreso" />
    <Pressable disabled={saving} onPress={save} style={styles.save}><ThemedText style={styles.saveText}>{saving ? 'Guardando...' : 'Guardar cambios'}</ThemedText></Pressable>
    <Pressable disabled={saving} onPress={() => Alert.alert('Eliminar recurrencia', 'Los ingresos registrados anteriormente se conservarán.', [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => removeRecurringIncome(recurring.id).then(() => router.back()).catch((error) => Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Inténtalo nuevamente.')) }])} style={styles.remove}><ThemedText style={styles.removeText}>Eliminar recurrencia</ThemedText></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { padding: 20, paddingBottom: 36, gap: 10 }, empty: { textAlign: 'center', marginTop: 40 }, label: { fontWeight: '700', marginTop: 6 }, input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 }, save: { marginTop: 16, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#0a7ea4' }, saveText: { color: '#fff', fontWeight: '700' }, remove: { padding: 14, alignItems: 'center' }, removeText: { color: '#dc2626', fontWeight: '700' } });
