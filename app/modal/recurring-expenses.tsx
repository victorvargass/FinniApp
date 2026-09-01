import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, Switch, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import { describeRecurrence, parseIsoDate } from '@/lib/recurrence';

function showResult(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('Listo', message, [{ text: 'Aceptar' }]);
  }
}

export default function RecurringExpensesScreen() {
  const {
    recurringExpenses,
    setRecurringExpenseActive,
    removeRecurringExpense,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    recurringIncomes,
    setRecurringIncomeActive,
    removeRecurringIncome,
  } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const [section, setSection] = useState<'expenses' | 'incomes'>('incomes');

  const tabs = (
    <View style={[styles.tabs, { borderColor: colors.border }]}> 
      {([['incomes', 'Ingresos'], ['expenses', 'Gastos']] as const).map(([value, label]) => (
        <Pressable key={value} onPress={() => setSection(value)} style={[styles.tab, section === value && styles.selectedTab]}>
          <ThemedText style={section === value ? styles.selectedTabText : undefined}>{label}</ThemedText>
        </Pressable>
      ))}
    </View>
  );

  if (section === 'incomes') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <FlatList
          data={recurringIncomes}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={tabs}
          ListEmptyComponent={<ThemedText style={styles.empty}>Aún no tienes ingresos recurrentes. Puedes crearlos desde Nuevo ingreso.</ThemedText>}
          renderItem={({ item }) => (
            <ThemedView style={[styles.card, !item.active && styles.inactive]}>
              <View style={styles.cardHeader}>
                <Pressable onPress={() => router.push({ pathname: '/modal/recurring-income-form', params: { id: String(item.id) } })} style={styles.main}>
                  <View style={[styles.dot, { backgroundColor: '#2e9d63' }]} />
                  <View style={styles.copy}>
                    <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                    <ThemedText style={styles.amount}>{formatCLP(item.amount)}</ThemedText>
                    <ThemedText style={styles.secondary}>{describeRecurrence(item)}</ThemedText>
                    <ThemedText style={styles.secondary}>{item.nextDate ? `Próximo: ${formatDate(parseIsoDate(item.nextDate))}` : 'Sin próximas ejecuciones'}</ThemedText>
                  </View>
                </Pressable>
                <Switch value={item.active} onValueChange={(active) => setRecurringIncomeActive(item.id, active).catch((error) => Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Inténtalo nuevamente.'))} trackColor={{ true: '#2e9d63' }} />
              </View>
              <View style={styles.metaRow}>
                <View style={[styles.modeBadge, { borderColor: colors.border }]}><Ionicons name="flash-outline" size={14} color={colors.icon} /><ThemedText style={styles.modeText}>Automático</ThemedText></View>
                <Pressable onPress={() => Alert.alert('Eliminar recurrencia', `¿Eliminar la recurrencia de ${item.name}? Los ingresos anteriores se conservarán.`, [{ text: 'Cancelar', style: 'cancel' }, { text: 'Eliminar', style: 'destructive', onPress: () => removeRecurringIncome(item.id).catch((error) => Alert.alert('No se pudo eliminar', error instanceof Error ? error.message : 'Inténtalo nuevamente.')) }])}>
                  <ThemedText style={styles.removeLink}>Eliminar</ThemedText>
                </Pressable>
              </View>
            </ThemedView>
          )}
        />
      </SafeAreaView>
    );
  }

  const runOccurrenceAction = async (
    action: 'approve' | 'skip',
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    try {
      if (action === 'approve') await approveRecurringOccurrence(recurringExpenseId, scheduledDate);
      else await skipRecurringOccurrence(recurringExpenseId, scheduledDate);
    } catch (error) {
      Alert.alert(
        'No se pudo completar',
        error instanceof Error ? error.message : 'Inténtalo nuevamente.'
      );
    }
  };

  const confirmRemove = (id: number, name: string) => {
    Alert.alert(
      'Eliminar recurrencia',
      `¿Eliminar la recurrencia de ${name}? Los gastos anteriores se conservarán.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            removeRecurringExpense(id)
              .then(() => showResult('Recurrencia eliminada'))
              .catch((error) => {
                Alert.alert(
                  'No se pudo eliminar',
                  error instanceof Error ? error.message : 'Inténtalo nuevamente.'
                );
              });
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={recurringExpenses}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListHeaderComponent={tabs}
        ListEmptyComponent={(
          <ThemedText style={styles.empty}>Aún no tienes gastos recurrentes.</ThemedText>
        )}
        renderItem={({ item }) => (
          <ThemedView style={[styles.card, !item.active && styles.inactive]}>
            <View style={styles.cardHeader}>
              <Pressable
                onPress={() => router.push({
                  pathname: '/modal/recurring-expense-form',
                  params: { id: String(item.id) },
                })}
                onLongPress={() => confirmRemove(item.id, item.name)}
                delayLongPress={500}
                style={styles.main}>
                <View style={[styles.dot, { backgroundColor: item.categoryColor ?? colors.primary }]} />
                <View style={styles.copy}>
                  <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                  <ThemedText style={styles.amount}>{formatCLP(item.amount)}</ThemedText>
                  <ThemedText style={styles.secondary}>{describeRecurrence(item)}</ThemedText>
                  <ThemedText style={styles.secondary}>
                    {item.nextDate
                      ? `Próximo: ${formatDate(parseIsoDate(item.nextDate))}`
                      : 'Sin próximas ejecuciones'}
                  </ThemedText>
                </View>
              </Pressable>
              <Switch
                accessibilityLabel={`${item.active ? 'Desactivar' : 'Activar'} ${item.name}`}
                value={item.active}
                onValueChange={(active) => {
                  setRecurringExpenseActive(item.id, active).catch((error) => {
                    Alert.alert('No se pudo cambiar', error instanceof Error ? error.message : 'Inténtalo nuevamente.');
                  });
                }}
                trackColor={{ true: colors.primary }}
              />
            </View>

            <View style={styles.metaRow}>
              <View style={[styles.modeBadge, { borderColor: colors.border }]}>
                <Ionicons
                  name={item.registrationMode === 'automatic' ? 'flash-outline' : 'notifications-outline'}
                  size={14}
                  color={colors.icon}
                />
                <ThemedText style={styles.modeText}>
                  {item.registrationMode === 'automatic' ? 'Automático' : 'Con confirmación'}
                </ThemedText>
              </View>
              {item.pendingCount > 0 && (
                <ThemedText style={styles.pending}>
                  {item.pendingCount} {item.pendingCount === 1 ? 'pendiente' : 'pendientes'}
                </ThemedText>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Eliminar recurrencia de ${item.name}`}
                onPress={() => confirmRemove(item.id, item.name)}>
                <ThemedText style={styles.removeLink}>Eliminar</ThemedText>
              </Pressable>
            </View>

            {item.pendingCount > 0 && item.nextDate && (
              <View style={styles.pendingActions}>
                <Pressable
                  onPress={() => runOccurrenceAction('skip', item.id, item.nextDate!)}
                  style={[styles.action, { borderColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">Omitir</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => runOccurrenceAction('approve', item.id, item.nextDate!)}
                  style={[styles.action, styles.approve]}>
                  <ThemedText style={styles.approveText}>Aprobar</ThemedText>
                </Pressable>
              </View>
            )}
          </ThemedView>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  list: { padding: 20, paddingBottom: 28, gap: 10 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 40 },
  card: { borderRadius: 12, padding: 14, gap: 12 },
  inactive: { opacity: 0.58 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  main: { flex: 1, flexDirection: 'row', gap: 10 },
  dot: { width: 16, height: 16, borderRadius: 5, marginTop: 3 },
  copy: { flex: 1, gap: 2 },
  amount: { fontSize: 15, fontWeight: '700' },
  secondary: { opacity: 0.65, fontSize: 13, lineHeight: 18 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  modeBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 16, paddingHorizontal: 9, paddingVertical: 5 },
  modeText: { fontSize: 12 },
  pending: { color: '#d97706', fontSize: 13, fontWeight: '700' },
  pendingActions: { flexDirection: 'row', gap: 8 },
  tabs: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7 },
  selectedTab: { backgroundColor: '#0a7ea4' }, selectedTabText: { color: '#fff', fontWeight: '700' },
  removeLink: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  action: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 10, alignItems: 'center' },
  approve: { borderColor: '#0a7ea4', backgroundColor: '#0a7ea4' },
  approveText: { color: '#fff', fontWeight: '700' },
});
