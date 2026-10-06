import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import * as db from '@/repositories';
import { attachDiagnosticMetadata, logAppError } from '@/lib/logger';
import { AppLoadingScreen } from '@/components/app-loading-screen';
import { DatabaseInitializationError } from '@/components/database-initialization-error';
import { DatabaseDomainProviders } from '@/contexts/DatabaseDomainContexts';
import { useDebtActions } from '@/contexts/database/useDebtActions';
import { useMovementActions } from '@/contexts/database/useMovementActions';
import { useOrganizerActions } from '@/contexts/database/useOrganizerActions';
import { usePaymentActions } from '@/contexts/database/usePaymentActions';
import { usePeriodActions } from '@/contexts/database/usePeriodActions';
import { usePreferenceActions } from '@/contexts/database/usePreferenceActions';
import { useRecurrenceActions } from '@/contexts/database/useRecurrenceActions';
import { useSavingsActions } from '@/contexts/database/useSavingsActions';
import type {
  AccountTransfer,
  AppNotification,
  CardPaymentMovement,
  Category,
  Contact,
  CreditCardAdjustment,
  CreditCardCycle,
  DebtPlan,
  ExpenseWithCategory,
  Income,
  IncomeCategory,
  Debt,
  NewCategory,
  NewContact,
  NewCreditCardAdjustment,
  NewAccountTransfer,
  NewExpense,
  NewIncome,
  NewIncomeCategory,
  NewInstallmentPurchase,
  NewDebt,
  NewDebtBalance,
  NewDebtPayment,
  NewDebtPaymentBatch,
  NewCreditCardCycle,
  NewPaymentMethod,
  NewPaymentMethodBalance,
  PaymentMethodBalanceUpdate,
  NewRecurringExpense,
  NewRecurringIncome,
  NewRecurringSchedule,
  NewRelationshipType,
  MovementReminderSettings,
  PaymentMethod,
  PaymentMethodDeletionInfo,
  PaymentMethodTotal,
  Period,
  PeriodCategoryExpensesTotals,
  PeriodHistory,
  ReconcileCreditCardCycle,
  RecurringDecisionItem,
  RecurringExpense,
  RecurringIncome,
  RecurringMovementKind,
  RelationshipType,
  NewSavingsGoal,
  NewSavingsGroup,
  NewSavingsGoalBalance,
  SavingsGoal,
  SavingsGroup,
  SavingsGoalMovement,
  SavingsGoalPeriodActivity,
  SavingsGoalStatus,
  Settings,
} from '@/lib/types';
import { addIsoDays, toIsoDate } from '@/lib/recurrence';
import { DEFAULT_HOME_PREFERENCES } from '@/lib/home-preferences';
import type { HomePreferences } from '@/lib/home-preferences';
import {
  notifyGeneratedRecurringExpenses,
  syncRecurringNotifications,
  upsertRecurringDecisionNotifications,
} from '@/services/RecurringNotificationService';
import { syncMovementReminder } from '@/services/MovementReminderService';
import { syncFinancialReminders } from '@/services/FinancialReminderService';
import {
  cancelFinniNotifications,
} from '@/services/NotificationPreferencesService';

