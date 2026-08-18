import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import * as db from '@/lib/db';
import type {
  Category,
  ExpenseWithCategory,
  Income,
  NewCategory,
  NewExpense,
  NewIncome,
  PeriodCategoryExpensesTotals,
  PeriodHistory,
  Settings,
} from '@/lib/types';

type DatabaseContextValue = {
  categories: Category[];
  expenses: ExpenseWithCategory[];
  incomes: Income[];
  expenseNames: string[];
  incomeNames: string[];
  settings: Settings;
  periodCategoryExpensesTotals: PeriodCategoryExpensesTotals[];
  periodIncomesTotal: number;
  periodHistory: PeriodHistory[];
  periodExpensesTotal: number;
  isReady: boolean;
  refresh: () => Promise<void>;
  closeCurrentPeriod: () => Promise<void>;
  addCategory: (data: NewCategory) => Promise<void>;
  editCategory: (id: number, data: NewCategory) => Promise<void>;
  removeCategory: (id: number) => Promise<void>;
  addExpense: (data: NewExpense) => Promise<void>;
  editExpense: (id: number, data: NewExpense) => Promise<void>;
  removeExpense: (id: number) => Promise<void>;
  addIncome: (data: NewIncome) => Promise<void>;
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
    currentPeriod: null,
  });
  const [isReady, setIsReady] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
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

  const refresh = useCallback(async () => {
    const settings = await db.getSettings();
    setSettings(settings);
    if (!settings.currentPeriod) {
      return;
    }
    const period = settings.currentPeriod;
    const [cats, exps, incs, allExpenseNames, allIncomeNames, totals, incomesTotal, history] = await Promise.all([
      db.getCategories(),
      db.getExpenses(),
      db.getIncomes(),
      db.getExpenseNames(),
      db.getIncomeNames(),
      db.getPeriodCategoryExpensesTotals(period.startDate, period.endDate),
      db.getPeriodIncomesTotal(period.startDate, period.endDate),
      db.getPeriodHistory(),
    ]);
    setCategories(cats);
    setExpenses(exps);
    setIncomes(incs);
    setExpenseNames(allExpenseNames);
    setIncomeNames(allIncomeNames);
    setPeriodCategoryExpensesTotals(totals);
    setPeriodIncomesTotal(incomesTotal);
    setPeriodHistory(history);
  }, []);

  useEffect(() => {
    async function initialize() {
      await db.initDatabase();
      const settings = await db.getSettings();
      setSettings(settings);
      const period = settings.currentPeriod;
      if (!period) {
        setIsReady(true);
        return;
      }
      const [cats, exps, incs, allExpenseNames, allIncomeNames, totals, incomesTotal, history] = await Promise.all([
        db.getCategories(),
        db.getExpenses(),
        db.getIncomes(),
        db.getExpenseNames(),
        db.getIncomeNames(),
        db.getPeriodCategoryExpensesTotals(period.startDate, period.endDate),
        db.getPeriodIncomesTotal(period.startDate, period.endDate),
        db.getPeriodHistory(),
      ]);
      setCategories(cats);
      setExpenses(exps);
      setIncomes(incs);
      setExpenseNames(allExpenseNames);
      setIncomeNames(allIncomeNames);
      setPeriodCategoryExpensesTotals(totals);
      setPeriodIncomesTotal(incomesTotal);
      setPeriodHistory(history);
      setIsReady(true);
    }
    initialize();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    refresh();
  }, [
    settings.currentPeriodId,
    settings.currentPeriod?.startDate,
    settings.currentPeriod?.endDate,
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
    async (id: number) => {
      const count = await db.getExpenseCountByCategory(id);
      if (count > 0) {
        throw new Error('No se puede eliminar una categoría con gastos asociados');
      }
      await db.deleteCategory(id);
      await refresh();
    },
    [refresh]
  );

  const addExpense = useCallback(
    async (data: NewExpense) => {
      await db.createExpense(data);
      await refresh();
    },
    [refresh]
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
    async (data: NewIncome) => {
      await db.createIncome(data);
      await refresh();
    },
    [refresh]
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
      await db.closeCurrentPeriod();
      await refresh();
    },
    [refresh]
  );

  const value = useMemo(
    () => ({
      categories,
      expenses,
      incomes,
      expenseNames,
      incomeNames,
      settings,
      periodCategoryExpensesTotals,
      periodIncomesTotal,
      periodHistory,
      periodExpensesTotal,
      isReady,
      refresh,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      removeCategory,
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
      expenses,
      incomes,
      expenseNames,
      incomeNames,
      settings,
      periodCategoryExpensesTotals,
      periodIncomesTotal,
      periodHistory,
      periodExpensesTotal,
      isReady,
      refresh,
      closeCurrentPeriod,
      addCategory,
      editCategory,
      removeCategory,
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
