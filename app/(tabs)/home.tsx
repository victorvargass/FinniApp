import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChart } from '@/components/CategoryChart';
import { BreakdownSection, type BreakdownMode } from '@/components/breakdown-section';
import {
  FinancialExplanationModal,
  type FinancialExplanation,
  type FinancialExplanationLine,
} from '@/components/financial-explanation-modal';
import { HomeDebtsCard } from '@/components/home-debts-card';
import { HomeAttentionSection, type HomeAttentionItem } from '@/components/home-overview';
import { HomePaymentBalancesCard } from '@/components/home-payment-balances-card';
import { HomeSummaryCards } from '@/components/home-summary-cards';
import { LimitProgressBar } from '@/components/LimitProgressBar';
import { PaymentMethodChart } from '@/components/PaymentMethodChart';
import { PeriodSelector } from '@/components/period-selector';
import { ProgressiveSetup } from '@/components/progressive-setup';
import { SavingsGoalsPeriodCard } from '@/components/SavingsGoalsPeriodCard';
import { ThemedText } from '@/components/themed-text';
import { WeeklyInsightCard } from '@/components/weekly-insight-card';
import { Colors } from '@/constants/theme';
import {
  useDebtDatabase,
  useMovementDatabase,
  useOrganizerDatabase,
  usePaymentDatabase,
  usePeriodDatabase,
  usePreferenceDatabase,
  useRecurrenceDatabase,
  useSavingsDatabase,
} from '@/contexts/DatabaseDomainContexts';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Alert } from '@/lib/alert';
import { groupFinancialForecastItems } from '@/lib/financial-forecast';
import { formatCLP, formatDate, formatMoney, toDateString } from '@/lib/format';
import { findMostUrgentCategoryLimit } from '@/lib/home-insights';
import { dismissHomeAttention, getHomeAttentionDismissals, restoreHomeAttention } from '@/lib/home-attention-dismissals';
import type { HomeGlobalMetricId, HomePeriodMetricId, HomeSectionId } from '@/lib/home-preferences';
import { visibleHomeDebts, visibleHomePaymentMethods } from '@/lib/home-visibility';
import { t } from '@/lib/i18n';
import { logAppError } from '@/lib/logger';
import { getPendingNotificationMovements } from '@/lib/notification-movements';
import { findUrgentCardPayments, getCreditCardDebtAmount } from '@/lib/payment-method-calculations';
import { getHomePaymentMethods, sumKnownAvailableBalances } from '@/lib/payment-method-groups';
import {
  calculatePeriodAvailable,
  calculatePeriodOverviewExpenses,
} from '@/lib/period-card-cashflow';
import { buildPeriodCloseInsights } from '@/lib/period-close-insights';
import type { Debt, DebtPlan, FinancialForecastItem, PaymentMethod, SavingsGoalPeriodActivity } from '@/lib/types';
import { hasUserCreatedCategory } from '@/lib/setup-progress-state';
import {
  confirmFirstPeriodDate,
  hasConfiguredFirstPeriod,
  markFirstPeriodConfigured,
} from '@/lib/setup-progress';
import { showToast } from '@/lib/toast';
import { buildWeeklyInsight, findSavingsMilestone } from '@/lib/weekly-insights';
import { getBudgetForecast } from '@/repositories';
import { exportPeriodReport } from '@/services/PeriodReportService';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Parse a date string like "2026-07-23" as a local date
function parseDateString(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function HomeScreen() {
  const { scrollToTop } = useLocalSearchParams<{ scrollToTop?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const { expenses, incomes } = useMovementDatabase();
  const { categories } = useOrganizerDatabase();
  const {
    periodCategoryExpensesTotals,
    periodIncomesTotal,
    periodExpensesTotal,
    periodHistory,
    isPeriodChanging,
    periodRefreshFailed,
    refresh,
    setPeriodStartDate,
    setPeriodEndDate,
    closeCurrentPeriod,
    selectedPeriod,
    settings,
  } = usePeriodDatabase();
  const {
    periodSavingsGoalActivity,
    periodSavingsFundingTotal,
    savingsGoals,
    savingsGroups,
  } = useSavingsDatabase();
  const { unbilledCreditCardTotal, getDebts, getDebtPlans } = useDebtDatabase();
  const { paymentMethodTotals, paymentMethods } = usePaymentDatabase();
  const { recurringDecisions } = useRecurrenceDatabase();
  const { appNotifications, setAppNotificationRead } = usePreferenceDatabase();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isCurrentPeriod = selectedPeriod?.id === settings.currentPeriodId;
  const today = toDateString(new Date());

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
  const [financialExplanation, setFinancialExplanation] = useState<FinancialExplanation | null>(null);
  const [hasConfiguredPeriod, setHasConfiguredPeriod] = useState(false);
  const [homeDebts, setHomeDebts] = useState<Debt[]>([]);
  const [homeDebtPlans, setHomeDebtPlans] = useState<DebtPlan[]>([]);
  const [overdueForecastItems, setOverdueForecastItems] = useState<FinancialForecastItem[]>([]);
  const [pendingNotificationMovementIds, setPendingNotificationMovementIds] = useState<string[]>([]);
  const [dismissedAttentionIds, setDismissedAttentionIds] = useState<string[] | null>(null);
  const [lastDismissedAttentionId, setLastDismissedAttentionId] = useState<string | null>(null);
  const undoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (undoDismissTimerRef.current) clearTimeout(undoDismissTimerRef.current);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    Promise.all([getDebts(), getDebtPlans()])
      .then(([nextDebts, nextPlans]) => {
        if (!active) return;
        setHomeDebts(nextDebts);
        setHomeDebtPlans(nextPlans);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [getDebtPlans, getDebts]));

  useFocusEffect(useCallback(() => {
    let active = true;
    if (!isCurrentPeriod || selectedPeriod?.id == null) {
      setOverdueForecastItems([]);
      return () => { active = false; };
    }
    getBudgetForecast(selectedPeriod.id, today)
      .then((forecast) => {
        if (active) {
          setOverdueForecastItems(groupFinancialForecastItems(forecast.items, today).overdue);
        }
      })
      .catch((error) => {
        if (!active) return;
        setOverdueForecastItems([]);
        logAppError('forecast.load', error);
      });
    return () => { active = false; };
  }, [isCurrentPeriod, selectedPeriod?.id, today]));

  useFocusEffect(useCallback(() => {
    let active = true;
    getHomeAttentionDismissals()
      .then((ids) => { if (active) setDismissedAttentionIds(ids); })
      .catch(() => { if (active) setDismissedAttentionIds([]); });
    return () => { active = false; };
  }, []));

  useFocusEffect(useCallback(() => {
    let active = true;
    const loadPendingNotificationMovements = async () => {
      try {
        const pendingMovements = await getPendingNotificationMovements();
        if (active) {
          setPendingNotificationMovementIds(pendingMovements.map((item) => item.id).sort());
        }
      } catch (error) {
        if (!active) return;
        setPendingNotificationMovementIds([]);
        logAppError('home.pendingNotificationMovements', error);
      }
    };

    void loadPendingNotificationMovements();
    const interval = setInterval(() => {
      void loadPendingNotificationMovements();
    }, 10_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []));

  const dismissAttention = useCallback((id: string) => {
    if (undoDismissTimerRef.current) clearTimeout(undoDismissTimerRef.current);
    setLastDismissedAttentionId(id);
    undoDismissTimerRef.current = setTimeout(() => {
      setLastDismissedAttentionId(null);
      undoDismissTimerRef.current = null;
    }, 7000);
    setDismissedAttentionIds((current) => current == null || current.includes(id) ? current : [...current, id]);
    dismissHomeAttention(id)
      .then(setDismissedAttentionIds)
      .then(() => showToast(t('home.attentionDismissed')))
      .catch(() => {
        if (undoDismissTimerRef.current) clearTimeout(undoDismissTimerRef.current);
        undoDismissTimerRef.current = null;
        setLastDismissedAttentionId(null);
        setDismissedAttentionIds((current) => current?.filter((item) => item !== id) ?? []);
        showToast(t('errors.couldNotSave'));
      });
  }, []);

  const undoDismissAttention = useCallback(() => {
    const id = lastDismissedAttentionId;
    if (!id) return;
    if (undoDismissTimerRef.current) clearTimeout(undoDismissTimerRef.current);
    undoDismissTimerRef.current = null;
    setLastDismissedAttentionId(null);
    setDismissedAttentionIds((current) => current?.filter((item) => item !== id) ?? []);
    restoreHomeAttention(id)
      .then(setDismissedAttentionIds)
      .catch(() => {
        setDismissedAttentionIds((current) => current == null || current.includes(id) ? current : [...current, id]);
        showToast(t('errors.couldNotSave'));
      });
  }, [lastDismissedAttentionId]);

  const withLimits = periodCategoryExpensesTotals.filter((item) => item.periodLimit != null && item.periodLimit > 0);
  const periodSavingsWithdrawals = periodSavingsGoalActivity.reduce((sum, item) => sum + item.withdrawals, 0);
  const periodSavingsAvailable = periodSavingsWithdrawals + periodSavingsFundingTotal;
  const selectedPeriodReport = periodHistory.find((period) => period.periodId === selectedPeriod?.id);
  const periodOverviewExpensesTotal = useMemo(
    () => calculatePeriodOverviewExpenses(expenses),
    [expenses]
  );
  const periodOverviewBalance = calculatePeriodAvailable(
    periodIncomesTotal,
    periodOverviewExpensesTotal,
    periodSavingsAvailable,
    {
      paymentsFromAccounts: selectedPeriodReport?.cardPaymentsFromAccountsTotal ?? 0,
      internalAdjustments: selectedPeriodReport?.cardInternalAdjustmentsTotal ?? 0,
    }
  );
  const periodBalance = calculatePeriodAvailable(
    periodIncomesTotal,
    periodExpensesTotal,
    periodSavingsAvailable,
    {
      paymentsFromAccounts: selectedPeriodReport?.cardPaymentsFromAccountsTotal ?? 0,
      internalAdjustments: selectedPeriodReport?.cardInternalAdjustmentsTotal ?? 0,
    }
  );
  const previousPeriodReport = selectedPeriod
    ? [...periodHistory]
      .filter((period) => period.endDate < selectedPeriod.startDate)
      .sort((first, second) => second.endDate.localeCompare(first.endDate))[0]
    : undefined;
  const hasPeriodMovements = expenses.length > 0 || incomes.length > 0;
  const weeklyInsight = useMemo(
    () => buildWeeklyInsight(expenses, incomes, today),
    [expenses, incomes, today]
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
  const urgentCardPayments = findUrgentCardPayments(paymentMethods);
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
  const unreadAppNotifications = appNotifications.filter((notification) => !notification.isRead);

  if (isCurrentPeriod) {
    for (const notification of unreadAppNotifications) {
      attentionItems.push({
        key: `app-notification-${notification.id}`,
        icon: notification.kind.includes('payment') ? 'cash-outline' : 'notifications-outline',
        title: notification.title,
        body: notification.body,
        tone: 'action',
        onPress: () => router.push('/modal/recurring-confirmations'),
        onDismiss: () => {
          void setAppNotificationRead(notification.id, true)
            .catch(() => showToast(t('errors.couldNotChange')));
        },
      });
    }
  }

  if (isCurrentPeriod && pendingNotificationMovementIds.length > 0) {
    const pendingMovementCount = pendingNotificationMovementIds.length;
    const attentionId = `notification-movements-${pendingNotificationMovementIds.join('_')}`;
    attentionItems.push({
      key: attentionId,
      icon: 'receipt-outline',
      title: t('home.pendingNotificationMovementsTitle'),
      body: t(
        pendingMovementCount === 1
          ? 'home.pendingNotificationMovementsBodyOne'
          : 'home.pendingNotificationMovementsBodyOther',
        { count: pendingMovementCount }
      ),
      tone: 'warning',
      onPress: () => router.push('/modal/pending-movements' as never),
      onDismiss: () => dismissAttention(attentionId),
    });
  }

  if (isCurrentPeriod) {
    for (const urgentCardPayment of urgentCardPayments) {
      const isOverdue = urgentCardPayment.daysUntil < 0;
      const attentionId = `card-due-${urgentCardPayment.method.id}-${toDateString(urgentCardPayment.dueDate)}-${urgentCardPayment.method.billedAmount}`;
      attentionItems.push({
        key: attentionId,
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
        onDismiss: () => dismissAttention(attentionId),
      });
    }
  }

  if (isCurrentPeriod) {
    const pendingRecurrenceIds = new Set(recurringDecisions
      .filter((item) => item.status === 'pending')
      .map((item) => `${item.kind}-${item.recurringId}-${item.scheduledDate}`));
    for (const item of overdueForecastItems) {
      const coveredByExistingAlert = item.kind === 'billed'
        || ((item.kind === 'expense' || item.kind === 'income') && pendingRecurrenceIds.has(item.id));
      if (coveredByExistingAlert) continue;

      const attentionId = `forecast-overdue-${item.id}-${item.date}-${item.amount}`;
      const isReceivable = item.kind === 'receivable' || item.kind === 'income';
      attentionItems.push({
        key: attentionId,
        icon: isReceivable ? 'arrow-down-circle-outline' : 'alert-circle-outline',
        title: t(isReceivable ? 'home.overdueReceivableTitle' : 'home.overdueMovementTitle'),
        body: t('home.overdueForecastBody', {
          name: item.name,
          amount: formatCLP(item.amount),
          date: formatDate(parseDateString(item.date)),
        }),
        tone: 'danger',
        onPress: () => {
          const debtMatch = item.id.match(/^debt-(\d+)$/);
          const recurrenceMatch = item.id.match(/^(expense|income)-(\d+)-/);
          if (debtMatch) {
            router.push({
              pathname: '/modal/manual-debt-detail',
              params: { id: debtMatch[1] },
            });
          } else if (recurrenceMatch) {
            router.push({
              pathname: '/modal/recurrence-detail',
              params: { id: recurrenceMatch[2], kind: recurrenceMatch[1] },
            } as never);
          } else {
            router.push('/modal/budget-forecast' as never);
          }
        },
        onDismiss: () => dismissAttention(attentionId),
      });
    }
  }

  if (isCurrentPeriod && pendingConfirmationCount > 0) {
    const attentionId = `recurrences-${recurringDecisions
      .filter((item) => item.status === 'pending')
      .map((item) => `${item.kind}-${item.recurringId}-${item.scheduledDate}`)
      .sort()
      .join('_')}`;
    attentionItems.push({
      key: attentionId,
      icon: 'notifications-outline',
      title: t('home.pendingRecurringTitle'),
      body: t('home.pendingRecurringBody', { count: pendingConfirmationCount }),
      tone: 'warning',
      onPress: () => router.push('/modal/recurring-confirmations'),
      onDismiss: () => dismissAttention(attentionId),
    });
  }
  if (isCurrentPeriod && urgentLimit?.periodLimit) {
    const exceeded = urgentLimit.ratio >= 1;
    const attentionId = `limit-${selectedPeriod?.id ?? 'none'}-${urgentLimit.categoryId ?? 'none'}-${exceeded ? 'exceeded' : 'near'}-${urgentLimit.periodLimit}`;
    attentionItems.push({
      key: attentionId,
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
      onDismiss: () => dismissAttention(attentionId),
    });
  }
  if (isCurrentPeriod && negativePaymentMethod?.availableBalance != null) {
    const attentionId = `payment-${selectedPeriod?.id ?? 'none'}-${negativePaymentMethod.id}`;
    attentionItems.push({
      key: attentionId,
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
      onDismiss: () => dismissAttention(attentionId),
    });
  }
  const visibleAttentionItems = dismissedAttentionIds == null
    ? []
    : attentionItems.filter((item) => !dismissedAttentionIds.includes(item.key));
  const visiblePaymentMethods = visibleHomePaymentMethods(paymentMethods);
  const walletTotal = sumKnownAvailableBalances(getHomePaymentMethods(visiblePaymentMethods, 'wallet'));
  const visibleCreditMethods = getHomePaymentMethods(visiblePaymentMethods, 'credit');
  const availableCreditTotal = sumKnownAvailableBalances(visibleCreditMethods);
  const creditLimitTotal = visibleCreditMethods.reduce((sum, method) => sum + (method.creditLimit ?? 0), 0);
  const hasUsdCredit = visibleCreditMethods.some((method) => method.usdCreditLimitCents != null);
  const usdAvailableCreditTotalCents = visibleCreditMethods.reduce(
    (sum, method) => sum + (method.usdAvailableCreditCents ?? 0),
    0
  );
  const usdCreditLimitTotalCents = visibleCreditMethods.reduce(
    (sum, method) => sum + (method.usdCreditLimitCents ?? 0),
    0
  );
  const billedCreditTotal = visiblePaymentMethods
    .filter((method) => method.type === 'credit')
    .reduce((sum, method) => sum + method.billedAmount, 0);
  const savingsTotal = savingsGoals
    .filter((goal) => goal.showOnHome !== false)
    .reduce((sum, goal) => sum + goal.currentAmount, 0);
  const payableDebtTotal = visibleHomeDebts(homeDebts)
    .filter((debt) => debt.status === 'active' && debt.direction === 'payable')
    .reduce((sum, debt) => sum + debt.currentBalance, 0)
    + getHomePaymentMethods(visiblePaymentMethods, 'credit')
      .reduce((sum, method) => sum + getCreditCardDebtAmount(method), 0);

  const explain = (
    title: string,
    description: Parameters<typeof t>[0],
    lines: FinancialExplanationLine[],
    total: string
  ) => setFinancialExplanation({
    title,
    description: t(description),
    lines: lines.filter((line) => line.value !== formatCLP(0) && line.value !== formatMoney(0, 'USD')),
    totalLabel: t('financialExplanation.total'),
    total,
  });
  const showPeriodMetricExplanation = (metric: HomePeriodMetricId) => {
    if (metric === 'available') {
      explain(t('home.periodMetricAvailable'), 'financialExplanation.descriptions.periodAvailable', [
        { label: t('home.periodMetricIncome'), value: formatCLP(periodIncomesTotal) },
        { label: t('financialExplanation.labels.savingsWithdrawals'), value: formatCLP(periodSavingsWithdrawals) },
        { label: t('financialExplanation.labels.savingsFundedExpenses'), value: formatCLP(periodSavingsFundingTotal) },
        { label: t('home.periodMetricExpenses'), value: formatCLP(periodOverviewExpensesTotal), operator: '−' },
        { label: t('financialExplanation.labels.cardPayments'), value: formatCLP(selectedPeriodReport?.cardPaymentsFromAccountsTotal ?? 0), operator: '−' },
        { label: t('financialExplanation.labels.cardAdjustments'), value: formatCLP(selectedPeriodReport?.cardInternalAdjustmentsTotal ?? 0) },
      ], formatCLP(periodOverviewBalance));
      return;
    }
    if (metric === 'income') {
      explain(t('home.periodMetricIncome'), 'financialExplanation.descriptions.periodIncome', incomes
        .filter((income) => income.savingsGoalId == null)
        .map((income) => ({ label: income.name, value: formatCLP(income.amount) })), formatCLP(periodIncomesTotal));
      return;
    }
    if (metric === 'expenses') {
      explain(t('home.periodMetricExpenses'), 'financialExplanation.descriptions.periodExpenses', expenses
        .filter((expense) => expense.currency !== 'USD'
          && (expense.paymentMethodType === 'cash' || expense.paymentMethodType === 'debit' || expense.paymentMethodType === 'prepaid'))
        .map((expense) => ({ label: expense.name, value: formatCLP(expense.amount) })), formatCLP(periodOverviewExpensesTotal));
      return;
    }
    explain(t('home.periodMetricUnbilledCredit'), 'financialExplanation.descriptions.unbilledCredit', [
      { label: t('home.periodMetricUnbilledCredit'), value: formatCLP(unbilledCreditCardTotal) },
    ], formatCLP(unbilledCreditCardTotal));
  };
  const showGlobalMetricExplanation = (metric: HomeGlobalMetricId) => {
    if (metric === 'wallet') {
      explain(t('home.globalMetricWallet'), 'financialExplanation.descriptions.wallet', getHomePaymentMethods(visiblePaymentMethods, 'wallet')
        .filter((method) => method.availableBalance != null)
        .map((method) => ({ label: method.name, value: formatCLP(method.availableBalance ?? 0) })), formatCLP(walletTotal));
      return;
    }
    if (metric === 'credit') {
      const clpLines = visibleCreditMethods
        .filter((method) => method.availableBalance != null)
        .map((method) => ({ label: `${method.name} · CLP`, value: formatCLP(method.availableBalance ?? 0) }));
      const usdLines = visibleCreditMethods
        .filter((method) => method.usdCreditLimitCents != null)
        .map((method) => ({ label: `${method.name} · USD`, value: formatMoney(method.usdAvailableCreditCents ?? 0, 'USD') }));
      explain(t('home.globalMetricCredit'), 'financialExplanation.descriptions.availableCredit', [...clpLines, ...usdLines],
        hasUsdCredit ? `CLP ${formatCLP(availableCreditTotal)} · USD ${formatMoney(usdAvailableCreditTotalCents, 'USD')}` : formatCLP(availableCreditTotal));
      return;
    }
    if (metric === 'billedCredit') {
      explain(t('home.globalMetricBilledCredit'), 'financialExplanation.descriptions.billedCredit', visibleCreditMethods
        .map((method) => ({ label: method.name, value: formatCLP(method.billedAmount) })), formatCLP(billedCreditTotal));
      return;
    }
    if (metric === 'savings') {
      explain(t('home.globalMetricSavings'), 'financialExplanation.descriptions.totalSavings', savingsGoals
        .filter((goal) => goal.showOnHome !== false)
        .map((goal) => ({ label: goal.name, value: formatCLP(goal.currentAmount) })), formatCLP(savingsTotal));
      return;
    }
    const debtLines = visibleHomeDebts(homeDebts)
      .filter((debt) => debt.status === 'active' && debt.direction === 'payable')
      .map((debt) => ({ label: debt.name, value: formatCLP(debt.currentBalance) }));
    const cardDebtLines = visibleCreditMethods
      .map((method) => ({ label: method.name, value: formatCLP(getCreditCardDebtAmount(method)) }));
    explain(t('home.globalMetricDebt'), 'financialExplanation.descriptions.totalDebt', [...debtLines, ...cardDebtLines], formatCLP(payableDebtTotal));
  };
  const showPaymentMethodExplanation = (method: PaymentMethod) => explain(
    method.name,
    'financialExplanation.descriptions.paymentMethodBalance',
    [
      { label: t('financialExplanation.labels.reportedBalance'), value: formatCLP(method.reportedBalance ?? 0) },
      { label: t('financialExplanation.labels.charges'), value: formatCLP(method.registeredCharges), operator: '−' },
      { label: t('financialExplanation.labels.installments'), value: formatCLP(method.installmentCommitments), operator: '−' },
      { label: t('financialExplanation.labels.payments'), value: formatCLP(method.registeredPayments) },
      { label: t('financialExplanation.labels.incomes'), value: formatCLP(method.registeredIncomes) },
      { label: t('financialExplanation.labels.transfersIn'), value: formatCLP(method.registeredTransfersIn) },
      { label: t('financialExplanation.labels.transfersOut'), value: formatCLP(method.registeredTransfersOut), operator: '−' },
      { label: t('financialExplanation.labels.adjustments'), value: formatCLP(method.registeredAdjustments) },
    ],
    method.availableBalance == null ? '—' : formatCLP(method.availableBalance)
  );
  const showGoalExplanation = (item: SavingsGoalPeriodActivity) => explain(
    item.goalName,
    'financialExplanation.descriptions.goalBalance',
    [
      { label: t('financialExplanation.labels.openingSavings'), value: formatCLP(item.openingAmount) },
      { label: t('financialExplanation.labels.contributions'), value: formatCLP(item.contributions) },
      { label: t('financialExplanation.labels.withdrawals'), value: formatCLP(item.withdrawals), operator: '−' },
      { label: t('financialExplanation.labels.fundedExpenses'), value: formatCLP(item.fundedExpenses), operator: '−' },
      { label: t('financialExplanation.labels.adjustments'), value: formatCLP(item.adjustments) },
    ],
    formatCLP(item.closingAmount)
  );

  const renderHomeSection = (section: HomeSectionId) => {
    if (section === 'search') {
      return (
        <Pressable
          key={section}
          accessibilityRole="button"
          onPress={() => router.push('/modal/global-search' as never)}
          style={[styles.globalSearch, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="home-global-search">
          <Ionicons name="search-outline" size={20} color={colors.icon} />
          <ThemedText
            ellipsizeMode="tail"
            numberOfLines={1}
            style={[styles.globalSearchText, { color: colors.textSecondary }]}>
            {t('globalSearch.placeholder')}
          </ThemedText>
        </Pressable>
      );
    }
    if (section === 'attention') {
      return isCurrentPeriod && dismissedAttentionIds != null ? (
        <HomeAttentionSection
          key={section}
          items={visibleAttentionItems}
          notificationCount={unreadAppNotifications.length}
          onOpenNotifications={() => router.push('/modal/recurring-confirmations')}
          onUndoDismiss={lastDismissedAttentionId ? undoDismissAttention : undefined}
        />
      ) : null;
    }
    if (section === 'weekly') {
      return isCurrentPeriod
        ? <WeeklyInsightCard
            key={section}
            insight={weeklyInsight}
            savingsMilestone={savingsMilestone}
            onExplain={() => explain(t('home.weeklyTitle'), 'financialExplanation.descriptions.weekly', [
              { label: t('financialExplanation.labels.previousWeek'), value: formatCLP(weeklyInsight.previousExpenseTotal) },
              { label: t('financialExplanation.labels.currentWeek'), value: formatCLP(weeklyInsight.expenseTotal) },
            ], formatCLP(weeklyInsight.expenseTotal - weeklyInsight.previousExpenseTotal))}
          />
        : null;
    }
    if (section === 'wallet' || section === 'credit') {
      return (
        <HomePaymentBalancesCard
          key={section}
          kind={section}
          paymentMethods={paymentMethods}
          backgroundColor={colors.surface}
          onManage={() => section === 'credit'
            ? router.push({
                pathname: '/modal/payment-methods',
                params: { section: 'credit' },
              })
            : router.push('/modal/payment-methods')}
          onOpenPaymentMethod={(id) => router.push({
            pathname: '/modal/payment-method-detail',
            params: { id: String(id) },
          })}
          onExplainPaymentMethod={showPaymentMethodExplanation}
        />
      );
    }
    if (section === 'savings') {
      return selectedPeriod ? (
        <View key={section} style={styles.configurableSection}>
          {periodSavingsAvailable > 0 && (
            <ThemedText style={styles.savingsBalanceNote}>
              {t('savings.releasedInBalance', { amount: formatCLP(periodSavingsAvailable) })}
            </ThemedText>
          )}
          <SavingsGoalsPeriodCard
            items={periodSavingsGoalActivity}
            goals={savingsGoals}
            groups={savingsGroups}
            backgroundColor={colors.surface}
            asOfDate={selectedPeriod.endDate}
            onManage={() => router.push('/modal/savings-goals')}
            onOpenGoal={(id) => router.push({
              pathname: '/modal/savings-goal-detail' as never,
              params: { id: String(id) },
            })}
            onExplainGoal={showGoalExplanation}
          />
        </View>
      ) : null;
    }
    if (section === 'debts') {
      return (
        <HomeDebtsCard
          key={section}
          debts={homeDebts}
          plans={homeDebtPlans}
          paymentMethods={paymentMethods}
          backgroundColor={colors.surface}
          onManage={() => router.push('/modal/debts')}
          onOpenDebt={(id) => router.push({ pathname: '/modal/manual-debt-detail', params: { id: String(id) } })}
          onOpenPlan={(id) => router.push({ pathname: '/modal/debt-detail', params: { id: String(id) } })}
          onOpenPaymentMethod={(id) => router.push({ pathname: '/modal/payment-method-detail', params: { id: String(id) } })}
        />
      );
    }
    return (
      <BreakdownSection
        key={section}
        collapsible
        mode={breakdownMode}
        onChange={setBreakdownMode}
        onExplain={() => explain(t('breakdown.title'), 'financialExplanation.descriptions.chart', (breakdownMode === 'category'
          ? periodCategoryExpensesTotals.map((item) => ({ label: item.categoryName, value: formatCLP(item.total) }))
          : paymentMethodTotals.map((item) => ({ label: item.paymentMethodName, value: formatCLP(item.total) }))), formatCLP(periodExpensesTotal))}
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
                      onExplain={() => explain(item.categoryName, 'financialExplanation.descriptions.budget', [
                        { label: t('financialExplanation.labels.budgetLimit'), value: formatCLP(item.periodLimit ?? 0) },
                        { label: t('financialExplanation.labels.budgetSpent'), value: formatCLP(item.total), operator: '−' },
                      ], formatCLP((item.periodLimit ?? 0) - item.total))}
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
    );
  };

  async function saveStartDate(selected: Date) {
    const selectedDateStr = toDateString(selected);
    if (selected > endDate) {
      Alert.alert(t('common.error'), t('period.invalidStart'));
      return;
    }
    try {
      const changed = selectedDateStr !== toDateString(startDate);
      if (changed) {
        await setPeriodStartDate(selectedDateStr);
        setStartDate(selected);
        showToast(t('period.startDateUpdated'));
      }
      setHasConfiguredPeriod(await confirmFirstPeriodDate('start'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('period.updateStartError'));
    }
  }

  async function saveEndDate(selected: Date) {
    const selectedDateStr = toDateString(selected);
    if (selected < startDate) {
      Alert.alert(t('common.error'), t('period.invalidEnd'));
      return;
    }
    try {
      const changed = selectedDateStr !== toDateString(endDate);
      if (changed) {
        await setPeriodEndDate(selectedDateStr);
        setEndDate(selected);
        showToast(t('period.endDateUpdated'));
      }
      setHasConfiguredPeriod(await confirmFirstPeriodDate('end'));
    } catch (error) {
      Alert.alert(t('common.error'), error instanceof Error ? error.message : t('period.updateEndError'));
    }
  }

  function openPeriodDateEditor() {
    if (!isCurrentPeriod) return;
    const actions = [];
    if (selectedPeriod?.id === 1) {
      actions.push({
        text: t('period.start'),
        onPress: () => {
          setStartDateDraft(startDate);
          setShowStartDatePicker(true);
        },
      });
    }
    actions.push(
      {
        text: t('period.end'),
        onPress: () => {
          setEndDateDraft(endDate);
          setShowEndDatePicker(true);
        },
      },
      { text: t('common.cancel'), style: 'cancel' as const }
    );
    Alert.alert(t('home.periodDetails'), t('period.editDatesHint'), actions);
  }

  function confirmClosePeriod() {
    let nextStartLabel = '';
    let nextEndLabel = '';
    const currentEnd = settings.currentPeriod?.endDate
      ? parseDateString(settings.currentPeriod.endDate)
      : null;
    if (currentEnd) {
      const nextStart = new Date(currentEnd);
      nextStart.setDate(nextStart.getDate() + 1);
      const nextEnd = new Date(nextStart);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      nextStartLabel = formatDate(nextStart);
      nextEndLabel = formatDate(nextEnd);
    }

    Alert.alert(
      t('period.finishTitle'),
      t('period.finishMessage', {
        start: nextStartLabel,
        end: nextEndLabel,
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
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('period.finishAction'),
          style: 'destructive',
          onPress: async () => {
            try {
              const nextPeriod = await closeCurrentPeriod();
              showToast(t('period.finished'));
              router.push({
                pathname: '/modal/period-opening-balances',
                params: { start: nextPeriod.startDate, end: nextPeriod.endDate },
              });
            } catch {
              Alert.alert(t('period.finishErrorTitle'), t('period.finishError'));
            }
          },
        },
      ],
      { cancelable: true }
    );
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
    let active = true;
    if (periodHistory.length > 1) {
      setHasConfiguredPeriod(true);
      void markFirstPeriodConfigured();
    } else {
      void hasConfiguredFirstPeriod().then((configured) => {
        if (active) setHasConfiguredPeriod(configured);
      });
    }
    return () => { active = false; };
  }, [periodHistory.length]);

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
        {!settings.homePreferences.hiddenSections.includes('search') && renderHomeSection('search')}
        <PeriodSelector
          actions={isCurrentPeriod ? [
            { label: t('period.editDates'), icon: 'calendar-outline', onPress: openPeriodDateEditor },
            ...(hasPeriodMovements ? [{
              label: t('period.close'),
              icon: 'lock-closed-outline' as const,
              destructive: true,
              onPress: confirmClosePeriod,
            }] : []),
          ] : undefined}
        />
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

        <HomeSummaryCards
          periodMetrics={settings.homePreferences.periodMetrics}
          globalMetrics={settings.homePreferences.globalMetrics}
          periodValues={{
            available: periodOverviewBalance,
            income: periodIncomesTotal,
            expenses: periodOverviewExpensesTotal,
            unbilledCredit: unbilledCreditCardTotal,
          }}
          globalValues={{
            wallet: walletTotal,
            credit: availableCreditTotal,
            billedCredit: billedCreditTotal,
            savings: savingsTotal,
            debt: payableDebtTotal,
          }}
          creditTotals={{
            limitClp: creditLimitTotal,
            availableUsdCents: usdAvailableCreditTotalCents,
            limitUsdCents: usdCreditLimitTotalCents,
            hasUsd: hasUsdCredit,
          }}
          onExplainPeriodMetric={showPeriodMetricExplanation}
          onExplainGlobalMetric={showGlobalMetricExplanation}
        />
        {isCurrentPeriod && (
          <ProgressiveSetup
            hasConfiguredPeriod={hasConfiguredPeriod}
            hasAdditionalPaymentMethod={paymentMethods.some((method) => method.systemKey !== 'cash')}
            hasAdditionalCategory={hasUserCreatedCategory(categories)}
            hasSavingsGoal={savingsGoals.length > 0}
            hasMovements={hasPeriodMovements}
            onOpenPeriod={openPeriodDateEditor}
            onOpenPaymentMethods={() => router.push('/modal/payment-methods')}
            onOpenCategories={() => router.push('/modal/categories')}
            onOpenSavings={() => router.push('/modal/savings-goals')}
            onAddMovement={() => router.push('/modal/expense-form')}
            onOpenBackup={() => router.push('/modal/google-drive')}
          />
        )}
        {settings.homePreferences.sectionOrder
          .filter((section) => section !== 'search'
            && !settings.homePreferences.hiddenSections.includes(section))
          .map(renderHomeSection)}

        <FinancialExplanationModal
          explanation={financialExplanation}
          onClose={() => setFinancialExplanation(null)}
        />

      {selectedPeriodReport && hasPeriodMovements && (
        <View style={styles.exportSection}>
          <View style={styles.exportCopy}>
            <ThemedText type="subtitle">{t('historicalPeriod.exportTitle')}</ThemedText>
            <ThemedText style={[styles.exportHint, { color: colors.textSecondary }]}>
              {t('historicalPeriod.exportHint')}
            </ThemedText>
          </View>
          <View style={styles.exportActions}>
            <Pressable
              accessibilityLabel={t('historicalPeriod.exportPdf')}
              accessibilityRole="button"
              accessibilityState={{ busy: isExporting, disabled: isExporting }}
              style={({ pressed }) => [
                styles.exportIconButton,
                styles.pdfExportButton,
                (pressed || isExporting) && styles.buttonPressed,
              ]}
              disabled={isExporting}
              onPress={handleExport}>
              {isExporting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="document-text-outline" size={22} color="#FFFFFF" />
              )}
            </Pressable>
            <Pressable
              accessibilityLabel={t('historicalPeriod.exportCsv')}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.exportIconButton,
                styles.csvExportButton,
                pressed && styles.buttonPressed,
              ]}
              onPress={() => router.push({
                pathname: '/modal/period-csv-export' as never,
                params: { periodId: String(selectedPeriodReport.periodId) },
              })}>
              <Ionicons name="grid-outline" size={21} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      </ScrollView>
      {isPeriodChanging && (
        <View
          accessibilityLabel={t('period.loading')}
          accessibilityRole="progressbar"
          style={[styles.loadingOverlay, { backgroundColor: `${colors.screen}F2` }]}>
          {periodRefreshFailed ? (
            <View style={styles.loadingErrorContent}>
              <ThemedText type="subtitle" style={styles.loadingErrorText}>
                {t('period.loadFailed')}
              </ThemedText>
              <ThemedText style={styles.loadingErrorText}>
                {t('period.loadFailedHint')}
              </ThemedText>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refresh().catch(() => undefined)}
                style={[styles.retryButton, { backgroundColor: colors.primary }]}
              >
                <ThemedText type="defaultSemiBold" style={styles.retryButtonText}>
                  {t('common.retry')}
                </ThemedText>
              </Pressable>
            </View>
          ) : (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <ThemedText type="defaultSemiBold">{t('period.loading')}</ThemedText>
            </>
          )}
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
  loadingErrorContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingErrorText: {
    textAlign: 'center',
  },
  retryButton: {
    minWidth: 150,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingHorizontal: 24,
  },
  retryButtonText: {
    color: '#fff',
  },
  scroll: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  globalSearch: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  globalSearchText: { flex: 1 },
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
  doneDate: {
    alignSelf: 'flex-end',
  },
  savingsBalanceNote: {
    fontSize: 12,
    textAlign: 'center',
    opacity: 0.7,
  },
  configurableSection: { gap: 8 },
  exportIconButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfExportButton: { backgroundColor: '#C93F4B' },
  csvExportButton: { backgroundColor: '#168A5B' },
  exportActions: { flexDirection: 'row', gap: 10 },
  exportSection: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  exportCopy: { flex: 1, gap: 3 },
  exportHint: { fontSize: 13, lineHeight: 18 },
  buttonPressed: {
    opacity: 0.72,
  },
});
