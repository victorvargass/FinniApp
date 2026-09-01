import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP } from '@/lib/format';
import type { DebtPlan } from '@/lib/types';

const STATUS_LABEL: Record<DebtPlan['status'], string> = {
  projected: 'Pendiente de activar', active: 'Activa', completed: 'Completada', cancelled: 'Cancelada',
};

export default function DebtsScreen() {
  const { paymentMethodId } = useLocalSearchParams<{ paymentMethodId?: string }>();
  const methodId = paymentMethodId ? Number(paymentMethodId) : undefined;
  const { getDebtPlans, paymentMethods } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [plans, setPlans] = useState<DebtPlan[]>([]);
  const load = useCallback(async () => setPlans(await getDebtPlans(methodId)), [getDebtPlans, methodId]);
  useFocusEffect(useCallback(() => { load().catch(() => undefined); }, [load]));
  const method = paymentMethods.find((item) => item.id === methodId);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{method ? `Cuotas · ${method.name}` : 'Deudas y cuotas'}</ThemedText>
        <ThemedText style={styles.intro}>
          Aquí puedes activar compras proyectadas, revisar su avance y administrar el saldo pendiente.
        </ThemedText>
        {plans.length === 0 && (
          <ThemedView style={styles.empty}>
            <Ionicons name="wallet-outline" size={34} color={colors.icon} />
            <ThemedText>No hay compras en cuotas para mostrar.</ThemedText>
            <ThemedText style={styles.secondary}>Se crean desde Nuevo gasto al elegir una tarjeta de crédito.</ThemedText>
          </ThemedView>
        )}
        {plans.map((plan) => (
          <Pressable key={plan.id} onPress={() => router.push({ pathname: '/modal/debt-detail', params: { id: String(plan.id) } })}>
            <ThemedView style={styles.card}>
              <View style={styles.header}>
                <View style={[styles.dot, { backgroundColor: plan.paymentMethodColor }]} />
                <View style={styles.copy}>
                  <ThemedText type="defaultSemiBold">{plan.name}</ThemedText>
                  <ThemedText style={styles.secondary}>{plan.paymentMethodName}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={21} color={colors.icon} />
              </View>
              <View style={styles.row}><ThemedText>Avance</ThemedText><ThemedText type="defaultSemiBold">{plan.postedInstallments} de {plan.totalInstallments}</ThemedText></View>
              <View style={styles.row}><ThemedText>Saldo proyectado</ThemedText><ThemedText>{formatCLP(plan.remainingAmount)}</ThemedText></View>
              <ThemedText style={[styles.status, { color: plan.status === 'active' ? '#2e9d63' : colors.primary }]}>{STATUS_LABEL[plan.status]}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 }, content: { padding: 20, paddingBottom: 40, gap: 12 },
  intro: { opacity: 0.7, lineHeight: 20 }, empty: { borderRadius: 12, padding: 24, alignItems: 'center', gap: 8 },
  card: { borderRadius: 12, padding: 15, gap: 10 }, header: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 16, height: 16, borderRadius: 6 }, copy: { flex: 1 }, secondary: { opacity: 0.62, fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 }, status: { fontSize: 12, fontWeight: '700' },
});
