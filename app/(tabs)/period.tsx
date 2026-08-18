import DateTimePicker from '@react-native-community/datetimepicker';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChart } from '@/components/CategoryChart';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCLP, formatDate, toDateString } from '@/lib/format';
import { useEffect, useState } from 'react';

// Parse a date string like "2026-07-23" as a local date
function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PeriodScreen() {
  const {
    periodCategoryExpensesTotals,
    periodIncomesTotal,
    periodExpensesTotal,
    setPeriodStartDate,
    setPeriodEndDate,
    closeCurrentPeriod
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const { settings } = useDatabase();

  // Initial states are just some default dates; sync with settings later.
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);

  const withLimits = periodCategoryExpensesTotals.filter((item) => item.periodLimit != null && item.periodLimit > 0);

  // Sync dates from settings.currentPeriod whenever currentPeriodId changes
  useEffect(() => {
    if (!settings.currentPeriod) return;
    setStartDate(parseDateString(settings.currentPeriod.startDate));
    setEndDate(parseDateString(settings.currentPeriod.endDate));
  }, [settings.currentPeriodId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedView style={styles.header}>
          <ThemedText type="title">Resumen Período</ThemedText>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateContainer}>
              <ThemedText>Desde</ThemedText>
              <Pressable
                style={[
                  styles.dateButton,
                  { borderColor: colors.icon },
                  settings.currentPeriodId !== 1 && { opacity: 0.5 }, // visual hint if blocked
                ]}
                onPress={() => {
                  if (settings.currentPeriodId === 1) {
                    setShowStartDatePicker(true);
                  }
                }}
                disabled={settings.currentPeriodId !== 1}
              >
                <ThemedText>{formatDate(startDate)}</ThemedText>
              </Pressable>

              {showStartDatePicker && settings.currentPeriodId === 1 && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={async (_, selected) => {
                    if (Platform.OS === 'android') setShowStartDatePicker(false);
                    if (selected) {
                      const selectedDateStr = toDateString(selected);
                      // Chequea que la fecha seleccionada no sea mayor a la fecha de término
                      if (endDate && selected > endDate) {
                        alert("La fecha de inicio no puede ser mayor a la fecha de término.");
                        return;
                      }
                      try {
                        await setPeriodStartDate(selectedDateStr);
                        setStartDate(selected);
                      } catch (e: any) {
                        alert(e.message || "Error al actualizar fecha de inicio");
                      }
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showStartDatePicker && settings.currentPeriodId === 1 && (
                <Pressable style={styles.doneDate} onPress={() => setShowStartDatePicker(false)}>
                  <ThemedText type="link">Listo</ThemedText>
                </Pressable>
              )}
            </View>
   
            <View style={styles.dateContainer}>
              <ThemedText>Hasta</ThemedText>
              <Pressable
                style={[styles.dateButton, { borderColor: colors.icon }]}
                onPress={() => setShowEndDatePicker(true)}>
                <ThemedText>{formatDate(endDate)}</ThemedText>
              </Pressable>

              {showEndDatePicker && (
                <DateTimePicker
                  value={endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={async (_, selected) => {
                    if (Platform.OS === 'android') setShowEndDatePicker(false);
                    if (selected) {
                      const selectedDateStr = toDateString(selected);
                      // Chequea que la fecha seleccionada no sea menor a la fecha de inicio
                      if (startDate && selected < startDate) {
                        alert("La fecha de término no puede ser menor a la fecha de inicio.");
                        return;
                      }
                      try {
                        await setPeriodEndDate(selectedDateStr);
                        setEndDate(selected);
                      } catch (e: any) {
                        alert(e.message || "Error al actualizar fecha de término");
                      }
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showEndDatePicker && (
                <Pressable style={styles.doneDate} onPress={() => setShowEndDatePicker(false)}>
                  <ThemedText type="link">Listo</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </ThemedView>

        <View style={styles.totalsContainer}>
          <ThemedView style={[{ flex: 1 }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">Ingresos</ThemedText>
            <ThemedText style={styles.totalIncomes}>{formatCLP(periodIncomesTotal)}</ThemedText>
          </ThemedView>
          <ThemedView style={[{ flex: 1 }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">Gastos</ThemedText>
            <ThemedText style={styles.totalExpenses}>{formatCLP(periodExpensesTotal)}</ThemedText>
          </ThemedView>
        </View>
   
        <ThemedView style={[styles.card, styles.centered]}>
          <ThemedText type="subtitle">Saldo</ThemedText>
          <ThemedText style={periodIncomesTotal > periodExpensesTotal ? styles.totalPositiveBalance : styles.totalNegativeBalance}>{formatCLP(periodIncomesTotal - periodExpensesTotal)}</ThemedText>
        </ThemedView>

        <ThemedView style={styles.card}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Desglose gastos
          </ThemedText>
          <CategoryChart periodCategoryExpensesTotals={periodCategoryExpensesTotals} periodExpensesTotal={periodExpensesTotal} />
        </ThemedView>

        {withLimits.length > 0 && (
          <ThemedView style={styles.card}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              Límites de gastos
            </ThemedText>
            <View style={styles.limits}>
              {withLimits.map((item) => (
                <LimitProgressBar
                  key={item.categoryId}
                  name={item.categoryName}
                  color={item.categoryColor}
                  spent={item.total}
                  limit={item.periodLimit}
                />
              ))}
            </View>
          </ThemedView>
        )}
      {(periodIncomesTotal > 0 && periodExpensesTotal > 0) && (
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Pressable
            style={{
              backgroundColor: '#e74c3c',
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
            }}
            onPress={() => {
              // Las fechas del próximo periodo se calculan igual que en db.ts (ver closeCurrentPeriod)
              let proximoInicio = '', proximoTermino = '';
              const end = settings.currentPeriod?.endDate ? parseDateString(settings.currentPeriod.endDate) : null;
              if (end) {
                const nextStart = new Date(end);
                nextStart.setDate(nextStart.getDate() + 1);
                const nextEnd = new Date(nextStart);
                nextEnd.setMonth(nextEnd.getMonth() + 1);
                proximoInicio = formatDate(nextStart);
                proximoTermino = formatDate(nextEnd);
              }

              Alert.alert(
                'Cerrar período',
                `¿Está seguro? Se archivarán todos los gastos e ingresos del período.\n\nEl próximo período iniciará el ${proximoInicio} y terminará el ${proximoTermino}.`,
                [
                  { text: 'Cancelar', style: 'cancel' },
                  {
                    text: 'Cerrar período',
                    style: 'destructive',
                    onPress: async () => {
                      // Lógica real para cerrar el período
                      if (typeof closeCurrentPeriod === 'function') {
                        try {
                          await closeCurrentPeriod();
                        } catch (err) {
                          Alert.alert('Error', 'No se pudo cerrar el período.');
                        }
                      }
                    }
                  },

                ]
              );
   
            }}
          >
            <ThemedText type="defaultSemiBold" style={{ color: '#fff' }}>
              Cerrar período
            </ThemedText>
          </Pressable>
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  header: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    marginBottom: 4,
  },
  limits: {
    gap: 16,
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
  dateRangeContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  dateContainer: {
    flex: 1,
  },
  totalsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  totalIncomes: {
    fontSize: 24,
    fontWeight: '700',
    color: '#008000',
  },
  totalExpenses: {
    fontSize: 24,
    fontWeight: '700',
    color: '#e44332',
  },
  totalPositiveBalance: {
    fontSize: 26,
    fontWeight: '700',
    color: '#006080',
  },
  totalNegativeBalance: {
    fontSize: 26,
    fontWeight: '700',
    color: '#e44332',
  },
});
