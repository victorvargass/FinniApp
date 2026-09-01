import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import * as db from '@/lib/db';
import type {
  Category,
  CreditCardCycle,
  DebtPlan,
  ExpenseWithCategory,
  Income,
  NewCategory,
  NewExpense,
  NewIncome,
  NewInstallmentPurchase,
  NewCreditCardCycle,
  NewPaymentMethod,
  NewRecurringExpense,
  NewRecurringIncome,
  NewRecurringSchedule,
  PaymentMethod,
  PaymentMethodTotal,
  Period,
  PeriodCategoryExpensesTotals,
  PeriodHistory,
  ReconcileCreditCardCycle,
  RecurringDecisionItem,
  RecurringExpense,
  RecurringIncome,
  Settings,
} from '@/lib/types';
import { addIsoDays, toIsoDate } from '@/lib/recurrence';
import {
  notifyGeneratedRecurringExpenses,
  syncRecurringNotifications,
} from '@/services/RecurringNotificationService';

type DatabaseContextValue = {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  paymentMethodTotals: PaymentMethodTotal[];
  recurringExpenses: RecurringExpense[];
  recurringDecisions: RecurringDecisionItem[];
  recurringIncomes: RecurringIncome[];
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
  refresh: () => Promise<void>;
  selectPeriod: (periodId: number) => void;
  closeCurrentPeriod: () => Promise<void>;
  addCategory: (data: NewCategory) => Promise<void>;
  editCategory: (id: number, data: NewCategory) => Promise<void>;
  getCategoryExpenseCount: (id: number) => Promise<number>;
  removeCategory: (id: number, detachExpenses?: boolean) => Promise<void>;
  addPaymentMethod: (data: NewPaymentMethod) => Promise<void>;
  editPaymentMethod: (id: number, data: NewPaymentMethod) => Promise<void>;
  setPaymentMethodActive: (id: number, active: boolean) => Promise<void>;
  setDefaultPaymentMethod: (id: number | null) => Promise<void>;
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
  cancelFutureInstallments: (id: number) => Promise<void>;
  restoreRemovedInstallment: (installmentId: number) => Promise<void>;
  addRecurringExpense: (data: NewRecurringExpense) => Promise<void>;
  editRecurringExpense: (id: number, data: NewRecurringExpense) => Promise<void>;
  setRecurringExpenseActive: (id: number, active: boolean) => Promise<void>;
  removeRecurringExpense: (id: number) => Promise<void>;
  editRecurringIncome: (id: number, data: NewRecurringIncome) => Promise<void>;
  setRecurringIncomeActive: (id: number, active: boolean) => Promise<void>;
  removeRecurringIncome: (id: number) => Promise<void>;
  addRecurringIncomeFromSource: (sourceIncomeId: number, schedule: NewRecurringSchedule) => Promise<void>;
  approveRecurringOccurrence: (recurringExpenseId: number, scheduledDate: string) => Promise<void>;
  skipRecurringOccurrence: (recurringExpenseId: number, scheduledDate: string) => Promise<void>;
  dismissSkippedOccurrence: (recurringExpenseId: number, scheduledDate: string) => Promise<void>;
  markRecurringOccurrencePending: (recurringExpenseId: number, scheduledDate: string) => Promise<void>;
  retryRecurringOccurrence: (recurringExpenseId: number, scheduledDate: string) => Promise<void>;
  addExpense: (data: NewExpense, recurringSchedule?: NewRecurringSchedule) => Promise<void>;
  editExpense: (id: number, data: NewExpense) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addIncome: (data: NewIncome, recurringSchedule?: NewRecurringSchedule) => Promise<void>;
  editIncome: (id: number, data: NewIncome) => Promise<void>;
  removeIncome: (id: number) => Promise<void>;
  setPeriodStartDate: (date: string) => Promise<void>;
  setPeriodEndDate: (date: string) => Promise<void>;
};

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>({
    id: 1,
    currentPeriodId: null,
    defaultPaymentMethodId: null,
    currentPeriod: null,
  });
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodTotals, setPaymentMethodTotals] = useState<PaymentMethodTotal[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [recurringDecisions, setRecurringDecisions] = useState<RecurringDecisionItem[]>([]);
  const [recurringIncomes, setRecurringIncomes] = useState<RecurringIncome[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [expenseNames, setExpenseNames] = useState<string[]>([]);
  const [incomeNames, setIncomeNames] = useState<string[]>([]);
  const [periodCategoryExpensesTotals, setPeriodCategoryExpensesTotals] = useState<PeriodCategoryExpensesTotals[]>([]);
  const [periodIncomesTotal, setPeriodIncomesTotal] = useState<number>(0);
  const [periodHistory, setPeriodHistory] = useState<PeriodHistory[]>([]);

  const periodExpensesTotal = useMemo(
    () => periodCategoryExpensesTotals.reduce((sum, item) => sum + item.total, 0),
    [periodCategoryExpensesTotals]
  );
  const selectedPeriod = useMemo(
    () => periods.find((period) => period.id === selectedPeriodId) ?? null,
    [periods, selectedPeriodId]
  );
  const recurringNotificationKey = useMemo(
    () => JSON.stringify(recurringExpenses.map((item) => ({
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
    }))),
    [recurringExpenses]
  );

  const refresh = useCallback(async () => {
    const generatedExpenses = await db.processDueRecurringExpenses();
    await notifyGeneratedRecurringExpenses(generatedExpenses).catch(() => undefined);
    await db.processProjectedInstallments();
    await db.processDueRecurringIncomes();
    const settings = await db.getSettings();
    const allPeriods = await db.getPeriods();
    setSettings(settings);
    setPeriods(allPeriods);
    const targetPeriodId =
      selectedPeriodId != null && allPeriods.some((period) => period.id === selectedPeriodId)
        ? selectedPeriodId
        : settings.currentPeriodId;
    if (targetPeriodId == null) {
      return;
    }
    if (targetPeriodId !== selectedPeriodId) {
      setSelectedPeriodId(targetPeriodId);
    }
    const [cats, methods, methodTotals, recurring, decisions, recurringIncomeRows, exps, incs, allExpenseNames, allIncomeNames, totals, incomesTotal, history] = await Promise.all([
      db.getCategories(),
      db.getPaymentMethods(true),
      db.getPaymentMethodTotals(targetPeriodId),
      db.getRecurringExpenses(),
      db.getRecurringDecisionItems(),
      db.getRecurringIncomes(),
      db.getExpenses(targetPeriodId),
      db.getIncomes(targetPeriodId),
      db.getExpenseNames(),
      db.getIncomeNames(),
      db.getPeriodCategoryExpensesTotals(targetPeriodId),
      db.getPeriodIncomesTotal(targetPeriodId),
      db.getPeriodHistory(),
    ]);
    setCategories(cats);
    setPaymentMethods(methods);
    setPaymentMethodTotals(methodTotals);
    setRecurringExpenses(recurring);
    setRecurringDecisions(decisions);
    setRecurringIncomes(recurringIncomeRows);
    setExpenses(exps);
    setIncomes(incs);
    setExpenseNames(allExpenseNames);
    setIncomeNames(allIncomeNames);
    setPeriodCategoryExpensesTotals(totals);
    setPeriodIncomesTotal(incomesTotal);
    setPeriodHistory(history);
    setHasRefreshed(true);
  }, [selectedPeriodId]);

  useEffect(() => {
    if (!isReady || !hasRefreshed) return;
    const today = toIsoDate(new Date());
    db.getUpcomingRecurringConfirmations(addIsoDays(today, 365), today)
      .then(syncRecurringNotifications)
      .catch(() => undefined);
  }, [hasRefreshed, isReady, recurringNotificationKey]);

  useEffect(() => {
    async function initialize() {
      await db.initDatabase();
      setIsReady(true);
    }
    initialize();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    refresh();
  }, [
    selectedPeriodId,
    isReady,
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
        throw new Error('No se puede eliminar una categoría con gastos asociados');
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

  const cancelFutureInstallments = useCallback(async (id: number) => {
    await db.cancelFutureInstallments(id);
    await refresh();
  }, [refresh]);

  const restoreRemovedInstallment = useCallback(async (installmentId: number) => {
    await db.restoreRemovedInstallment(installmentId);
    await refresh();
  }, [refresh]);

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

  const setRecurringIncomeActive = useCallback(async (id: number, active: boolean) => {
    await db.setRecurringIncomeActive(id, active);
    await refresh();
  }, [refresh]);

  const removeRecurringIncome = useCallback(async (id: number) => {
    await db.deleteRecurringIncome(id);
    await refresh();
  }, [refresh]);

  const addRecurringIncomeFromSource = useCallback(async (sourceIncomeId: number, schedule: NewRecurringSchedule) => {
    const { registrationMode: _registrationMode, ...incomeSchedule } = schedule;
    await db.createRecurringIncomeFromSource(sourceIncomeId, incomeSchedule);
    await refresh();
  }, [refresh]);

  const approveRecurringOccurrence = useCallback(async (
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    await db.approveRecurringOccurrence(recurringExpenseId, scheduledDate);
    await refresh();
  }, [refresh]);

  const skipRecurringOccurrence = useCallback(async (
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    await db.skipRecurringOccurrence(recurringExpenseId, scheduledDate);
    await refresh();
  }, [refresh]);

  const dismissSkippedOccurrence = useCallback(async (
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    await db.dismissSkippedOccurrence(recurringExpenseId, scheduledDate);
    await refresh();
  }, [refresh]);

  const markRecurringOccurrencePending = useCallback(async (
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    await db.markRecurringOccurrencePending(recurringExpenseId, scheduledDate);
    await refresh();
  }, [refresh]);

  const retryRecurringOccurrence = useCallback(async (
    recurringExpenseId: number,
    scheduledDate: string
  ) => {
    await db.restoreRecurringOccurrence(recurringExpenseId, scheduledDate);
    try {
      await db.approveRecurringOccurrence(recurringExpenseId, scheduledDate);
    } finally {
      await refresh();
    }
  }, [refresh]);

  const addExpense = useCallback(
    async (data: NewExpense, recurringSchedule?: NewRecurringSchedule) => {
      if (selectedPeriodId == null) throw new Error('No hay un período seleccionado');
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
      if (selectedPeriodId == null) throw new Error('No hay un período seleccionado');
      if (recurringSchedule) {
        const { registrationMode: _registrationMode, ...incomeSchedule } = recurringSchedule;
        await db.createIncomeWithRecurrence(data, incomeSchedule, selectedPeriodId);
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

  const closeCurrentPeriod = useCallback(
    async () => {
      const nextPeriod = await db.closeCurrentPeriod();
      setSelectedPeriodId(nextPeriod.id);
    },
    []
  );

  const selectPeriod = useCallback((periodId: number) => {
    setSelectedPeriodId(periodId);
  }, []);

  const value = useMemo(
    () => ({
      categories,
      paymentMethods,
      paymentMethodTotals,
      recurringExpenses,
      recurringDecisions,
      recurringIncomes,
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
      refresh,
      selectPeriod,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      getCategoryExpenseCount,
      removeCategory,
      addPaymentMethod,
      editPaymentMethod,
      setPaymentMethodActive,
      setDefaultPaymentMethod,
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
      cancelFutureInstallments,
      restoreRemovedInstallment,
      addRecurringExpense,
      editRecurringExpense,
      setRecurringExpenseActive,
      removeRecurringExpense,
      editRecurringIncome,
      setRecurringIncomeActive,
      removeRecurringIncome,
      addRecurringIncomeFromSource,
      approveRecurringOccurrence,
      skipRecurringOccurrence,
      dismissSkippedOccurrence,
      markRecurringOccurrencePending,
      retryRecurringOccurrence,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      editIncome,
      removeIncome,
      setPeriodStartDate,
      setPeriodEndDate,
    }),
    [
      categories,
      paymentMethods,
      paymentMethodTotals,
      recurringExpenses,
      recurringDecisions,
      recurringIncomes,
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
      refresh,
      selectPeriod,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      getCategoryExpenseCount,
      removeCategory,
      addPaymentMethod,
      editPaymentMethod,
      setPaymentMethodActive,
      setDefaultPaymentMethod,
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
      cancelFutureInstallments,
      restoreRemovedInstallment,
      addRecurringExpense,
      editRecurringExpense,
      setRecurringExpenseActive,
      removeRecurringExpense,
      editRecurringIncome,
      setRecurringIncomeActive,
      removeRecurringIncome,
      addRecurringIncomeFromSource,
      approveRecurringOccurrence,
      skipRecurringOccurrence,
      dismissSkippedOccurrence,
      markRecurringOccurrencePending,
      retryRecurringOccurrence,
      addExpense,
      editExpense,
      removeExpense,
      addIncome,
      editIncome,
      removeIncome,
      setPeriodStartDate,
      setPeriodEndDate,
    ]
  );

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return <DatabaseContext.Provider value={value}>{children}</DatabaseContext.Provider>;
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase debe usarse dentro de DatabaseProvider');
  }
  return context;
}
