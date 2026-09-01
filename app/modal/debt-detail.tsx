import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, parseAmount } from '@/lib/format';
import type { DebtPlan } from '@/lib/types';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const { periods, selectedPeriodId, getDebtPlan, activateInstallmentPlan, settleInstallmentPlan, cancelFutureInstallments, restoreRemovedInstallment } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(selectedPeriodId);
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const value = await getDebtPlan(planId);
    setPlan(value);
    if (value) setAmountText((current) => current || String(value.installmentAmount));
  }, [getDebtPlan, planId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!plan) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>Cargando compra...</ThemedText></View></SafeAreaView>;
  const actualAmount = parseAmount(amountText);

  const run = async (action: () => Promise<void>, errorTitle: string) => {
    setSaving(true);
    try { await action(); await load(); }
    catch (error) { Alert.alert(errorTitle, error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{plan.name}</ThemedText>
        <ThemedText style={styles.secondary}>{plan.paymentMethodName} · Total pactado {formatCLP(plan.totalAmount)}</ThemedText>

        {plan.status === 'projected' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Activar primera cuota</ThemedText>
            <ThemedText style={styles.secondary}>Confirma el monto real facturado y el período donde deseas registrarla. Las siguientes usarán este monto; la última ajustará la diferencia.</ThemedText>
            <ThemedText style={styles.label}>Monto real de la cuota</ThemedText>
            <TextInput keyboardType="number-pad" value={amountText} onChangeText={setAmountText} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
            <ThemedText style={styles.label}>Registrar en el período</ThemedText>
            <View style={styles.periods}>
              {periods.map((period) => (
                <Pressable key={period.id} onPress={() => setPeriodId(period.id)} style={[styles.periodChip, { borderColor: colors.border }, periodId === period.id && styles.selectedChip]}>
                  <ThemedText style={periodId === period.id ? styles.selectedText : undefined}>{formatDate(parseDate(period.startDate))} – {formatDate(parseDate(period.endDate))}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable disabled={saving} onPress={() => {
              if (periodId == null || actualAmount == null) return Alert.alert('Faltan datos', 'Selecciona un período e ingresa el monto real.');
              run(() => activateInstallmentPlan(plan.id, periodId, actualAmount), 'No se pudo activar');
            }} style={styles.primary}><ThemedText style={styles.primaryText}>Activar plan de cuotas</ThemedText></Pressable>
          </ThemedView>
        )}

        <ThemedText type="subtitle">Historial y proyección</ThemedText>
        {plan.installments?.map((installment) => (
          <View key={installment.id}>
            <ThemedView style={styles.installment}>
              <View style={[styles.icon, installment.status === 'posted' ? styles.posted : installment.status === 'cancelled' || installment.manuallyRemoved ? styles.cancelled : styles.projected]}>
                <Ionicons name={installment.status === 'posted' ? 'checkmark' : installment.status === 'cancelled' || installment.manuallyRemoved ? 'close' : 'time-outline'} size={17} color="#fff" />
              </View>
              <View style={styles.copy}><ThemedText type="defaultSemiBold">Cuota {installment.number} de {plan.totalInstallments}</ThemedText><ThemedText style={styles.secondary}>{formatDate(parseDate(installment.dueDate))} · {installment.manuallyRemoved ? 'Eliminada manualmente' : installment.status === 'posted' ? 'Registrada' : installment.status === 'cancelled' ? 'Cancelada' : 'Proyectada'}</ThemedText></View>
              <ThemedText>{formatCLP(installment.projectedAmount)}</ThemedText>
            </ThemedView>
            {installment.expenseId != null && (
              <Pressable onPress={() => router.push({ pathname: '/modal/expense-form', params: { id: String(installment.expenseId) } })} style={styles.inlineAction}>
                <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>Editar cuota</ThemedText>
              </Pressable>
            )}
            {installment.manuallyRemoved && (
              <Pressable disabled={saving} onPress={() => run(() => restoreRemovedInstallment(installment.id), 'No se pudo registrar la cuota')} style={styles.inlineAction}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>Volver a registrar</ThemedText>
              </Pressable>
            )}
          </View>
        ))}

        {plan.status === 'active' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Gestionar saldo</ThemedText>
            <ThemedText>Saldo proyectado: {formatCLP(plan.remainingAmount)}</ThemedText>
            <Pressable disabled={saving || periodId == null} onPress={() => Alert.alert('Liquidar cuotas restantes', `Se registrará ${formatCLP(plan.remainingAmount)} en el período seleccionado y se cerrará la deuda.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Liquidar', onPress: () => run(() => settleInstallmentPlan(plan.id, periodId!), 'No se pudo liquidar') }])} style={styles.primary}><ThemedText style={styles.primaryText}>Liquidar cuotas restantes</ThemedText></Pressable>
            <Pressable disabled={saving} onPress={() => Alert.alert('Cancelar cuotas futuras', 'Las cuotas ya registradas se conservarán y las proyectadas serán canceladas.', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar futuras', style: 'destructive', onPress: () => run(() => cancelFutureInstallments(plan.id), 'No se pudo cancelar') }])} style={styles.danger}><ThemedText style={styles.dangerText}>Cancelar cuotas futuras</ThemedText></Pressable>
          </ThemedView>
        )}
        {plan.status === 'projected' && (
          <Pressable disabled={saving} onPress={() => Alert.alert('Cancelar proyección', 'La compra quedará en el historial, pero ninguna cuota será registrada.', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar proyección', style: 'destructive', onPress: () => run(() => cancelFutureInstallments(plan.id), 'No se pudo cancelar') }])} style={styles.danger}>
            <ThemedText style={styles.dangerText}>Cancelar compra proyectada</ThemedText>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 13 },
  card: { borderRadius: 12, padding: 15, gap: 11 }, secondary: { opacity: 0.65, lineHeight: 18 }, label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 16 }, periods: { gap: 7 }, periodChip: { borderWidth: 1, borderRadius: 9, padding: 10 },
  selectedChip: { backgroundColor: '#0a7ea4' }, selectedText: { color: '#fff', fontWeight: '700' }, primary: { backgroundColor: '#0a7ea4', borderRadius: 9, padding: 12, alignItems: 'center' }, primaryText: { color: '#fff', fontWeight: '700' },
  installment: { borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, posted: { backgroundColor: '#2e9d63' }, projected: { backgroundColor: '#d97706' }, cancelled: { backgroundColor: '#94a3b8' }, copy: { flex: 1 },
  inlineAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  danger: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 9, padding: 12, alignItems: 'center' }, dangerText: { color: '#dc2626', fontWeight: '700' },
});
