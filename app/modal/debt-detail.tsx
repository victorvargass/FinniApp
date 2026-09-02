import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, ToastAndroid, View } from 'react-native';
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

function showResult(message: string) {
  if (Platform.OS === 'android') ToastAndroid.show(message, ToastAndroid.SHORT);
  else Alert.alert('Listo', message);
}

export default function DebtDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const planId = Number(id);
  const { periods, selectedPeriodId, getDebtPlan, activateInstallmentPlan, settleInstallmentPlan, cancelFutureInstallments, restoreRemovedInstallment, removeInstallmentPlan } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plan, setPlan] = useState<DebtPlan | null>(null);
  const [periodId, setPeriodId] = useState<number | null>(selectedPeriodId);
  const [amountText, setAmountText] = useState('');
  const [saving, setSaving] = useState(false);
  const [periodPickerAction, setPeriodPickerAction] = useState<'select' | number | null>(null);
  const load = useCallback(async () => {
    const value = await getDebtPlan(planId);
    setPlan(value);
    if (value) setAmountText((current) => current || String(value.installmentAmount));
  }, [getDebtPlan, planId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));

  if (!plan) return <SafeAreaView style={styles.safe}><View style={styles.center}><ThemedText>Cargando compra...</ThemedText></View></SafeAreaView>;
  const actualAmount = parseAmount(amountText);
  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;

  const run = async (action: () => Promise<void>, errorTitle: string, successMessage?: string) => {
    setSaving(true);
    try { await action(); await load(); if (successMessage) showResult(successMessage); }
    catch (error) { Alert.alert(errorTitle, error instanceof Error ? error.message : 'Inténtalo nuevamente.'); }
    finally { setSaving(false); }
  };

  const deletePlan = () => {
    if (plan.linkedExpenseCount > 0) {
      Alert.alert(
        'No se puede eliminar todavía',
        'Esta compra conserva gastos registrados. Elimina primero todas sus cuotas o liquidaciones desde Gastos.'
      );
      return;
    }
    Alert.alert(
      'Eliminar compra en cuotas',
      'Se eliminarán la compra y todas sus cuotas proyectadas. Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            setSaving(true);
            removeInstallmentPlan(plan.id)
              .then(() => {
                showResult('Compra en cuotas eliminada');
                router.back();
              })
              .catch((error) => Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Inténtalo nuevamente.'))
              .finally(() => setSaving(false));
          },
        },
      ]
    );
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
            <Pressable onPress={() => setPeriodPickerAction('select')} style={[styles.periodSelect, { borderColor: colors.border }]}>
              <ThemedText>{selectedPeriod ? `${formatDate(parseDate(selectedPeriod.startDate))} – ${formatDate(parseDate(selectedPeriod.endDate))}` : 'Seleccionar período'}</ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </Pressable>
            <Pressable disabled={saving} onPress={() => {
              if (periodId == null || actualAmount == null) return Alert.alert('Faltan datos', 'Selecciona un período e ingresa el monto real.');
              run(() => activateInstallmentPlan(plan.id, periodId, actualAmount), 'No se pudo activar', 'Primera cuota registrada');
            }} style={styles.primary}>
              <ThemedText style={styles.primaryText}>
                Activar plan de cuotas
              </ThemedText>
            </Pressable>
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
              <Pressable
                disabled={saving}
                onPress={() => setPeriodPickerAction(installment.id)}
                style={[styles.restoreButton, { borderColor: colors.primary }]}>
                <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                <ThemedText style={[styles.restoreButtonText, { color: colors.primary }]}>Registrar cuota</ThemedText>
              </Pressable>
            )}
          </View>
        ))}

        {plan.status === 'active' && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle">Gestionar saldo</ThemedText>
            <ThemedText>Saldo proyectado: {formatCLP(plan.remainingAmount)}</ThemedText>
            <ThemedText style={styles.label}>Registrar liquidación en</ThemedText>
            <Pressable onPress={() => setPeriodPickerAction('select')} style={[styles.periodSelect, { borderColor: colors.border }]}>
              <ThemedText>{selectedPeriod ? `${formatDate(parseDate(selectedPeriod.startDate))} – ${formatDate(parseDate(selectedPeriod.endDate))}` : 'Seleccionar período'}</ThemedText>
              <Ionicons name="chevron-down" size={20} color={colors.icon} />
            </Pressable>
            <Pressable disabled={saving || periodId == null} onPress={() => Alert.alert('Liquidar cuotas restantes', `Se registrará ${formatCLP(plan.remainingAmount)} en el período seleccionado y se cerrará la deuda.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Liquidar', onPress: () => run(() => settleInstallmentPlan(plan.id, periodId!), 'No se pudo liquidar', 'Cuotas liquidadas correctamente') }])} style={styles.primary}><ThemedText style={styles.primaryText}>Liquidar cuotas restantes</ThemedText></Pressable>
            <Pressable disabled={saving} onPress={() => Alert.alert('Cancelar cuotas futuras', 'Las cuotas ya registradas se conservarán y las proyectadas serán canceladas.', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar futuras', style: 'destructive', onPress: () => run(() => cancelFutureInstallments(plan.id), 'No se pudo cancelar', 'Cuotas futuras canceladas') }])} style={styles.danger}><ThemedText style={styles.dangerText}>Cancelar cuotas futuras</ThemedText></Pressable>
          </ThemedView>
        )}
        {plan.status === 'projected' && (
          <Pressable disabled={saving} onPress={() => Alert.alert('Cancelar proyección', 'La compra quedará en el historial, pero ninguna cuota será registrada.', [{ text: 'Volver', style: 'cancel' }, { text: 'Cancelar proyección', style: 'destructive', onPress: () => run(() => cancelFutureInstallments(plan.id), 'No se pudo cancelar', 'Compra proyectada cancelada') }])} style={styles.danger}>
            <ThemedText style={styles.dangerText}>Cancelar compra proyectada</ThemedText>
          </Pressable>
        )}
        <View style={styles.deleteSection}>
          {plan.linkedExpenseCount > 0 && (
            <ThemedText style={styles.deleteHint}>
              Para eliminar esta compra, primero elimina sus cuotas o liquidaciones registradas desde Gastos.
            </ThemedText>
          )}
          <Pressable disabled={saving || plan.linkedExpenseCount > 0} onPress={deletePlan} style={[styles.danger, plan.linkedExpenseCount > 0 && styles.disabled]}>
            <ThemedText style={styles.dangerText}>Eliminar compra en cuotas</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
      <Modal transparent animationType="slide" visible={periodPickerAction != null} onRequestClose={() => setPeriodPickerAction(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPeriodPickerAction(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: colors.background }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="subtitle">{typeof periodPickerAction === 'number' ? 'Registrar cuota en' : 'Seleccionar período'}</ThemedText>
              <Pressable accessibilityLabel="Cerrar selector" hitSlop={8} onPress={() => setPeriodPickerAction(null)}>
                <Ionicons name="close" size={23} color={colors.icon} />
              </Pressable>
            </View>
            <ScrollView style={styles.periodList}>
              {periods.map((period) => (
                <Pressable
                  key={period.id}
                  onPress={() => {
                    const action = periodPickerAction;
                    setPeriodId(period.id);
                    setPeriodPickerAction(null);
                    if (typeof action === 'number') {
                      void run(() => restoreRemovedInstallment(action, period.id), 'No se pudo registrar la cuota', 'Cuota registrada');
                    }
                  }}
                  style={[styles.periodOption, { borderColor: colors.border }, period.id === periodId && styles.selectedOption]}>
                  <ThemedText style={period.id === periodId ? styles.selectedOptionText : undefined}>{formatDate(parseDate(period.startDate))} – {formatDate(parseDate(period.endDate))}</ThemedText>
                  {period.id === periodId && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, content: { padding: 20, paddingBottom: 45, gap: 13 },
  card: { borderRadius: 12, padding: 15, gap: 11 }, secondary: { opacity: 0.65, lineHeight: 18 }, label: { fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 9, padding: 11, fontSize: 16 }, periodSelect: { minHeight: 46, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  primary: { minHeight: 46, backgroundColor: '#0a7ea4', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' }, primaryText: { width: '100%', color: '#fff', fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  installment: { borderRadius: 11, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, icon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, posted: { backgroundColor: '#2e9d63' }, projected: { backgroundColor: '#d97706' }, cancelled: { backgroundColor: '#94a3b8' }, copy: { flex: 1 },
  inlineAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9 },
  restoreButton: { alignSelf: 'center', minHeight: 42, marginTop: 10, marginBottom: 4, borderWidth: 1, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 16, paddingVertical: 9 },
  restoreButtonText: { fontSize: 14, lineHeight: 20, fontWeight: '700' },
  danger: { borderWidth: 1, borderColor: '#dc2626', borderRadius: 9, padding: 12, alignItems: 'center' }, dangerText: { color: '#dc2626', fontWeight: '700' },
  disabled: { opacity: 0.4 }, deleteSection: { gap: 8, marginTop: 4 }, deleteHint: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { width: '100%', maxHeight: '70%', borderRadius: 18, padding: 20, gap: 14 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  periodList: { maxHeight: 420 }, periodOption: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectedOption: { borderColor: '#0a7ea4', backgroundColor: '#0a7ea412' }, selectedOptionText: { color: '#0a7ea4', fontWeight: '700' },
});
