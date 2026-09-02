import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Platform, Pressable, SectionList, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate } from '@/lib/format';
import { parseIsoDate } from '@/lib/recurrence';
import type { RecurringDecisionItem } from '@/lib/types';

function showResult(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT);
  } else {
    Alert.alert('Listo', message);
  }
}

export default function RecurringConfirmationsScreen() {
  const {
    recurringDecisions,
    approveRecurringOccurrence,
    skipRecurringOccurrence,
    dismissSkippedOccurrence,
    retryRecurringOccurrence,
  } = useDatabase();
  const colors = Colors[useColorScheme() ?? 'light'];
  const pending = recurringDecisions.filter((item) => item.status === 'pending');
  const skipped = recurringDecisions.filter((item) => item.status === 'skipped');
  const sections = [
    { title: 'Pendientes por confirmar', data: pending },
    { title: 'Omitidos', data: skipped },
  ].filter((section) => section.data.length > 0);

  const confirmMovement = async (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? 'gasto' : 'ingreso';
    try {
      await approveRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate);
      showResult(`${noun === 'gasto' ? 'Gasto' : 'Ingreso'} recurrente creado`);
      router.replace(item.kind === 'expense' ? '/(tabs)/expenses' : '/(tabs)/incomes');
    } catch (error) {
      Alert.alert(
        `No se pudo crear el ${noun}`,
        `${error instanceof Error ? error.message : 'Inténtalo nuevamente.'}\n\nLa ejecución seguirá pendiente.`
      );
    }
  };

  const omitMovement = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? 'gasto' : 'ingreso';
    Alert.alert(
      `Omitir este ${noun}`,
      `No se creará el ${noun}. Podrás reintentarlo más adelante desde la sección Omitidos.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Omitir',
          style: 'destructive',
          onPress: () => {
            skipRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => showResult(`${noun === 'gasto' ? 'Gasto' : 'Ingreso'} recurrente omitido`))
              .catch((error) => {
                Alert.alert(
                  'No se pudo omitir',
                  error instanceof Error ? error.message : 'Inténtalo nuevamente.'
                );
              });
          },
        },
      ]
    );
  };

  const retryMovement = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? 'gasto' : 'ingreso';
    Alert.alert(
      `Reintentar ${noun}`,
      `¿Crear el ${noun} recurrente "${item.name}" en este período?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: `Crear ${noun}`,
          onPress: () => {
            retryRecurringOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => {
                showResult(`${noun === 'gasto' ? 'Gasto' : 'Ingreso'} recurrente creado`);
                router.replace(item.kind === 'expense' ? '/(tabs)/expenses' : '/(tabs)/incomes');
              })
              .catch((error) => {
                Alert.alert(
                  `No se pudo crear el ${noun}`,
                  `${error instanceof Error ? error.message : 'Inténtalo nuevamente.'}\n\nLa ejecución quedó pendiente.`
                );
              });
          },
        },
      ]
    );
  };

  const deleteSkippedNotification = (item: RecurringDecisionItem) => {
    const noun = item.kind === 'expense' ? 'gasto' : 'ingreso';
    Alert.alert(
      'Eliminar notificación',
      `Se quitará de Omitidos la notificación de "${item.name}". El ${noun} seguirá marcado como omitido y no se creará.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: () => {
            dismissSkippedOccurrence(item.kind, item.recurringId, item.scheduledDate)
              .then(() => showResult('Notificación eliminada'))
              .catch((error) => {
                Alert.alert(
                  'No se pudo eliminar',
                  error instanceof Error ? error.message : 'Inténtalo nuevamente.'
                );
              });
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => `${item.kind}-${item.recurringId}-${item.scheduledDate}`}
        contentContainerStyle={styles.list}
        ListEmptyComponent={(
          <ThemedText style={styles.empty}>No tienes confirmaciones pendientes ni omitidas.</ThemedText>
        )}
        renderSectionHeader={({ section }) => (
          <ThemedText type="subtitle" style={styles.sectionTitle}>{section.title}</ThemedText>
        )}
        renderItem={({ item }) => (
          <ThemedView style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons
                name={item.status === 'pending' ? 'notifications-outline' : 'return-up-back-outline'}
                size={21}
                color={item.status === 'pending' ? colors.primary : colors.icon}
              />
              <View style={styles.copy}>
                <ThemedText type="defaultSemiBold">{item.name}</ThemedText>
                <ThemedText style={styles.meta}>
                  {formatCLP(item.amount)} · {formatDate(parseIsoDate(item.scheduledDate))}
                </ThemedText>
              </View>
            </View>
            {item.status === 'pending' ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => omitMovement(item)}
                  style={[styles.action, { borderColor: colors.border }]}>
                  <ThemedText type="defaultSemiBold">Omitir</ThemedText>
                </Pressable>
                <Pressable onPress={() => void confirmMovement(item)} style={[styles.action, styles.primary]}>
                  <ThemedText style={styles.primaryText}>Confirmar</ThemedText>
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => deleteSkippedNotification(item)}
                  style={[styles.action, { borderColor: '#dc2626' }]}>
                  <ThemedText type="defaultSemiBold" style={styles.deleteText}>Eliminar</ThemedText>
                </Pressable>
                <Pressable
                  onPress={() => retryMovement(item)}
                  style={[styles.action, { borderColor: colors.primary }]}>
                  <ThemedText type="defaultSemiBold" style={{ color: colors.primary }}>Reintentar</ThemedText>
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
  list: { padding: 20, paddingBottom: 32, gap: 10 },
  intro: { opacity: 0.72, lineHeight: 20, marginBottom: 10 },
  empty: { textAlign: 'center', opacity: 0.6, marginTop: 40 },
  sectionTitle: { marginTop: 10, marginBottom: 4 },
  card: { borderRadius: 12, padding: 14, gap: 12, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1, gap: 3 },
  meta: { opacity: 0.65, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, borderWidth: 1, borderRadius: 9, padding: 11, alignItems: 'center' },
  primary: { borderColor: '#0a7ea4', backgroundColor: '#0a7ea4' },
  primaryText: { color: '#fff', fontWeight: '700' },
  deleteText: { color: '#dc2626' },
});
