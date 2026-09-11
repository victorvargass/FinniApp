import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChart } from '@/components/CategoryChart';
import { BreakdownSection, type BreakdownMode } from '@/components/breakdown-section';
import { HomeOverview, type HomeAttentionItem } from '@/components/home-overview';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { PaymentMethodChart } from '@/components/PaymentMethodChart';
import { PeriodSelector } from '@/components/period-selector';
import { ProgressiveSetup } from '@/components/progressive-setup';
import { SavingsGoalsPeriodCard } from '@/components/SavingsGoalsPeriodCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WeeklyInsightCard } from '@/components/weekly-insight-card';
import { Colors } from '@/constants/theme';
import { useDatabase } from '@/contexts/DatabaseContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { formatCLP, formatDate, toDateString } from '@/lib/format';
import { calculateDailyAvailable, findMostUrgentCategoryLimit } from '@/lib/home-insights';
import { t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { findUrgentCardPayment } from '@/lib/payment-method-calculations';
import { buildPeriodCloseInsights } from '@/lib/period-close-insights';
import { showToast } from '@/lib/toast';
import { buildWeeklyInsight, findSavingsMilestone } from '@/lib/weekly-insights';
import { exportPeriodReport } from '@/services/PeriodReportService';
import { useEffect, useMemo, useRef, useState } from 'react';

// Parse a date string like "2026-07-23" as a local date
function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function HomeScreen() {
  const { scrollToTop } = useLocalSearchParams<{ scrollToTop?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const {
    expenses,
    incomes,
    categories,
    periodCategoryExpensesTotals,
    periodIncomesTotal,
    periodExpensesTotal,
    periodHistory,
    periodSavingsGoalActivity,
    periodSavingsFundingTotal,
    paymentMethodTotals,
    paymentMethods,
    recurringDecisions,
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
  const previousPeriodReport = selectedPeriod
    ? [...periodHistory]
      .filter((period) => period.endDate < selectedPeriod.startDate)
      .sort((first, second) => second.endDate.localeCompare(first.endDate))[0]
    : undefined;
  const hasPeriodMovements = expenses.length > 0 || incomes.length > 0;
  const dailyAvailable = isCurrentPeriod && selectedPeriod
    ? calculateDailyAvailable(periodBalance, selectedPeriod.endDate)
    : null;
  const weeklyInsight = useMemo(
    () => buildWeeklyInsight(expenses, incomes, toDateString(new Date())),
    [expenses, incomes]
  );
  const savingsMilestone = useMemo(
    () => findSavingsMilestone(periodSavingsGoalActivity),
    [periodSavingsGoalActivity]
  );
  const pendingConfirmationCount = recurringDecisions.filter((item) => item.status === 'pending').length;
  const urgentLimit = findMostUrgentCategoryLimit(periodCategoryExpensesTotals);
  const negativePaymentMethod = paymentMethods.find(
    (method) => method.active && method.availableBalance != null && method.availableBalance < 0
  );
  const activeCreditCards = paymentMethods.filter((method) => method.active && method.type === 'credit');
  const urgentCardPayment = findUrgentCardPayment(paymentMethods);
  const closeInsights = selectedPeriodReport
    ? buildPeriodCloseInsights(
      periodBalance,
      periodExpensesTotal,
      selectedPeriodReport.categories,
      previousPeriodReport
        ? previousPeriodReport.categories.reduce((sum, category) => sum + category.total, 0)
        : null
    )
    : null;
  const attentionItems: HomeAttentionItem[] = [];

  if (isCurrentPeriod && urgentCardPayment) {
    const isOverdue = urgentCardPayment.daysUntil < 0;
    attentionItems.push({
      key: `card-due-${urgentCardPayment.method.id}`,
      icon: isOverdue ? 'alert-circle-outline' : 'calendar-outline',
      title: t(isOverdue ? 'home.cardPaymentOverdueTitle' : 'home.cardPaymentDueTitle'),
      body: t(isOverdue ? 'home.cardPaymentOverdueBody' : 'home.cardPaymentDueBody', {
        name: urgentCardPayment.method.name,
        amount: formatCLP(urgentCardPayment.method.billedAmount),
        date: formatDate(urgentCardPayment.dueDate),
      }),
      tone: isOverdue ? 'danger' : 'warning',
      onPress: () => router.push({
        pathname: '/modal/payment-method-detail',
        params: { id: String(urgentCardPayment.method.id) },
      }),
    });
  }

  if (isCurrentPeriod && pendingConfirmationCount > 0) {
    attentionItems.push({
      key: 'recurrences',
      icon: 'notifications-outline',
      title: t('home.pendingRecurringTitle'),
      body: t('home.pendingRecurringBody', { count: pendingConfirmationCount }),
      tone: 'warning',
      onPress: () => router.push('/modal/recurring-confirmations'),
    });
  }
  if (isCurrentPeriod && urgentLimit?.periodLimit) {
    const exceeded = urgentLimit.ratio >= 1;
    attentionItems.push({
      key: `limit-${urgentLimit.categoryId ?? 'none'}`,
      icon: exceeded ? 'alert-circle-outline' : 'speedometer-outline',
      title: t(exceeded ? 'home.limitExceededTitle' : 'home.limitNearTitle'),
      body: t(exceeded ? 'home.limitExceededBody' : 'home.limitNearBody', {
        category: urgentLimit.categoryName,
        spent: formatCLP(urgentLimit.total),
        limit: formatCLP(urgentLimit.periodLimit),
      }),
      tone: exceeded ? 'danger' : 'warning',
      onPress: () => router.navigate({
        pathname: '/(tabs)/movements',
        params: {
          movementType: 'expenses',
          categoryFilter: urgentLimit.categoryId == null ? 'none' : String(urgentLimit.categoryId),
          paymentMethodFilter: '',
          filterRequestId: String(Date.now()),
        },
      }),
    });
  }
  if (isCurrentPeriod && negativePaymentMethod?.availableBalance != null) {
    attentionItems.push({
      key: `payment-${negativePaymentMethod.id}`,
      icon: 'card-outline',
      title: t('home.negativeBalanceTitle'),
      body: t('home.negativeBalanceBody', {
        name: negativePaymentMethod.name,
        amount: formatCLP(Math.abs(negativePaymentMethod.availableBalance)),
      }),
      tone: 'danger',
      onPress: () => router.push({
        pathname: '/modal/payment-method-detail',
        params: { id: String(negativePaymentMethod.id) },
      }),
    });
  }

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
        <HomeOverview
          balance={periodBalance}
          dailyAvailable={dailyAvailable}
          incomeTotal={periodIncomesTotal}
          expenseTotal={periodExpensesTotal}
          attentionItems={attentionItems}
          showActions={Boolean(isCurrentPeriod)}
          onAddExpense={() => router.push('/modal/expense-form')}
          onAddIncome={() => router.push('/modal/income-form')}
          onPayCard={() => {
            if (activeCreditCards.length === 1) {
              router.push({
                pathname: '/modal/expense-form',
                params: { creditPaymentTargetId: String(activeCreditCards[0].id) },
              });
            } else if (activeCreditCards.length > 1) {
              router.push('/modal/debts');
            } else {
              router.push('/modal/payment-methods');
            }
          }}
        />
        {isCurrentPeriod && (
          <ProgressiveSetup
            hasPeriod={Boolean(selectedPeriod)}
            hasPaymentMethod={paymentMethods.length > 0}
            hasCategories={categories.length > 0}
            hasMovements={hasPeriodMovements}
            onOpenPeriod={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            onOpenPaymentMethods={() => router.push('/modal/payment-methods')}
            onOpenCategories={() => router.push('/modal/categories')}
            onAddMovement={() => router.push('/modal/expense-form')}
            onOpenBackup={() => router.push('/modal/google-drive')}
          />
        )}
        {isCurrentPeriod && (
          <WeeklyInsightCard insight={weeklyInsight} savingsMilestone={savingsMilestone} />
        )}
        <ThemedView style={[styles.header, { backgroundColor: colors.surface }]}>
          <ThemedText type="subtitle">{t('home.periodDetails')}</ThemedText>
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

        {periodSavingsAvailable > 0 && (
          <ThemedText style={styles.savingsBalanceNote}>
            {t('savings.releasedInBalance', { amount: formatCLP(periodSavingsAvailable) })}
          </ThemedText>
        )}

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
                    pathname: '/(tabs)/movements',
                    params: {
                      movementType: 'expenses',
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
                  pathname: '/(tabs)/movements',
                  params: {
                    movementType: 'expenses',
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
                t('period.finishMessage', {
                  start: proximoInicio,
                  end: proximoTermino,
                  summary: t('period.finishSummary', {
                    incomes: formatCLP(periodIncomesTotal),
                    expenses: formatCLP(periodExpensesTotal),
                    balance: formatCLP(periodBalance),
                  }),
                  insights: closeInsights
                    ? t('period.finishInsights', {
                      balance: t(`period.finishBalance${closeInsights.balanceStatus === 'positive' ? 'Positive' : closeInsights.balanceStatus === 'negative' ? 'Negative' : 'Even'}`, {
                        amount: formatCLP(Math.abs(periodBalance)),
                      }),
                      comparison: closeInsights.comparisonStatus === 'first'
                        ? t('period.finishComparisonFirst')
                        : closeInsights.comparisonStatus === 'same'
                          ? t('period.finishComparisonSame')
                          : t(closeInsights.comparisonStatus === 'less' ? 'period.finishComparisonLess' : 'period.finishComparisonMore', {
                            percent: closeInsights.comparisonPercent ?? 0,
                          }),
                      category: closeInsights.topCategoryName
                        ? t('period.finishTopCategory', {
                          category: closeInsights.topCategoryName,
                          amount: formatCLP(closeInsights.topCategoryAmount),
                        })
                        : t('period.finishNoExpenses'),
                    })
                    : '',
                }),
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

                        showToast(t('period.finished'));
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 12,
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
  savingsBalanceNote: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
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
