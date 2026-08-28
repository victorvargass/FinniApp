import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChart } from '@/components/CategoryChart';
import { BreakdownSection, type BreakdownMode } from '@/components/breakdown-section';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { PaymentMethodChart } from '@/components/PaymentMethodChart';
import { PeriodSelector } from '@/components/period-selector';
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
    paymentMethodTotals,
    setPeriodStartDate,
    setPeriodEndDate,
    closeCurrentPeriod,
    selectedPeriod,
    settings,
  } = useDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isCurrentPeriod = selectedPeriod?.id === settings.currentPeriodId;

  // Initial states are just some default dates; sync with settings later.
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [categorySelectionReset, setCategorySelectionReset] = useState(0);
  const [breakdownMode, setBreakdownMode] = useState<BreakdownMode>('category');

  const withLimits = periodCategoryExpensesTotals.filter((item) => item.periodLimit != null && item.periodLimit > 0);

  // Sync the editable range with the period being viewed.
  useEffect(() => {
    if (!selectedPeriod) return;
    setStartDate(parseDateString(selectedPeriod.startDate));
    setEndDate(parseDateString(selectedPeriod.endDate));
    setBreakdownMode('category');
  }, [selectedPeriod]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <PeriodSelector />
        <ThemedView style={[styles.header, { backgroundColor: colors.surface }]}>
          <ThemedText type="title">Resumen Período</ThemedText>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateContainer}>
              <ThemedText>Desde</ThemedText>
              <Pressable
                style={[
                  styles.dateButton,
                  { borderColor: colors.icon },
                  (!isCurrentPeriod || selectedPeriod?.id !== 1) && { opacity: 0.5 },
                ]}
                onPress={() => {
                  if (isCurrentPeriod && selectedPeriod?.id === 1) {
                    setShowStartDatePicker(true);
                  }
                }}
                disabled={!isCurrentPeriod || selectedPeriod?.id !== 1}
              >
                <ThemedText>{formatDate(startDate)}</ThemedText>
              </Pressable>

              {showStartDatePicker && isCurrentPeriod && selectedPeriod?.id === 1 && (
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
                        Alert.alert('Error', "La fecha de inicio no puede ser mayor a la fecha de término.");
                        return;
                      }
                      try {
                        await setPeriodStartDate(selectedDateStr);
                        setStartDate(selected);
                      } catch (e: any) {
                        Alert.alert('Error', e.message || "Error al actualizar fecha de inicio");
                      }
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showStartDatePicker && isCurrentPeriod && selectedPeriod?.id === 1 && (
                <Pressable style={styles.doneDate} onPress={() => setShowStartDatePicker(false)}>
                  <ThemedText type="link">Listo</ThemedText>
                </Pressable>
              )}
            </View>
   
            <View style={styles.dateContainer}>
              <ThemedText>Hasta</ThemedText>
              <Pressable
                style={[styles.dateButton, { borderColor: colors.icon }, !isCurrentPeriod && { opacity: 0.5 }]}
                disabled={!isCurrentPeriod}
                onPress={() => setShowEndDatePicker(true)}>
                <ThemedText>{formatDate(endDate)}</ThemedText>
              </Pressable>

              {showEndDatePicker && isCurrentPeriod && (
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
                        Alert.alert('Error', "La fecha de término no puede ser menor a la fecha de inicio.");
                        return;
                      }
                      try {
                        await setPeriodEndDate(selectedDateStr);
                        setEndDate(selected);
                      } catch (e: any) {
                        Alert.alert('Error', e.message || "Error al actualizar fecha de término");
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
          <ThemedView style={[{ flex: 1, backgroundColor: colors.surface }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">Ingresos</ThemedText>
            <ThemedText style={styles.totalIncomes}>{formatCLP(periodIncomesTotal)}</ThemedText>
          </ThemedView>
          <ThemedView style={[{ flex: 1, backgroundColor: colors.surface }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">Gastos</ThemedText>
            <ThemedText style={styles.totalExpenses}>{formatCLP(periodExpensesTotal)}</ThemedText>
          </ThemedView>
        </View>
   
        <ThemedView style={[styles.card, styles.centered, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle">Saldo</ThemedText>
          <ThemedText style={periodIncomesTotal > periodExpensesTotal ? styles.totalPositiveBalance : styles.totalNegativeBalance}>{formatCLP(periodIncomesTotal - periodExpensesTotal)}</ThemedText>
        </ThemedView>

        <BreakdownSection
          mode={breakdownMode}
          onChange={setBreakdownMode}
          backgroundColor={colors.surface}
          categoryContent={(
            <>
              <CategoryChart
                periodCategoryExpensesTotals={periodCategoryExpensesTotals}
                periodExpensesTotal={periodExpensesTotal}
                selectionResetKey={`${selectedPeriod?.id ?? 'none'}-${categorySelectionReset}`}
                onOpenCategory={(categoryId) => {
                  router.navigate({
                    pathname: '/(tabs)/expenses',
                    params: {
                      categoryFilter: categoryId === null ? 'none' : String(categoryId),
                      paymentMethodFilter: '',
                      filterRequestId: String(Date.now()),
                    },
                  });
                }}
              />

              {withLimits.length > 0 && (
                <View style={[styles.limitsSection, { borderTopColor: colors.border }]}>
                  <ThemedText type="subtitle">Límites de gastos</ThemedText>
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
                </View>
              )}
            </>
          )}
          paymentMethodContent={(
            <PaymentMethodChart
              items={paymentMethodTotals}
              total={periodExpensesTotal}
              selectionResetKey={selectedPeriod?.id ?? 'none'}
              onSelectPaymentMethod={() => setCategorySelectionReset((value) => value + 1)}
              onOpenPaymentMethod={(paymentMethodId) => {
                router.navigate({
                  pathname: '/(tabs)/expenses',
                  params: {
                    categoryFilter: '',
                    paymentMethodFilter: paymentMethodId == null ? 'none' : String(paymentMethodId),
                    filterRequestId: String(Date.now()),
                  },
                });
              }}
            />
          )}
        />
      {isCurrentPeriod && (periodIncomesTotal > 0 && periodExpensesTotal > 0) && (
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
                'Finalizar período actual',
                `Se creará un nuevo período desde el ${proximoInicio} hasta el ${proximoTermino}.\n\nPodrás volver a este período y modificar sus movimientos cuando lo necesites.`,
                [
                  {
                    text: 'Cancelar',
                    style: 'cancel',
                  },
                  {
                    text: 'Finalizar y continuar',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await closeCurrentPeriod();

                        const message =
                          'El período fue finalizado y se inició el siguiente.';

                        if (Platform.OS === 'android') {
                          ToastAndroid.show(message, ToastAndroid.LONG);
                        } else {
                          Alert.alert('Nuevo período iniciado', message);
                        }
                      } catch {
                        Alert.alert(
                          'No se pudo finalizar',
                          'Ocurrió un problema al crear el siguiente período. Inténtalo nuevamente.'
                        );
                      }
                    },
                  },
                ],
                { cancelable: true }
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
  limits: {
    gap: 16,
  },
  limitsSection: {
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 18,
    gap: 14,
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
