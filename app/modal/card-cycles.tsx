import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, parseAmount, toDateString } from '@/lib/format';
import type { CreditCardCycle } from '@/lib/types';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function parseNonNegativeAmount(value: string): number | null {
  const cleaned = value.replace(/\./g, '').replace(/,/g, '').trim();
  if (!cleaned) return 0;
  const amount = Number.parseInt(cleaned, 10);
  return Number.isNaN(amount) || amount < 0 ? null : amount;
}

function latestBillingDate(billingDay: number | null) {
  const today = new Date();
  if (billingDay == null) return today;
  const candidate = new Date(today.getFullYear(), today.getMonth(), 1, 12);
  const monthLastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
  candidate.setDate(Math.min(billingDay, monthLastDay));
  if (candidate > today) {
    candidate.setMonth(candidate.getMonth() - 1, 1);
    const previousMonthLastDay = new Date(candidate.getFullYear(), candidate.getMonth() + 1, 0).getDate();
    candidate.setDate(Math.min(billingDay, previousMonthLastDay));
  }
  return candidate;
}

function CycleCard({
  cycle,
  colors,
  onConsolidate,
  onUnreconcile,
}: {
  cycle: CreditCardCycle;
  colors: typeof Colors.light;
  onConsolidate: (statementAmount: number, bankChargeAmount: number) => Promise<void>;
  onUnreconcile: () => Promise<void>;
}) {
  const [amountText, setAmountText] = useState(
    cycle.statementAmount == null ? '' : String(cycle.statementAmount)
  );
  const [bankChargeText, setBankChargeText] = useState('');
  const [saving, setSaving] = useState(false);
  const amount = amountText.trim() ? parseAmount(amountText) : null;
  const bankCharge = parseNonNegativeAmount(bankChargeText);
  const adjustment = amount == null || bankCharge == null
    ? null
    : amount - cycle.recordedTotal - bankCharge;

  const consolidate = () => {
    if (amount == null) return Alert.alert('Falta el monto real', 'Ingresa el total que aparece en el estado de cuenta del banco.');
    if (bankCharge == null) return Alert.alert('Monto no válido', 'Revisa los cargos bancarios.');
    Alert.alert(
      'Consolidar período',
      'Se crearán los ajustes necesarios y este ciclo quedará protegido contra cambios. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Consolidar',
          onPress: async () => {
            setSaving(true);
            try {
              await onConsolidate(amount, bankCharge);
            } catch (error) {
              Alert.alert('No se pudo consolidar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  if (cycle.status === 'reconciled') {
    const confirmUnreconcile = () => Alert.alert(
      'Desconsolidar período',
      'Se eliminarán únicamente los ajustes automáticos creados al consolidar. Tus compras se conservarán y volverán a quedar editables.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desconsolidar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await onUnreconcile();
            } catch (error) {
              Alert.alert('No se pudo desconsolidar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
    return (
      <ThemedView style={[styles.card, styles.reconciledCard]}>
        <View style={styles.cycleHeader}>
          <View style={styles.statusIcon}><Ionicons name="checkmark" size={18} color="#fff" /></View>
          <View style={styles.statusCopy}>
            <ThemedText type="defaultSemiBold">
              {formatDate(parseDate(cycle.startDate))} – {formatDate(parseDate(cycle.endDate))}
            </ThemedText>
            <ThemedText style={styles.reconciledText}>Consolidado · historial protegido</ThemedText>
          </View>
        </View>
        <View style={styles.row}><ThemedText>Total real del banco</ThemedText><ThemedText type="defaultSemiBold">{formatCLP(cycle.statementAmount ?? 0)}</ThemedText></View>
        <View style={styles.row}><ThemedText>Compras registradas</ThemedText><ThemedText>{formatCLP(cycle.recordedTotal - cycle.bankChargeAmount - cycle.adjustmentAmount)}</ThemedText></View>
        <View style={styles.row}><ThemedText>Mantención / comisiones</ThemedText><ThemedText>{formatCLP(cycle.bankChargeAmount)}</ThemedText></View>
        {cycle.adjustmentAmount !== 0 && <View style={styles.row}><ThemedText>Diferencia / intereses</ThemedText><ThemedText>{formatCLP(cycle.adjustmentAmount)}</ThemedText></View>}
        <Pressable disabled={saving} onPress={confirmUnreconcile} style={styles.secondaryButton}>
          <Ionicons name="lock-open-outline" size={19} color={colors.primary} />
          <ThemedText style={[styles.secondaryButtonText, { color: colors.primary }]}>Desconsolidar</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.card}>
      <View style={styles.closeNotice}>
        <Ionicons name="card-outline" size={22} color={colors.primary} />
        <View style={styles.statusCopy}>
          <ThemedText type="defaultSemiBold">Período cerrado</ThemedText>
          <ThemedText style={styles.secondary}>
            Facturación estimada: {formatCLP(cycle.recordedTotal)}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={styles.cycleDates}>
        {formatDate(parseDate(cycle.startDate))} – {formatDate(parseDate(cycle.endDate))}
      </ThemedText>
      <ThemedText type="defaultSemiBold">2. Confirma el estado de cuenta</ThemedText>
      <ThemedText style={styles.label}>Monto real facturado</ThemedText>
      <TextInput
        keyboardType="number-pad"
        placeholder={`Ej: ${cycle.recordedTotal}`}
        placeholderTextColor={colors.icon}
        value={amountText}
        onChangeText={setAmountText}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      <ThemedText style={styles.label}>Mantención, comisiones o cargos (opcional)</ThemedText>
      <TextInput
        keyboardType="number-pad"
        placeholder="0"
        placeholderTextColor={colors.icon}
        value={bankChargeText}
        onChangeText={setBankChargeText}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      {adjustment != null && (
        <View style={styles.adjustmentBox}>
          <ThemedText style={styles.secondary}>Ajuste automático restante</ThemedText>
          <ThemedText type="defaultSemiBold" style={{ color: adjustment === 0 ? '#2e9d63' : '#d97706' }}>
            {formatCLP(adjustment)}
          </ThemedText>
        </View>
      )}
      <Pressable disabled={saving} onPress={consolidate} style={[styles.primary, saving && { opacity: 0.6 }]}>
        <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
        <ThemedText style={styles.primaryText}>{saving ? 'Consolidando...' : 'Consolidar período'}</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

export default function CardCyclesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const methodId = Number(id);
  const { paymentMethods, getCreditCardCycles, addCreditCardCycle, reconcileCreditCardCycle, unreconcileCreditCardCycle } = useDatabase();
  const method = paymentMethods.find((item) => item.id === methodId);
  const colors = Colors[useColorScheme() ?? 'light'];
  const [cycles, setCycles] = useState<CreditCardCycle[]>([]);
  const [billingDate, setBillingDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const initializedBillingDate = useRef(false);

  useEffect(() => {
    if (!method || initializedBillingDate.current) return;
    setBillingDate(latestBillingDate(method.billingDay));
    initializedBillingDate.current = true;
  }, [method]);

  const load = useCallback(async () => {
    if (Number.isFinite(methodId)) setCycles(await getCreditCardCycles(methodId));
  }, [getCreditCardCycles, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  const addCycle = async () => {
    setSaving(true);
    try {
      await addCreditCardCycle({ paymentMethodId: methodId, endDate: toDateString(billingDate), statementAmount: null, status: 'pending' });
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
        <ThemedText style={styles.explanation}>Cierra el ciclo, compara con tu estado de cuenta y consolídalo. FinniApp registrará cualquier diferencia sin modificar tus compras.</ThemedText>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle">1. Registrar cierre</ThemedText>
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
          <Pressable disabled={saving} onPress={addCycle} style={[styles.primary, saving && { opacity: 0.6 }]}>
            <ThemedText style={styles.primaryText}>Crear cierre estimado</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedText type="subtitle">Estados de cuenta</ThemedText>
        {cycles.length === 0 && <ThemedText style={styles.empty}>Aún no has registrado facturaciones.</ThemedText>}
        {cycles.map((cycle) => (
          <CycleCard
            key={cycle.id}
            cycle={cycle}
            colors={colors}
            onConsolidate={async (amount, bankChargeAmount) => {
              await reconcileCreditCardCycle(cycle.id, { statementAmount: amount, bankChargeAmount });
              await load();
            }}
            onUnreconcile={async () => {
              await unreconcileCreditCardCycle(cycle.id);
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
  primary: { backgroundColor: '#0a7ea4', borderRadius: 9, padding: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 4 },
  primaryText: { color: '#fff', fontWeight: '700' },
  empty: { opacity: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  statusCopy: { flex: 1 },
  secondary: { opacity: 0.6, fontSize: 12 },
  closeNotice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12, backgroundColor: '#0a7ea418' },
  cycleDates: { opacity: 0.7, fontSize: 13 },
  adjustmentBox: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 10, borderRadius: 9, backgroundColor: '#d9770614' },
  cycleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2e9d63' },
  reconciledCard: { borderWidth: 1, borderColor: '#2e9d6355' },
  reconciledText: { color: '#2e9d63', fontSize: 12, fontWeight: '700' },
  secondaryButton: { borderWidth: 1, borderColor: '#0a7ea455', borderRadius: 9, padding: 11, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 4 },
  secondaryButtonText: { fontWeight: '700' },
});
