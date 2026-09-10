import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
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
import { logAppError } from '@/lib/logger';
import { showToast } from '@/lib/toast';
import { exportPeriodReport } from '@/services/PeriodReportService';
import { useEffect, useRef, useState } from 'react';

// Parse a date string like "2026-07-23" as a local date
function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function PeriodScreen() {
  const { scrollToTop } = useLocalSearchParams<{ scrollToTop?: string }>();
  const scrollRef = useRef<ScrollView>(null);
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
    isPeriodChanging,
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
  const [startDateDraft, setStartDateDraft] = useState<Date | null>(null);
  const [endDateDraft, setEndDateDraft] = useState<Date | null>(null);
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

  async function saveStartDate(selected: Date) {
    const selectedDateStr = toDateString(selected);
    if (selectedDateStr === toDateString(startDate)) return;
    if (selected > endDate) {
      Alert.alert(t('common.error'), t('period.invalidStart'));
      return;
    }
    try {
      await setPeriodStartDate(selectedDateStr);
      setStartDate(selected);
      showToast(t('period.startDateUpdated'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('period.updateStartError'));
    }
  }

  async function saveEndDate(selected: Date) {
    const selectedDateStr = toDateString(selected);
    if (selectedDateStr === toDateString(endDate)) return;
    if (selected < startDate) {
      Alert.alert(t('common.error'), t('period.invalidEnd'));
      return;
    }
    try {
      await setPeriodEndDate(selectedDateStr);
      setEndDate(selected);
      showToast(t('period.endDateUpdated'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('period.updateEndError'));
    }
  }

  async function handleExport() {
    if (!selectedPeriodReport || !hasPeriodMovements || isExporting) return;
    try {
      setIsExporting(true);
      await exportPeriodReport(selectedPeriodReport, {
        onGenerated: () => showToast(t('historicalPeriod.pdfGenerated')),
      });
    } catch (error) {
      logAppError('report.export', error);
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

  useEffect(() => {
    if (!scrollToTop) return;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: true }));
  }, [scrollToTop]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.screen }]} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
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
                    setStartDateDraft(startDate);
                    setShowStartDatePicker(true);
                  }
                }}
                disabled={!isCurrentPeriod || selectedPeriod?.id !== 1}
              >
                <ThemedText>{formatDate(startDate)}</ThemedText>
              </Pressable>

              {showStartDatePicker && isCurrentPeriod && selectedPeriod?.id === 1 && (
                <DateTimePicker
                  value={startDateDraft ?? startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') setShowStartDatePicker(false);
                    if (event.type === 'dismissed' || !selected) return;
                    if (Platform.OS === 'ios') setStartDateDraft(selected);
                    else void saveStartDate(selected);
                  }}
                />
              )}
              {Platform.OS === 'ios' && showStartDatePicker && isCurrentPeriod && selectedPeriod?.id === 1 && (
                <Pressable style={styles.doneDate} onPress={() => {
                  setShowStartDatePicker(false);
                  if (startDateDraft) void saveStartDate(startDateDraft);
                }}>
                  <ThemedText type="link">{t('common.done')}</ThemedText>
                </Pressable>
              )}
            </View>
   
            <View style={styles.dateContainer}>
              <ThemedText>{t('period.end')}</ThemedText>
              <Pressable
                style={[styles.dateButton, { borderColor: colors.icon }, !isCurrentPeriod && { opacity: 0.5 }]}
                disabled={!isCurrentPeriod}
                onPress={() => {
                  setEndDateDraft(endDate);
                  setShowEndDatePicker(true);
                }}>
                <ThemedText>{formatDate(endDate)}</ThemedText>
              </Pressable>

              {showEndDatePicker && isCurrentPeriod && (
                <DateTimePicker
                  value={endDateDraft ?? endDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android') setShowEndDatePicker(false);
                    if (event.type === 'dismissed' || !selected) return;
                    if (Platform.OS === 'ios') setEndDateDraft(selected);
                    else void saveEndDate(selected);
                  }}
                />
              )}
              {Platform.OS === 'ios' && showEndDatePicker && (
                <Pressable style={styles.doneDate} onPress={() => {
                  setShowEndDatePicker(false);
                  if (endDateDraft) void saveEndDate(endDateDraft);
                }}>
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
            accessibilityLabel={t('period.close')}
            testID="period-close"
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
      {isPeriodChanging && (
        <View
          accessibilityLabel={t('period.loading')}
          accessibilityRole="progressbar"
          style={[styles.loadingOverlay, { backgroundColor: `${colors.screen}F2` }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText type="defaultSemiBold">{t('period.loading')}</ThemedText>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
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