export type DatabaseContextValue = {
  categories: Category[];
  contacts: Contact[];
  relationshipTypes: RelationshipType[];
  incomeCategories: IncomeCategory[];
  savingsGroups: SavingsGroup[];
  paymentMethods: PaymentMethod[];
  paymentMethodTotals: PaymentMethodTotal[];
  cardPaymentMovements: CardPaymentMovement[];
  accountTransfers: AccountTransfer[];
  appNotifications: AppNotification[];
  recurringExpenses: RecurringExpense[];
  recurringDecisions: RecurringDecisionItem[];
  recurringIncomes: RecurringIncome[];
  savingsGoals: SavingsGoal[];
  periodSavingsGoalActivity: SavingsGoalPeriodActivity[];
  periodSavingsFundingTotal: number;
  expenses: ExpenseWithCategory[];
  incomes: Income[];
  expenseNames: string[];
  incomeNames: string[];
  settings: Settings;
  periods: Period[];
  selectedPeriod: Period | null;
  selectedPeriodId: number | null;
  periodCategoryExpensesTotals: PeriodCategoryExpensesTotals[];
  periodIncomesTotal: number;
  periodHistory: PeriodHistory[];
  periodExpensesTotal: number;
  unbilledCreditCardTotal: number;
  isReady: boolean;
  isPeriodChanging: boolean;
  periodRefreshFailed: boolean;
  refresh: () => Promise<void>;
  runDatabaseMaintenance: (operation: () => Promise<void>) => Promise<void>;
  selectPeriod: (periodId: number) => void;
  closeCurrentPeriod: () => Promise<Period>;
  addCategory: (data: NewCategory) => Promise<void>;
  editCategory: (id: number, data: NewCategory) => Promise<void>;
  getCategoryExpenseCount: (id: number) => Promise<number>;
  removeCategory: (id: number, detachExpenses?: boolean) => Promise<void>;
  saveContact: (data: NewContact, id?: number) => Promise<number>;
  removeContact: (id: number) => Promise<void>;
  getContact: (id: number) => Promise<Contact | null>;
  saveRelationshipType: (data: NewRelationshipType, id?: number) => Promise<void>;
  removeRelationshipType: (id: number) => Promise<void>;
  saveIncomeCategory: (data: NewIncomeCategory, id?: number) => Promise<void>;
  removeIncomeCategory: (id: number) => Promise<void>;
  saveSavingsGroup: (data: NewSavingsGroup, id?: number) => Promise<void>;
  removeSavingsGroup: (id: number) => Promise<void>;
  addPaymentMethod: (data: NewPaymentMethod) => Promise<void>;
  editPaymentMethod: (id: number, data: NewPaymentMethod) => Promise<void>;
  updatePaymentMethodBalance: (id: number, data: NewPaymentMethodBalance) => Promise<void>;
  updatePaymentMethodBalances: (updates: PaymentMethodBalanceUpdate[]) => Promise<void>;
  setPaymentMethodActive: (id: number, active: boolean) => Promise<void>;
  setDefaultPaymentMethod: (id: number | null) => Promise<void>;
  getPaymentMethodDeletionInfo: (id: number) => Promise<PaymentMethodDeletionInfo>;
  removePaymentMethod: (id: number) => Promise<void>;
  getCreditCardAdjustment: (id: number) => Promise<CreditCardAdjustment | null>;
  addCreditCardAdjustment: (data: NewCreditCardAdjustment) => Promise<number>;
  editCreditCardAdjustment: (id: number, data: NewCreditCardAdjustment) => Promise<void>;
  removeCreditCardAdjustment: (id: number) => Promise<void>;
  getAccountTransfer: (id: number) => Promise<AccountTransfer | null>;
  addAccountTransfer: (data: NewAccountTransfer) => Promise<number>;
  editAccountTransfer: (id: number, data: NewAccountTransfer) => Promise<void>;
  removeAccountTransfer: (id: number) => Promise<void>;
  getCreditCardCycles: (paymentMethodId: number) => Promise<CreditCardCycle[]>;
  addCreditCardCycle: (data: NewCreditCardCycle) => Promise<void>;
  editCreditCardCycle: (id: number, statementAmount: number | null, status: CreditCardCycle['status']) => Promise<void>;
  reconcileCreditCardCycle: (id: number, data: ReconcileCreditCardCycle) => Promise<void>;
  unreconcileCreditCardCycle: (id: number) => Promise<void>;
  getDebtPlans: (paymentMethodId?: number) => Promise<DebtPlan[]>;
  getDebtPlan: (id: number) => Promise<DebtPlan | null>;
  addInstallmentPurchase: (data: NewInstallmentPurchase) => Promise<number>;
  activateInstallmentPlan: (id: number, periodId: number, actualAmount: number) => Promise<void>;
  settleInstallmentPlan: (id: number, periodId: number) => Promise<void>;
  setDebtPlanShowOnHome: (id: number, showOnHome: boolean) => Promise<void>;
  restoreRemovedInstallment: (installmentId: number, periodId: number) => Promise<void>;
  removeInstallmentPlan: (id: number) => Promise<void>;
  getDebts: () => Promise<Debt[]>;
  getDebt: (id: number) => Promise<Debt | null>;
  addDebt: (data: NewDebt) => Promise<number>;
  editDebt: (id: number, data: NewDebt) => Promise<void>;
  addDebtPayment: (debtId: number, data: NewDebtPayment) => Promise<void>;
  addDebtPayments: (data: NewDebtPaymentBatch) => Promise<void>;
  editDebtPayment: (entryId: number, data: NewDebtPayment) => Promise<void>;
  removeDebtPayment: (entryId: number) => Promise<void>;
  addDebtBalanceAdjustment: (debtId: number, data: NewDebtBalance) => Promise<void>;
  removeDebtBalanceAdjustment: (debtId: number, entryId: number) => Promise<void>;
  setDebtArchived: (id: number, archived: boolean) => Promise<void>;
  removeDebt: (id: number) => Promise<void>;
  addSavingsGoal: (data: NewSavingsGoal) => Promise<void>;
  editSavingsGoal: (id: number, data: NewSavingsGoal) => Promise<void>;
  addSavingsGoalBalanceAdjustment: (id: number, data: NewSavingsGoalBalance) => Promise<void>;
  removeSavingsGoalBalanceAdjustment: (goalId: number, adjustmentId: number) => Promise<void>;
  setSavingsGoalStatus: (id: number, status: SavingsGoalStatus) => Promise<void>;
  removeSavingsGoal: (id: number) => Promise<void>;
  getSavingsGoalMovements: (id: number) => Promise<SavingsGoalMovement[]>;
  addRecurringExpense: (data: NewRecurringExpense) => Promise<void>;
  editRecurringExpense: (id: number, data: NewRecurringExpense) => Promise<void>;
  setRecurringExpenseActive: (id: number, active: boolean) => Promise<void>;
  removeRecurringExpense: (id: number) => Promise<void>;
  editRecurringIncome: (id: number, data: NewRecurringIncome) => Promise<void>;
  addRecurringIncome: (data: NewRecurringIncome) => Promise<void>;
  setRecurringIncomeActive: (id: number, active: boolean) => Promise<void>;
  removeRecurringIncome: (id: number) => Promise<void>;
  addRecurringIncomeFromSource: (sourceIncomeId: number, schedule: NewRecurringSchedule) => Promise<void>;
  approveRecurringOccurrence: (kind: RecurringMovementKind, recurringId: number, scheduledDate: string) => Promise<void>;
  skipRecurringOccurrence: (kind: RecurringMovementKind, recurringId: number, scheduledDate: string) => Promise<void>;
  dismissSkippedOccurrence: (kind: RecurringMovementKind, recurringId: number, scheduledDate: string) => Promise<void>;
  markRecurringOccurrencePending: (kind: RecurringMovementKind, recurringId: number, scheduledDate: string) => Promise<void>;
  retryRecurringOccurrence: (kind: RecurringMovementKind, recurringId: number, scheduledDate: string) => Promise<void>;
  setAppNotificationRead: (id: number, read: boolean) => Promise<void>;
  markAppNotificationReadBySourceKey: (sourceKey: string) => Promise<void>;
  deleteAppNotification: (id: number) => Promise<void>;
  deleteAppNotifications: (ids: number[]) => Promise<void>;
  addExpense: (data: NewExpense, recurringSchedule?: NewRecurringSchedule) => Promise<void>;
  editExpense: (id: number, data: NewExpense) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addIncome: (data: NewIncome, recurringSchedule?: NewRecurringSchedule) => Promise<void>;
  editIncome: (id: number, data: NewIncome) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  setPeriodStartDate: (date: string) => Promise<void>;
  setPeriodEndDate: (date: string) => Promise<void>;
  setPeriodDates: (startDate: string, endDate: string) => Promise<void>;
  setPushNotificationsEnabled: (enabled: boolean) => Promise<void>;
  setMovementReminder: (data: MovementReminderSettings) => Promise<void>;
  setHomePreferences: (data: HomePreferences) => Promise<void>;
  resetLocalData: () => Promise<void>;
};

