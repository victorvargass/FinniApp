import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate, parseAmount, toDateString } from '@/lib/format';
import type { CreditCardCycle } from '@/lib/types';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function CycleCard({
  cycle,
  colors,
  onSave,
}: {
  cycle: CreditCardCycle;
  colors: typeof Colors.light;
  onSave: (amount: number | null, reconciled: boolean) => Promise<void>;
}) {
  const [amountText, setAmountText] = useState(
    cycle.statementAmount == null ? '' : String(cycle.statementAmount)
  );
  const [reconciled, setReconciled] = useState(cycle.status === 'reconciled');
  const [saving, setSaving] = useState(false);
  const amount = amountText.trim() ? parseAmount(amountText) : null;
  const difference = amount == null ? null : cycle.recordedTotal - amount;

  const save = async () => {
    if (amountText.trim() && amount == null) return Alert.alert('Monto no válido', 'Revisa el total facturado.');
    setSaving(true);
    try { await onSave(amount, reconciled); } finally { setSaving(false); }
  };

  return (
    <ThemedView style={styles.card}>
      <ThemedText type="defaultSemiBold">
        {formatDate(parseDate(cycle.startDate))} – {formatDate(parseDate(cycle.endDate))}
      </ThemedText>
      <View style={styles.row}><ThemedText>Gastos registrados</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(cycle.recordedTotal)}</ThemedText></View>
      <ThemedText style={styles.label}>Total facturado (opcional)</ThemedText>
      <TextInput
        keyboardType="number-pad"
        placeholder="No ingresado"
        placeholderTextColor={colors.icon}
        value={amountText}
        onChangeText={setAmountText}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      {difference != null && (
        <View style={styles.row}><ThemedText>Diferencia</ThemedText><ThemedText style={{ color: difference === 0 ? '#2e9d63' : '#d97706' }}>{formatCLP(difference)}</ThemedText></View>
      )}
      <View style={styles.row}>
        <View style={styles.statusCopy}>
          <ThemedText type="defaultSemiBold">Conciliado</ThemedText>
          <ThemedText style={styles.secondary}>Opcional para llevar el control del ciclo</ThemedText>
        </View>
        <Switch value={reconciled} onValueChange={setReconciled} trackColor={{ true: colors.primary }} />
      </View>
      <Pressable disabled={saving} onPress={save} style={[styles.secondaryButton, { borderColor: colors.border }, saving && { opacity: 0.6 }]}>
        <ThemedText type="defaultSemiBold">Guardar conciliación</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function CardCyclesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = Number(id);
  const { paymentMethods, getCreditCardCycles, addCreditCardCycle, editCreditCardCycle } = useDatabase();
  const method = paymentMethods.find((item) => item.id === methodId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [billingDate, setBillingDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [statementAmount, setStatementAmount] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (Number.isFinite(methodId)) setCycles(await getCreditCardCycles(methodId));
  }, [getCreditCardCycles, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const addCycle = async () => {
    const amount = statementAmount.trim() ? parseAmount(statementAmount) : null;
    if (statementAmount.trim() && amount == null) return Alert.alert('Monto no válido', 'Revisa el total facturado.');
    setSaving(true);
    try {
      await addCreditCardCycle({ paymentMethodId: methodId, endDate: toDateString(billingDate), statementAmount: amount, status: 'pending' });
      setStatementAmount('');
      await load();
    } catch (error) {
      Alert.alert('No se pudo crear el ciclo', error instanceof Error ? error.message : 'Revisa la fecha elegida.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{method?.name ?? 'Tarjeta'}</ThemedText>
        <ThemedText style={styles.explanation}>
          Cada ciclo termina en la fecha real de facturación. Los gastos desde el día siguiente a la facturación anterior quedan en el ciclo siguiente.
        </ThemedText>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">Registrar facturación</ThemedText>
          <ThemedText style={styles.label}>Fecha real de facturación</ThemedText>
          <Pressable onPress={() => setShowPicker(true)} style={[styles.input, { borderColor: colors.border }]}>
            <ThemedText>{formatDate(billingDate)}</ThemedText>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={billingDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(_, value) => {
                if (Platform.OS === 'android') setShowPicker(false);
                if (value) setBillingDate(value);
              }}
            />
          )}
          <ThemedText style={styles.label}>Total facturado (opcional)</ThemedText>
          <TextInput
            keyboardType="number-pad"
            placeholder="Ej: 245000"
            placeholderTextColor={colors.icon}
            value={statementAmount}
            onChangeText={setStatementAmount}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />
          <Pressable disabled={saving} onPress={addCycle} style={[styles.primary, saving && { opacity: 0.6 }]}>
            <ThemedText style={styles.primaryText}>Crear ciclo</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="subtitle">Ciclos anteriores</ThemedText>
        {cycles.length === 0 && <ThemedText style={styles.empty}>Aún no has registrado facturaciones.</ThemedText>}
        {cycles.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            colors={colors}
            onSave={async (amount, reconciled) => {
              await editCreditCardCycle(cycle.id, amount, reconciled ? 'reconciled' : 'pending');
              await load();
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  explanation: { opacity: 0.72, lineHeight: 20 },
  card: { borderRadius: 12, padding: 16, gap: 12 },
  label: { fontWeight: '600', marginTop: 2 },
  input: { borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  primary: { backgroundColor: '#0a7ea4', borderRadius: 9, padding: 13, alignItems: 'center', marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700' },
  empty: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusCopy: { flex: 1 },
  secondary: { opacity: 0.6, fontSize: 12 },
  secondaryButton: { borderWidth: 1, borderRadius: 9, padding: 11, alignItems: 'center' },
});
