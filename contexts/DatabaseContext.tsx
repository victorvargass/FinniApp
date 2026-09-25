import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import * as db from '@/repositories';
import { t } from '@/lib/i18n';
import { attachDiagnosticMetadata, logAppError } from '@/lib/logger';
import { AppLoadingScreen } from '@/components/app-loading-screen';
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
import {
  notifyGeneratedRecurringExpenses,
  syncRecurringNotifications,
  upsertRecurringDecisionNotifications,
} from '@/services/RecurringNotificationService';
import { syncMovementReminder } from '@/services/MovementReminderService';
import { syncFinancialReminders } from '@/services/FinancialReminderService';
import {
  cancelFinniNotifications,
  ensurePushNotificationPermission,
} from '@/services/NotificationPreferencesService';

type DatabaseContextValue = {
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
  restoreRemovedInstallment: (installmentId: number, periodId: number) => Promise<void>;
  removeInstallmentPlan: (id: number) => Promise<void>;
  getDebts: () => Promise<Debt[]>;
  getDebt: (id: number) => Promise<Debt | null>;
  addDebt: (data: NewDebt) => Promise<number>;
  editDebt: (id: number, data: NewDebt) => Promise<void>;
  addDebtPayment: (debtId: number, data: NewDebtPayment) => Promise<void>;
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
  resetLocalData: () => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

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
    currentPeriod: null,
  });
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [loadedPeriodId, setLoadedPeriodId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
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

  selectedPeriodIdRef.current = selectedPeriodId;

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
        const [cats, contactRows, relationshipRows, incomeCats, groups, methods, methodTotals, cardPayments, transfers, recurring, decisions, recurringIncomeRows, goals, goalActivity, savingsFundingTotal, exps, incs, allExpenseNames, allIncomeNames, totals, incomesTotal, history, debts, debtPlans] = await Promise.all([
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
      } catch (error) {
        setPeriodRefreshFailed(true);
        throw error;
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

  useEffect(() => {
    let active = true;
    db.initDatabase()
      .then(() => {
        if (active) setIsReady(true);
      })
      .catch((error) => {
        logAppError('database.initialize', error);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const addCategory = useCallback(
    async (data: NewCategory) => {
      await db.createCategory(data);
      await refresh();
    },
    [refresh]
  );

  const editCategory = useCallback(
    async (id: number, data: NewCategory) => {
      await db.updateCategory(id, data);
      await refresh();
    },
    [refresh]
  );

  const removeCategory = useCallback(
    async (id: number, detachExpenses = false) => {
      const count = await db.getExpenseCountByCategory(id);
      if (count > 0 && !detachExpenses) {
        throw new Error(t('errors.categoryHasExpenses'));
      }
      await db.deleteCategory(id, detachExpenses);
      await refresh();
    },
    [refresh]
  );

  const getCategoryExpenseCount = useCallback(
    (id: number) => db.getExpenseCountByCategory(id),
    []
  );

  const saveContact = useCallback(async (data: NewContact, id?: number) => {
    const savedId = await db.saveContact(data, id);
    await refresh();
    return savedId;
  }, [refresh]);

  const removeContact = useCallback(async (id: number) => {
    await db.deleteContact(id);
    await refresh();
  }, [refresh]);

  const getContact = useCallback((id: number) => db.getContact(id), []);

  const saveRelationshipType = useCallback(async (data: NewRelationshipType, id?: number) => {
    await db.saveRelationshipType(data, id);
    await refresh();
  }, [refresh]);

  const removeRelationshipType = useCallback(async (id: number) => {
    await db.deleteRelationshipType(id);
    await refresh();
  }, [refresh]);

  const saveIncomeCategory = useCallback(async (data: NewIncomeCategory, id?: number) => {
    await db.saveIncomeCategory(data, id);
    await refresh();
  }, [refresh]);

  const removeIncomeCategory = useCallback(async (id: number) => {
    await db.deleteIncomeCategory(id);
    await refresh();
  }, [refresh]);

  const saveSavingsGroup = useCallback(async (data: NewSavingsGroup, id?: number) => {
    await db.saveSavingsGroup(data, id);
    await refresh();
  }, [refresh]);

  const removeSavingsGroup = useCallback(async (id: number) => {
    await db.deleteSavingsGroup(id);
    await refresh();
  }, [refresh]);

  const addPaymentMethod = useCallback(async (data: NewPaymentMethod) => {
    await db.createPaymentMethod(data);
    await refresh();
  }, [refresh]);

  const editPaymentMethod = useCallback(async (id: number, data: NewPaymentMethod) => {
    await db.updatePaymentMethod(id, data);
    await refresh();
  }, [refresh]);

  const setPaymentMethodActive = useCallback(async (id: number, active: boolean) => {
    await db.setPaymentMethodActive(id, active);
    await refresh();
  }, [refresh]);

  const setDefaultPaymentMethod = useCallback(async (id: number | null) => {
    await db.setDefaultPaymentMethod(id);
    await refresh();
  }, [refresh]);

  const getPaymentMethodDeletionInfo = useCallback(
    (id: number) => db.getPaymentMethodDeletionInfo(id),
    []
  );

  const removePaymentMethod = useCallback(async (id: number) => {
    await db.deletePaymentMethod(id);
    await refresh();
  }, [refresh]);

  const getCreditCardCycles = useCallback(
    (paymentMethodId: number) => db.getCreditCardCycles(paymentMethodId),
    []
  );

  const addCreditCardCycle = useCallback(async (data: NewCreditCardCycle) => {
    await db.createCreditCardCycle(data);
    await refresh();
  }, [refresh]);

  const editCreditCardCycle = useCallback(async (
    id: number,
    statementAmount: number | null,
    status: CreditCardCycle['status']
  ) => {
    await db.updateCreditCardCycle(id, statementAmount, status);
    await refresh();
  }, [refresh]);

  const reconcileCreditCardCycle = useCallback(async (
    id: number,
    data: ReconcileCreditCardCycle
  ) => {
    await db.reconcileCreditCardCycle(id, data);
    await refresh();
  }, [refresh]);

  const unreconcileCreditCardCycle = useCallback(async (id: number) => {
    await db.unreconcileCreditCardCycle(id);
    await refresh();
  }, [refresh]);

  const getDebtPlans = useCallback((paymentMethodId?: number) => db.getDebtPlans(paymentMethodId), []);
  const getDebtPlan = useCallback((id: number) => db.getDebtPlan(id), []);

  const addInstallmentPurchase = useCallback(async (data: NewInstallmentPurchase) => {
    const id = await db.createInstallmentPurchase(data);
    await refresh();
    return id;
  }, [refresh]);

  const activateInstallmentPlan = useCallback(async (id: number, periodId: number, actualAmount: number) => {
    await db.activateInstallmentPlan(id, periodId, actualAmount);
    await refresh();
  }, [refresh]);

  const settleInstallmentPlan = useCallback(async (id: number, periodId: number) => {
    await db.settleInstallmentPlan(id, periodId);
    await refresh();
  }, [refresh]);

  const restoreRemovedInstallment = useCallback(async (installmentId: number, periodId: number) => {
    await db.restoreRemovedInstallment(installmentId, periodId);
    await refresh();
  }, [refresh]);

  const removeInstallmentPlan = useCallback(async (id: number) => {
    await db.deleteInstallmentPlan(id);
    await refresh();
  }, [refresh]);

  const getDebts = useCallback(() => db.getDebts(), []);
  const getDebt = useCallback((id: number) => db.getDebt(id), []);
  const addDebt = useCallback(async (data: NewDebt) => {
    const id = await db.createDebt(data);
    await refresh();
    return id;
  }, [refresh]);
  const editDebt = useCallback(async (id: number, data: NewDebt) => {
    await db.updateDebt(id, data);
    await refresh();
  }, [refresh]);
  const addDebtPayment = useCallback(async (debtId: number, data: NewDebtPayment) => {
    await db.createDebtPayment(debtId, data);
    await refresh();
  }, [refresh]);
  const editDebtPayment = useCallback(async (entryId: number, data: NewDebtPayment) => {
    await db.updateDebtPayment(entryId, data);
    await refresh();
  }, [refresh]);
  const removeDebtPayment = useCallback(async (entryId: number) => {
    await db.deleteDebtPayment(entryId);
    await refresh();
  }, [refresh]);
  const addDebtBalanceAdjustment = useCallback(async (debtId: number, data: NewDebtBalance) => {
    await db.addDebtBalanceAdjustment(debtId, data);
    await refresh();
  }, [refresh]);
  const removeDebtBalanceAdjustment = useCallback(async (debtId: number, entryId: number) => {
    await db.deleteDebtBalanceAdjustment(debtId, entryId);
    await refresh();
  }, [refresh]);
  const setDebtArchived = useCallback(async (id: number, archived: boolean) => {
    await db.setDebtArchived(id, archived);
    await refresh();
  }, [refresh]);
  const removeDebt = useCallback(async (id: number) => {
    await db.deleteDebt(id);
    await refresh();
  }, [refresh]);

  const addSavingsGoal = useCallback(async (data: NewSavingsGoal) => {
    await db.createSavingsGoal(data);
    await refresh();
  }, [refresh]);

  const editSavingsGoal = useCallback(async (id: number, data: NewSavingsGoal) => {
    await db.updateSavingsGoal(id, data);
    await refresh();
  }, [refresh]);

  const getCreditCardAdjustment = useCallback(
    (id: number) => db.getCreditCardAdjustment(id),
    []
  );

  const addCreditCardAdjustment = useCallback(async (data: NewCreditCardAdjustment) => {
    const id = await db.createCreditCardAdjustment(data);
    await refresh();
    return id;
  }, [refresh]);

  const editCreditCardAdjustment = useCallback(async (
    id: number,
    data: NewCreditCardAdjustment
  ) => {
    await db.updateCreditCardAdjustment(id, data);
    await refresh();
  }, [refresh]);

  const removeCreditCardAdjustment = useCallback(async (id: number) => {
    await db.deleteCreditCardAdjustment(id);
    await refresh();
  }, [refresh]);

  const getAccountTransfer = useCallback((id: number) => db.getAccountTransfer(id), []);

  const addAccountTransfer = useCallback(async (data: NewAccountTransfer) => {
    const id = await db.createAccountTransfer(data);
    await refresh();
    return id;
  }, [refresh]);

  const editAccountTransfer = useCallback(async (id: number, data: NewAccountTransfer) => {
    await db.updateAccountTransfer(id, data);
    await refresh();
  }, [refresh]);

  const removeAccountTransfer = useCallback(async (id: number) => {
    await db.deleteAccountTransfer(id);
    await refresh();
  }, [refresh]);

  const updatePaymentMethodBalance = useCallback(async (id: number, data: NewPaymentMethodBalance) => {
    await db.updatePaymentMethodBalance(id, data);
    await refresh();
  }, [refresh]);

  const updatePaymentMethodBalances = useCallback(async (updates: PaymentMethodBalanceUpdate[]) => {
    await db.updatePaymentMethodBalances(updates);
    await refresh();
  }, [refresh]);

  const addSavingsGoalBalanceAdjustment = useCallback(async (id: number, data: NewSavingsGoalBalance) => {
    await db.addSavingsGoalBalanceAdjustment(id, data);
    await refresh();
  }, [refresh]);

  const removeSavingsGoalBalanceAdjustment = useCallback(async (goalId: number, adjustmentId: number) => {
    await db.deleteSavingsGoalBalanceAdjustment(goalId, adjustmentId);
    await refresh();
  }, [refresh]);

  const setSavingsGoalStatus = useCallback(async (id: number, status: SavingsGoalStatus) => {
    await db.setSavingsGoalArchived(id, status === 'archived');
    await refresh();
  }, [refresh]);

  const removeSavingsGoal = useCallback(async (id: number) => {
    await db.deleteSavingsGoal(id);
    await refresh();
  }, [refresh]);

  const getSavingsGoalMovements = useCallback(
    (id: number) => db.getSavingsGoalMovements(id),
    []
  );

  const addRecurringExpense = useCallback(async (data: NewRecurringExpense) => {
    await db.createRecurringExpense(data);
    await refresh();
  }, [refresh]);

  const editRecurringExpense = useCallback(async (id: number, data: NewRecurringExpense) => {
    await db.updateRecurringExpense(id, data);
    await refresh();
  }, [refresh]);

  const setRecurringExpenseActive = useCallback(async (id: number, active: boolean) => {
    await db.setRecurringExpenseActive(id, active);
    await refresh();
  }, [refresh]);

  const removeRecurringExpense = useCallback(async (id: number) => {
    await db.deleteRecurringExpense(id);
    await refresh();
  }, [refresh]);

  const editRecurringIncome = useCallback(async (id: number, data: NewRecurringIncome) => {
    await db.updateRecurringIncome(id, data);
    await refresh();
  }, [refresh]);

  const addRecurringIncome = useCallback(async (data: NewRecurringIncome) => {
    await db.createRecurringIncome(data);
    await refresh();
  }, [refresh]);

  const setRecurringIncomeActive = useCallback(async (id: number, active: boolean) => {
    await db.setRecurringIncomeActive(id, active);
    await refresh();
  }, [refresh]);

  const removeRecurringIncome = useCallback(async (id: number) => {
    await db.deleteRecurringIncome(id);
    await refresh();
  }, [refresh]);

  const addRecurringIncomeFromSource = useCallback(async (sourceIncomeId: number, schedule: NewRecurringSchedule) => {
    await db.createRecurringIncomeFromSource(sourceIncomeId, schedule);
    await refresh();
  }, [refresh]);

  const approveRecurringOccurrence = useCallback(async (
    kind: RecurringMovementKind,
    recurringId: number,
    scheduledDate: string
  ) => {
    if (kind === 'expense') await db.approveRecurringOccurrence(recurringId, scheduledDate);
    else await db.approveRecurringIncomeOccurrence(recurringId, scheduledDate);
    await refresh();
  }, [refresh]);

  const skipRecurringOccurrence = useCallback(async (
    kind: RecurringMovementKind,
    recurringId: number,
    scheduledDate: string
  ) => {
    if (kind === 'expense') await db.skipRecurringOccurrence(recurringId, scheduledDate);
    else await db.skipRecurringIncomeOccurrence(recurringId, scheduledDate);
    await refresh();
  }, [refresh]);

  const dismissSkippedOccurrence = useCallback(async (
    kind: RecurringMovementKind,
    recurringId: number,
    scheduledDate: string
  ) => {
    if (kind === 'expense') await db.dismissSkippedOccurrence(recurringId, scheduledDate);
    else await db.dismissSkippedIncomeOccurrence(recurringId, scheduledDate);
    await refresh();
  }, [refresh]);

  const markRecurringOccurrencePending = useCallback(async (
    kind: RecurringMovementKind,
    recurringId: number,
    scheduledDate: string
  ) => {
    if (kind === 'expense') await db.markRecurringOccurrencePending(recurringId, scheduledDate);
    else await db.markRecurringIncomeOccurrencePending(recurringId, scheduledDate);
    await refresh();
  }, [refresh]);

  const retryRecurringOccurrence = useCallback(async (
    kind: RecurringMovementKind,
    recurringId: number,
    scheduledDate: string
  ) => {
    if (kind === 'expense') await db.restoreRecurringOccurrence(recurringId, scheduledDate);
    else await db.restoreRecurringIncomeOccurrence(recurringId, scheduledDate);
    try {
      if (kind === 'expense') await db.approveRecurringOccurrence(recurringId, scheduledDate);
      else await db.approveRecurringIncomeOccurrence(recurringId, scheduledDate);
    } finally {
      await refresh();
    }
  }, [refresh]);

  const addExpense = useCallback(
    async (data: NewExpense, recurringSchedule?: NewRecurringSchedule) => {
      if (selectedPeriodId == null) throw new Error(t('errors.noSelectedPeriod'));
      if (recurringSchedule) {
        await db.createExpenseWithRecurrence(data, recurringSchedule, selectedPeriodId);
      } else {
        await db.createExpense(data, selectedPeriodId);
      }
      await refresh();
    },
    [refresh, selectedPeriodId]
  );

  const editExpense = useCallback(
    async (id: number, data: NewExpense) => {
      await db.updateExpense(id, data);
      await refresh();
    },
    [refresh]
  );

  const removeExpense = useCallback(
    async (id: number) => {
      await db.deleteExpense(id);
      await refresh();
    },
    [refresh]
  );

  const addIncome = useCallback(
    async (data: NewIncome, recurringSchedule?: NewRecurringSchedule) => {
      if (selectedPeriodId == null) throw new Error(t('errors.noSelectedPeriod'));
      if (recurringSchedule) {
        await db.createIncomeWithRecurrence(data, recurringSchedule, selectedPeriodId);
      } else {
        await db.createIncome(data, selectedPeriodId);
      }
      await refresh();
    },
    [refresh, selectedPeriodId]
  );

  const editIncome = useCallback(
    async (id: number, data: NewIncome) => {
      await db.updateIncome(id, data);
      await refresh();
    },
    [refresh]
  );

  const removeIncome = useCallback(
    async (id: number) => {
      await db.deleteIncome(id);
      await refresh();
    },
    [refresh]
  );

  const setPeriodStartDate = useCallback(
    async (date: string) => {
      const period = settings.currentPeriod;
      if (!period) {
        return;
      }
      await db.setPeriodStartDate(period.id, date);
      await refresh();
    },
    [settings, refresh]
  );

  const setPeriodEndDate = useCallback(
    async (date: string) => {
      const period = settings.currentPeriod;
      if (!period) {
        return;
      }
      await db.setPeriodEndDate(period.id, date);
      await refresh();
    },
    [settings, refresh]
  );

  const setPeriodDates = useCallback(
    async (startDate: string, endDate: string) => {
      const period = settings.currentPeriod;
      if (!period) return;
      await db.setPeriodDates(period.id, startDate, endDate);
      await refresh();
    },
    [settings, refresh]
  );

  const closeCurrentPeriod = useCallback(
    async () => {
      const nextPeriod = await db.closeCurrentPeriod();
      selectedPeriodIdRef.current = nextPeriod.id;
      skipNextSelectedPeriodRefreshRef.current = true;
      setSelectedPeriodId(nextPeriod.id);
      // The period is already committed at this point. A later refresh error
      // must not make the UI suggest closing it a second time.
      void refresh().catch((error) => {
        logAppError('database.refresh', error);
      });
      return nextPeriod;
    },
    [refresh]
  );

  const selectPeriod = useCallback((periodId: number) => {
    selectedPeriodIdRef.current = periodId;
    setSelectedPeriodId(periodId);
  }, []);

  const setMovementReminder = useCallback(async (data: MovementReminderSettings) => {
    let notificationsEnabled = settings.pushNotificationsEnabled;
    if (data.movementReminderEnabled && !notificationsEnabled) {
      await ensurePushNotificationPermission();
      await db.updatePushNotificationsEnabled(true);
      notificationsEnabled = true;
    }
    const scheduled = await syncMovementReminder(data, notificationsEnabled);
    if (data.movementReminderEnabled && !scheduled) {
      throw new Error(t('errors.notificationPermissionRequired'));
    }
    await db.updateMovementReminderSettings(data);
    await refresh();
  }, [refresh, settings.pushNotificationsEnabled]);

  const setPushNotificationsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      await ensurePushNotificationPermission();
    }
    await db.updatePushNotificationsEnabled(enabled);
    if (!enabled) {
      await cancelFinniNotifications();
    }
    await refresh();
  }, [refresh]);

  const setAppNotificationRead = useCallback(async (id: number, read: boolean) => {
    await db.setAppNotificationRead(id, read);
    setAppNotifications(await db.getAppNotifications());
  }, []);

  const markAppNotificationReadBySourceKey = useCallback(async (sourceKey: string) => {
    await db.markAppNotificationReadBySourceKey(sourceKey);
    setAppNotifications(await db.getAppNotifications());
  }, []);

  const deleteAppNotification = useCallback(async (id: number) => {
    await db.deleteAppNotification(id);
    setAppNotifications(await db.getAppNotifications());
  }, []);

  const resetLocalData = useCallback(async () => {
    await db.resetLocalData();
    await cancelFinniNotifications().catch(() => undefined);
    await refresh();
  }, [refresh]);

  const value = useMemo(
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
      isReady,
      isPeriodChanging,
      periodRefreshFailed,
      refresh,
      runDatabaseMaintenance,
      selectPeriod,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      getCategoryExpenseCount,
      removeCategory,
      saveContact,
      removeContact,
      getContact,
      saveRelationshipType,
      removeRelationshipType,
      saveIncomeCategory,
      removeIncomeCategory,
      saveSavingsGroup,
      removeSavingsGroup,
      addPaymentMethod,
      editPaymentMethod,
      updatePaymentMethodBalance,
      updatePaymentMethodBalances,
      setPaymentMethodActive,
      setDefaultPaymentMethod,
      getPaymentMethodDeletionInfo,
      removePaymentMethod,
      getCreditCardAdjustment,
      addCreditCardAdjustment,
      editCreditCardAdjustment,
      removeCreditCardAdjustment,
      getAccountTransfer,
      addAccountTransfer,
      editAccountTransfer,
      removeAccountTransfer,
      getCreditCardCycles,
      addCreditCardCycle,
      editCreditCardCycle,
      reconcileCreditCardCycle,
      unreconcileCreditCardCycle,
      getDebtPlans,
      getDebtPlan,
      addInstallmentPurchase,
      activateInstallmentPlan,
      settleInstallmentPlan,
      restoreRemovedInstallment,
      removeInstallmentPlan,
      getDebts,
      getDebt,
      addDebt,
      editDebt,
      addDebtPayment,
      editDebtPayment,
      removeDebtPayment,
      addDebtBalanceAdjustment,
      removeDebtBalanceAdjustment,
      setDebtArchived,
      removeDebt,
      addSavingsGoal,
      editSavingsGoal,
      addSavingsGoalBalanceAdjustment,
      removeSavingsGoalBalanceAdjustment,
      setSavingsGoalStatus,
      removeSavingsGoal,
      getSavingsGoalMovements,
      addRecurringExpense,
      editRecurringExpense,
      setRecurringExpenseActive,
      removeRecurringExpense,
      editRecurringIncome,
      addRecurringIncome,
      setRecurringIncomeActive,
      removeRecurringIncome,
      addRecurringIncomeFromSource,
      approveRecurringOccurrence,
      skipRecurringOccurrence,
      dismissSkippedOccurrence,
      markRecurringOccurrencePending,
      retryRecurringOccurrence,
      setAppNotificationRead,
      markAppNotificationReadBySourceKey,
      deleteAppNotification,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      editIncome,
      removeIncome,
      setPeriodStartDate,
      setPeriodEndDate,
      setPeriodDates,
      setPushNotificationsEnabled,
      setMovementReminder,
      resetLocalData,
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
      selectPeriod,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      getCategoryExpenseCount,
      removeCategory,
      saveContact,
      removeContact,
      getContact,
      saveRelationshipType,
      removeRelationshipType,
      saveIncomeCategory,
      removeIncomeCategory,
      saveSavingsGroup,
      removeSavingsGroup,
      addPaymentMethod,
      editPaymentMethod,
      updatePaymentMethodBalance,
      updatePaymentMethodBalances,
      setPaymentMethodActive,
      setDefaultPaymentMethod,
      getPaymentMethodDeletionInfo,
      removePaymentMethod,
      getCreditCardAdjustment,
      addCreditCardAdjustment,
      editCreditCardAdjustment,
      removeCreditCardAdjustment,
      getAccountTransfer,
      addAccountTransfer,
      editAccountTransfer,
      removeAccountTransfer,
      getCreditCardCycles,
      addCreditCardCycle,
      editCreditCardCycle,
      reconcileCreditCardCycle,
      unreconcileCreditCardCycle,
      getDebtPlans,
      getDebtPlan,
      addInstallmentPurchase,
      activateInstallmentPlan,
      settleInstallmentPlan,
      restoreRemovedInstallment,
      removeInstallmentPlan,
      getDebts,
      getDebt,
      addDebt,
      editDebt,
      addDebtPayment,
      editDebtPayment,
      removeDebtPayment,
      addDebtBalanceAdjustment,
      removeDebtBalanceAdjustment,
      setDebtArchived,
      removeDebt,
      addSavingsGoal,
      editSavingsGoal,
      addSavingsGoalBalanceAdjustment,
      removeSavingsGoalBalanceAdjustment,
      setSavingsGoalStatus,
      removeSavingsGoal,
      getSavingsGoalMovements,
      addRecurringExpense,
      editRecurringExpense,
      setRecurringExpenseActive,
      removeRecurringExpense,
      editRecurringIncome,
      addRecurringIncome,
      setRecurringIncomeActive,
      removeRecurringIncome,
      addRecurringIncomeFromSource,
      approveRecurringOccurrence,
      skipRecurringOccurrence,
      dismissSkippedOccurrence,
      markRecurringOccurrencePending,
      retryRecurringOccurrence,
      setAppNotificationRead,
      markAppNotificationReadBySourceKey,
      deleteAppNotification,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      editIncome,
      removeIncome,
      setPeriodStartDate,
      setPeriodEndDate,
      setPeriodDates,
      setPushNotificationsEnabled,
      setMovementReminder,
      resetLocalData,
    ]
  );

  if (!isReady) {
    return <AppLoadingScreen />;
  }

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error(t('errors.databaseProvider'));
  }
  return context;
}