async function refreshStep<T>(code: string, operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    throw attachDiagnosticMetadata(error, { stage: 'refresh', code });
  }
}

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    id: 1,
    currentPeriodId: null,
    defaultPaymentMethodId: null,
    pushNotificationsEnabled: false,
    movementReminderEnabled: false,
    movementReminderFrequency: 'daily',
    movementReminderWeekday: 1,
    movementReminderHour: 21,
    movementReminderMinute: 0,
    homePreferences: DEFAULT_HOME_PREFERENCES,
    currentPeriod: null,
  });
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [loadedPeriodId, setLoadedPeriodId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [initializationFailed, setInitializationFailed] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [periodRefreshFailed, setPeriodRefreshFailed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>([]);
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([]);
  const [savingsGroups, setSavingsGroups] = useState<SavingsGroup[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodTotals, setPaymentMethodTotals] = useState<PaymentMethodTotal[]>([]);
  const [cardPaymentMovements, setCardPaymentMovements] = useState<CardPaymentMovement[]>([]);
  const [accountTransfers, setAccountTransfers] = useState<AccountTransfer[]>([]);
  const [appNotifications, setAppNotifications] = useState<AppNotification[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [recurringDecisions, setRecurringDecisions] = useState<RecurringDecisionItem[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [periodSavingsGoalActivity, setPeriodSavingsGoalActivity] = useState<SavingsGoalPeriodActivity[]>([]);
  const [periodSavingsFundingTotal, setPeriodSavingsFundingTotal] = useState(0);
  const [unbilledCreditCardTotal, setUnbilledCreditCardTotal] = useState(0);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenseNames, setExpenseNames] = useState<string[]>([]);
  const [incomeNames, setIncomeNames] = useState<string[]>([]);
  const [periodCategoryExpensesTotals, setPeriodCategoryExpensesTotals] = useState<PeriodCategoryExpensesTotals[]>([]);
  const [periodIncomesTotal, setPeriodIncomesTotal] = useState<number>(0);
  const [periodHistory, setPeriodHistory] = useState<PeriodHistory[]>([]);
  const selectedPeriodIdRef = useRef<number | null>(selectedPeriodId);
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const refreshRequestedRef = useRef(false);
  const maintenanceGateRef = useRef<Promise<void> | null>(null);
  const recurringSyncPromiseRef = useRef<Promise<void> | null>(null);
  const skipNextSelectedPeriodRefreshRef = useRef(false);
  const hasRefreshedRef = useRef(hasRefreshed);

  selectedPeriodIdRef.current = selectedPeriodId;
  hasRefreshedRef.current = hasRefreshed;

  const periodExpensesTotal = useMemo(
    () => periodCategoryExpensesTotals.reduce((sum, item) => sum + item.total, 0),
    [periodCategoryExpensesTotals]
  );
  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId]
  );
  const isPeriodChanging = selectedPeriodId != null && loadedPeriodId !== selectedPeriodId;
  const recurringNotificationKey = useMemo(
    () => JSON.stringify([...recurringExpenses, ...recurringIncomes].map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
      frequency: item.frequency,
      intervalMonths: item.intervalMonths,
      executionDay: item.executionDay,
      registrationMode: item.registrationMode,
      startDate: item.startDate,
      endDate: item.endDate,
      active: item.active,
      savingsGoalId: 'savingsGoalId' in item ? item.savingsGoalId : null,
      savingsKind: 'savingsKind' in item ? item.savingsKind : null,
      kind: 'categoryId' in item ? 'expense' : 'income',
    }))),
    [recurringExpenses, recurringIncomes]
  );

  const refresh = useCallback((): Promise<void> => {
    if (maintenanceGateRef.current) {
      return maintenanceGateRef.current.then(() => refresh());
    }
    if (refreshPromiseRef.current) {
      refreshRequestedRef.current = true;
      return refreshPromiseRef.current;
    }
    const runRefreshes = async () => {
      let canRetryInitialLoad = !hasRefreshedRef.current;

      while (true) {
        try {
          setPeriodRefreshFailed(false);
          do {
            refreshRequestedRef.current = false;

            const nextSettings = await refreshStep('REFRESH_SETTINGS', db.getSettings());
        if (nextSettings.pushNotificationsEnabled) {
          await syncMovementReminder(nextSettings, true, false).catch(() => undefined);
        } else {
          await cancelFinniNotifications().catch(() => undefined);
        }
        const generatedExpenses = await refreshStep(
          'REFRESH_RECURRING_EXPENSES',
          db.processDueRecurringExpenses()
        );
        await notifyGeneratedRecurringExpenses(
          generatedExpenses,
          nextSettings.pushNotificationsEnabled
        ).catch(() => undefined);
        await refreshStep('REFRESH_INSTALLMENTS', db.processProjectedInstallments());
        await refreshStep('REFRESH_RECURRING_INCOMES', db.processDueRecurringIncomes());
        await refreshStep(
          'REFRESH_RECONCILE_LATE_RECURRING',
          db.reconcileLateRecurringOccurrences()
        );
        const allPeriods = await refreshStep('REFRESH_PERIODS', db.getPeriods());
        setSettings(nextSettings);
        setPeriods(allPeriods);
        const currentSelectedPeriodId = selectedPeriodIdRef.current;
        const targetPeriodId =
          currentSelectedPeriodId != null
          && allPeriods.some((period) => period.id === currentSelectedPeriodId)
            ? currentSelectedPeriodId
            : nextSettings.currentPeriodId;
        if (targetPeriodId == null) {
          setHasRefreshed(true);
          continue;
        }
        if (targetPeriodId !== currentSelectedPeriodId) {
          selectedPeriodIdRef.current = targetPeriodId;
          skipNextSelectedPeriodRefreshRef.current = true;
          setSelectedPeriodId(targetPeriodId);
        }
        const [cats, contactRows, relationshipRows, incomeCats, groups, methods, methodTotals, cardPayments, transfers, recurring, decisions, recurringIncomeRows, goals, goalActivity, savingsFundingTotal, unbilledCreditTotal, exps, incs, allExpenseNames, allIncomeNames, totals, incomesTotal, history, debts, debtPlans] = await Promise.all([
          refreshStep('REFRESH_CATEGORIES', db.getCategories()),
          refreshStep('REFRESH_CONTACTS', db.getContacts()),
          refreshStep('REFRESH_RELATIONSHIPS', db.getRelationshipTypes()),
          refreshStep('REFRESH_INCOME_CATEGORIES', db.getIncomeCategories()),
          refreshStep('REFRESH_SAVINGS_GROUPS', db.getSavingsGroups()),
          refreshStep('REFRESH_PAYMENT_METHODS', db.getPaymentMethods(true)),
          refreshStep('REFRESH_PAYMENT_TOTALS', db.getPaymentMethodTotals(targetPeriodId)),
          refreshStep('REFRESH_CARD_PAYMENTS', db.getCardPaymentMovementsForPeriod(targetPeriodId)),
          refreshStep('REFRESH_TRANSFERS', db.getAccountTransfersForPeriod(targetPeriodId)),
          refreshStep('REFRESH_RECURRING_LIST', db.getRecurringExpenses()),
          refreshStep('REFRESH_RECURRING_DECISIONS', db.getRecurringDecisionItems()),
          refreshStep('REFRESH_RECURRING_INCOME_LIST', db.getRecurringIncomes()),
          refreshStep('REFRESH_SAVINGS_GOALS', db.getSavingsGoals(true)),
          refreshStep('REFRESH_SAVINGS_ACTIVITY', db.getPeriodSavingsGoalActivity(targetPeriodId)),
          refreshStep('REFRESH_SAVINGS_TOTAL', db.getPeriodSavingsFundingTotal(targetPeriodId)),
          refreshStep('REFRESH_UNBILLED_CREDIT_TOTAL', db.getUnbilledCreditCardTotal()),
          refreshStep('REFRESH_EXPENSES', db.getExpenses(targetPeriodId)),
          refreshStep('REFRESH_INCOMES', db.getIncomes(targetPeriodId)),
          refreshStep('REFRESH_EXPENSE_NAMES', db.getExpenseNames()),
          refreshStep('REFRESH_INCOME_NAMES', db.getIncomeNames()),
          refreshStep('REFRESH_CATEGORY_TOTALS', db.getPeriodCategoryExpensesTotals(targetPeriodId)),
          refreshStep('REFRESH_INCOME_TOTAL', db.getPeriodIncomesTotal(targetPeriodId)),
          refreshStep('REFRESH_HISTORY', db.getPeriodHistory()),
          refreshStep('REFRESH_DEBTS', db.getDebts()),
          refreshStep('REFRESH_DEBT_PLANS', db.getDebtPlans()),
        ]);
        await syncFinancialReminders({
          paymentMethods: methods,
          debts,
          debtPlans,
          currentPeriod: nextSettings.currentPeriod ?? null,
        }, nextSettings.pushNotificationsEnabled).catch(() => undefined);
        await upsertRecurringDecisionNotifications(decisions).catch(() => undefined);
        const notifications = await db.getAppNotifications();
        setCategories(cats);
        setContacts(contactRows);
        setRelationshipTypes(relationshipRows);
        setIncomeCategories(incomeCats);
        setSavingsGroups(groups);
        setPaymentMethods(methods);
        setPaymentMethodTotals(methodTotals);
        setCardPaymentMovements(cardPayments);
        setAccountTransfers(transfers);
        setAppNotifications(notifications);
        setRecurringExpenses(recurring);
        setRecurringDecisions(decisions);
        setRecurringIncomes(recurringIncomeRows);
        setSavingsGoals(goals);
        setPeriodSavingsGoalActivity(goalActivity);
        setPeriodSavingsFundingTotal(savingsFundingTotal);
        setUnbilledCreditCardTotal(unbilledCreditTotal);
        setExpenses(exps);
        setIncomes(incs);
        setExpenseNames(allExpenseNames);
        setIncomeNames(allIncomeNames);
        setPeriodCategoryExpensesTotals(totals);
        setPeriodIncomesTotal(incomesTotal);
        setPeriodHistory(history);
        setLoadedPeriodId(targetPeriodId);
            setHasRefreshed(true);
          } while (refreshRequestedRef.current);
          return;
        } catch (error) {
          if (canRetryInitialLoad) {
            canRetryInitialLoad = false;
            await new Promise((resolve) => setTimeout(resolve, 300));
            continue;
          }
          setPeriodRefreshFailed(true);
          throw error;
        }
      }
    };

    const refreshPromise = runRefreshes().finally(() => {
      if (refreshPromiseRef.current === refreshPromise) {
        refreshPromiseRef.current = null;
      }
    });
    refreshPromiseRef.current = refreshPromise;
    return refreshPromise;
  }, []);

  const runDatabaseMaintenance = useCallback(async (operation: () => Promise<void>) => {
    let releaseGate: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    maintenanceGateRef.current = gate;

    try {
      await refreshPromiseRef.current;
      await recurringSyncPromiseRef.current;
      await operation();
    } finally {
      maintenanceGateRef.current = null;
      releaseGate();
    }

    await refresh();
  }, [refresh]);

  const refreshFinancialDomain = useCallback(async () => {
    const targetPeriodId = selectedPeriodIdRef.current;
    if (targetPeriodId == null) return;
    const [methods, methodTotals, cardPayments, transfers, goals, goalActivity,
      savingsFundingTotal, unbilledCreditTotal, exps, incs, allExpenseNames,
      allIncomeNames, totals, incomesTotal, history, debts, debtPlans] = await Promise.all([
      refreshStep('REFRESH_PAYMENT_METHODS', db.getPaymentMethods(true)),
      refreshStep('REFRESH_PAYMENT_TOTALS', db.getPaymentMethodTotals(targetPeriodId)),
      refreshStep('REFRESH_CARD_PAYMENTS', db.getCardPaymentMovementsForPeriod(targetPeriodId)),
      refreshStep('REFRESH_TRANSFERS', db.getAccountTransfersForPeriod(targetPeriodId)),
      refreshStep('REFRESH_SAVINGS_GOALS', db.getSavingsGoals(true)),
      refreshStep('REFRESH_SAVINGS_ACTIVITY', db.getPeriodSavingsGoalActivity(targetPeriodId)),
      refreshStep('REFRESH_SAVINGS_TOTAL', db.getPeriodSavingsFundingTotal(targetPeriodId)),
      refreshStep('REFRESH_UNBILLED_CREDIT_TOTAL', db.getUnbilledCreditCardTotal()),
      refreshStep('REFRESH_EXPENSES', db.getExpenses(targetPeriodId)),
      refreshStep('REFRESH_INCOMES', db.getIncomes(targetPeriodId)),
      refreshStep('REFRESH_EXPENSE_NAMES', db.getExpenseNames()),
      refreshStep('REFRESH_INCOME_NAMES', db.getIncomeNames()),
      refreshStep('REFRESH_CATEGORY_TOTALS', db.getPeriodCategoryExpensesTotals(targetPeriodId)),
      refreshStep('REFRESH_INCOME_TOTAL', db.getPeriodIncomesTotal(targetPeriodId)),
      refreshStep('REFRESH_HISTORY', db.getPeriodHistory()),
      refreshStep('REFRESH_DEBTS', db.getDebts()),
      refreshStep('REFRESH_DEBT_PLANS', db.getDebtPlans()),
    ]);
    await syncFinancialReminders({
      paymentMethods: methods,
      debts,
      debtPlans,
      currentPeriod: settings.currentPeriod ?? null,
    }, settings.pushNotificationsEnabled).catch(() => undefined);
    const notifications = await db.getAppNotifications();
    setPaymentMethods(methods);
    setPaymentMethodTotals(methodTotals);
    setCardPaymentMovements(cardPayments);
    setAccountTransfers(transfers);
    setSavingsGoals(goals);
    setPeriodSavingsGoalActivity(goalActivity);
    setPeriodSavingsFundingTotal(savingsFundingTotal);
    setUnbilledCreditCardTotal(unbilledCreditTotal);
    setExpenses(exps);
    setIncomes(incs);
    setExpenseNames(allExpenseNames);
    setIncomeNames(allIncomeNames);
    setPeriodCategoryExpensesTotals(totals);
    setPeriodIncomesTotal(incomesTotal);
    setPeriodHistory(history);
    setAppNotifications(notifications);
    setLoadedPeriodId(targetPeriodId);
  }, [settings.currentPeriod, settings.pushNotificationsEnabled]);

  useEffect(() => {
    if (!isReady || !hasRefreshed) return;
    const today = toIsoDate(new Date());
    const syncPromise = db.getUpcomingRecurringConfirmations(addIsoDays(today, 365), today)
      .then(async (schedules) => {
        await syncRecurringNotifications(schedules, settings.pushNotificationsEnabled);
        setAppNotifications(await db.getAppNotifications());
      })
      .catch(() => undefined)
      .finally(() => {
        if (recurringSyncPromiseRef.current === syncPromise) {
          recurringSyncPromiseRef.current = null;
        }
      });
    recurringSyncPromiseRef.current = syncPromise;
  }, [hasRefreshed, isReady, recurringNotificationKey, settings.pushNotificationsEnabled]);

  const initializeDatabase = useCallback(() => {
    setInitializationFailed(false);
    void db.initDatabase()
      .then(() => setIsReady(true))
      .catch((error) => {
        logAppError('database.initialize', error);
        setInitializationFailed(true);
      });
  }, []);

  useEffect(() => {
    initializeDatabase();
  }, [initializeDatabase]);

  useEffect(() => {
    if (!isReady) return;
    if (skipNextSelectedPeriodRefreshRef.current) {
      skipNextSelectedPeriodRefreshRef.current = false;
      return;
    }
    void refresh().catch((error) => {
      logAppError('database.refresh', error);
    });
  }, [
    selectedPeriodId,
    isReady,
    refresh,
  ]);

  const organizerActions = useOrganizerActions(refresh);
  const paymentActions = usePaymentActions(refresh, refreshFinancialDomain);
  const debtActions = useDebtActions(refreshFinancialDomain);
  const savingsActions = useSavingsActions(refresh, refreshFinancialDomain);
  const recurrenceActions = useRecurrenceActions(refresh);
  const movementActions = useMovementActions(
    selectedPeriodId,
    refresh,
    refreshFinancialDomain
  );
  const periodActions = usePeriodActions({
    settings,
    refresh,
    selectedPeriodIdRef,
    skipNextSelectedPeriodRefreshRef,
    setSelectedPeriodId,
  });
  const preferenceActions = usePreferenceActions(settings, setAppNotifications, refresh);

  const value = useMemo<DatabaseContextValue>(
    () => ({
      categories,
      contacts,
      relationshipTypes,
      incomeCategories,
      savingsGroups,
      paymentMethods,
      paymentMethodTotals,
      cardPaymentMovements,
      accountTransfers,
      appNotifications,
      recurringExpenses,
      recurringDecisions,
      recurringIncomes,
      savingsGoals,
      periodSavingsGoalActivity,
      periodSavingsFundingTotal,
      expenses,
      incomes,
      expenseNames,
      incomeNames,
      settings,
      periods,
      selectedPeriod,
      selectedPeriodId,
      periodCategoryExpensesTotals,
      periodIncomesTotal,
      periodHistory,
      periodExpensesTotal,
      unbilledCreditCardTotal,
      isReady,
      isPeriodChanging,
      periodRefreshFailed,
      refresh,
      runDatabaseMaintenance,
      ...organizerActions,
      ...paymentActions,
      ...debtActions,
      ...savingsActions,
      ...recurrenceActions,
      ...movementActions,
      ...periodActions,
      ...preferenceActions,
    }),
    [
      categories,
      contacts,
      relationshipTypes,
      incomeCategories,
      savingsGroups,
      paymentMethods,
      paymentMethodTotals,
      cardPaymentMovements,
      accountTransfers,
      appNotifications,
      recurringExpenses,
      recurringDecisions,
      recurringIncomes,
      savingsGoals,
      periodSavingsGoalActivity,
      periodSavingsFundingTotal,
      unbilledCreditCardTotal,
      expenses,
      incomes,
      expenseNames,
      incomeNames,
      settings,
      periods,
      selectedPeriod,
      selectedPeriodId,
      periodCategoryExpensesTotals,
      periodIncomesTotal,
      periodHistory,
      periodExpensesTotal,
      isReady,
      isPeriodChanging,
      periodRefreshFailed,
      refresh,
      runDatabaseMaintenance,
      organizerActions,
      paymentActions,
      debtActions,
      savingsActions,
      recurrenceActions,
      movementActions,
      periodActions,
      preferenceActions,
    ]
  );

  if (initializationFailed) {
    return (
      <DatabaseInitializationError
        onRetry={initializeDatabase}
      />
    );
  }

  if (!isReady) {
    return <AppLoadingScreen />;
  }

  return <DatabaseDomainProviders value={value}>{children}</DatabaseDomainProviders>;
}
