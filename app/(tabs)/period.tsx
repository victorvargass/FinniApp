import DateTimePicker from '@react-native-community/datetimepicker';
import { router } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, ToastAndroid, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChart } from '@/components/CategoryChart';
import { BreakdownSection, type BreakdownMode } from '@/components/breakdown-section';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { PaymentMethodChart } from '@/components/PaymentMethodChart';
import { PeriodSelector } from '@/components/period-selector';
import { SavingsGoalsPeriodCard } from '@/components/SavingsGoalsPeriodCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, toDateString } from '@/lib/format';
import { t } from '@/lib/i18n';
import { exportPeriodReport } from '@/services/PeriodReportService';
import { useEffect, useState } from 'react';

// Parse a date string like "2026-07-23" as a local date
function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PeriodScreen() {
  const {
    expenses,
    incomes,
    periodCategoryExpensesTotals,
    periodIncomesTotal,
    periodExpensesTotal,
    periodHistory,
    periodSavingsGoalActivity,
    periodSavingsFundingTotal,
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
  const [isExporting, setIsExporting] = useState(false);

  const withLimits = periodCategoryExpensesTotals.filter((item) => item.periodLimit != null && item.periodLimit > 0);
  const periodSavingsWithdrawals = periodSavingsGoalActivity.reduce((sum, item) => sum + item.withdrawals, 0);
  const periodSavingsAvailable = periodSavingsWithdrawals + periodSavingsFundingTotal;
  const periodBalance = periodIncomesTotal + periodSavingsAvailable - periodExpensesTotal;
  const selectedPeriodReport = periodHistory.find((period) => period.periodId === selectedPeriod?.id);
  const hasPeriodMovements = expenses.length > 0 || incomes.length > 0;

  async function handleExport() {
    if (!selectedPeriodReport || !hasPeriodMovements || isExporting) return;
    try {
      setIsExporting(true);
      await exportPeriodReport(selectedPeriodReport);
    } catch (error) {
      console.error('No se pudo generar el reporte del período', error);
      Alert.alert(t('historicalPeriod.exportError'), t('historicalPeriod.exportRetry'));
    } finally {
      setIsExporting(false);
    }
  }

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
          <ThemedText type="title">{t('period.summary')}</ThemedText>
          <View style={styles.dateRangeContainer}>
            <View style={styles.dateContainer}>
              <ThemedText>{t('period.start')}</ThemedText>
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
                        Alert.alert(t('common.error'), t('period.invalidStart'));
                        return;
                      }
                      try {
                        await setPeriodStartDate(selectedDateStr);
                        setStartDate(selected);
                      } catch (e: any) {
                        Alert.alert(t('common.error'), e.message || t('period.updateStartError'));
                      }
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showStartDatePicker && isCurrentPeriod && selectedPeriod?.id === 1 && (
                <Pressable style={styles.doneDate} onPress={() => setShowStartDatePicker(false)}>
                  <ThemedText type="link">{t('common.done')}</ThemedText>
                </Pressable>
              )}
            </View>
   
            <View style={styles.dateContainer}>
              <ThemedText>{t('period.end')}</ThemedText>
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
                        Alert.alert(t('common.error'), t('period.invalidEnd'));
                        return;
                      }
                      try {
                        await setPeriodEndDate(selectedDateStr);
                        setEndDate(selected);
                      } catch (e: any) {
                        Alert.alert(t('common.error'), e.message || t('period.updateEndError'));
                      }
                    }
                  }}
                />
              )}
              {Platform.OS === 'ios' && showEndDatePicker && (
                <Pressable style={styles.doneDate} onPress={() => setShowEndDatePicker(false)}>
                  <ThemedText type="link">{t('common.done')}</ThemedText>
                </Pressable>
              )}
            </View>
          </View>
        </ThemedView>

        <View style={styles.totalsContainer}>
          <ThemedView style={[{ flex: 1, backgroundColor: colors.surface }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">{t('navigation.incomes')}</ThemedText>
            <ThemedText style={styles.totalIncomes}>{formatCLP(periodIncomesTotal)}</ThemedText>
          </ThemedView>
          <ThemedView style={[{ flex: 1, backgroundColor: colors.surface }, styles.card, styles.centered]}>
            <ThemedText type="subtitle">{t('navigation.expenses')}</ThemedText>
            <ThemedText style={styles.totalExpenses}>{formatCLP(periodExpensesTotal)}</ThemedText>
          </ThemedView>
        </View>
   
        <ThemedView style={[styles.card, styles.centered, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle">{t('period.balance')}</ThemedText>
          <ThemedText style={periodBalance >= 0 ? styles.totalPositiveBalance : styles.totalNegativeBalance}>{formatCLP(periodBalance)}</ThemedText>
          {periodSavingsAvailable > 0 && (
            <ThemedText style={styles.savingsBalanceNote}>
              {t('savings.releasedInBalance', { amount: formatCLP(periodSavingsAvailable) })}
            </ThemedText>
          )}
        </ThemedView>

        {selectedPeriod && (
          <SavingsGoalsPeriodCard
            items={periodSavingsGoalActivity}
            backgroundColor={colors.surface}
            asOfDate={selectedPeriod.endDate}
            onManage={() => router.push('/modal/savings-goals')}
          />
        )}

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
                  <ThemedText type="subtitle">{t('period.expenseLimits')}</ThemedText>
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

      {selectedPeriodReport && hasPeriodMovements && (
        <Pressable
          style={({ pressed }) => [
            styles.exportButton,
            { backgroundColor: colors.primary },
            (pressed || isExporting) && styles.buttonPressed,
          ]}
          disabled={isExporting}
          onPress={handleExport}
        >
          {isExporting ? (
            <View style={styles.exportingContent}>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.actionButtonText}>{t('historicalPeriod.generatingPdf')}</ThemedText>
            </View>
          ) : (
            <ThemedText style={styles.actionButtonText}>{t('historicalPeriod.exportPdf')}</ThemedText>
          )}
        </Pressable>
      )}

      {isCurrentPeriod && hasPeriodMovements && (
        <View style={{ marginTop: 24, alignItems: 'center' }}>
          <Pressable
            style={{
              backgroundColor: '#E95353',
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
                t('period.finishTitle'),
                t('period.finishMessage', { start: proximoInicio, end: proximoTermino }),
                [
                  {
                    text: t('common.cancel'),
                    style: 'cancel',
                  },
                  {
                    text: t('period.finishAction'),
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await closeCurrentPeriod();

                        const message =
                          t('period.finished');

                        if (Platform.OS === 'android') {
                          ToastAndroid.show(message, ToastAndroid.LONG);
                        } else {
                          Alert.alert(t('period.newStarted'), message);
                        }
                      } catch {
                        Alert.alert(
                          t('period.finishErrorTitle'),
                          t('period.finishError')
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
              {t('period.close')}
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
    color: '#1FAF78',
  },
  totalExpenses: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E95353',
  },
  totalPositiveBalance: {
    fontSize: 26,
    fontWeight: '700',
    color: '#174A73',
  },
  totalNegativeBalance: {
    fontSize: 26,
    fontWeight: '700',
    color: '#E95353',
  },
  savingsBalanceNote: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.65,
  },
  exportButton: {
    minHeight: 48,
    marginTop: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  exportingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    opacity: 0.72,
  },
});
