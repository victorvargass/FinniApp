import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import { t } from '@/lib/i18n';
import type {
  NewExpense,
  NewIncome,
  NewRecurringSchedule,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function useMovementActions(
  selectedPeriodId: number | null,
  refresh: Refresh,
  refreshFinancialDomain: Refresh
) {
  const addExpense = useCallback(async (
    data: NewExpense,
    recurringSchedule?: NewRecurringSchedule
  ) => {
    if (selectedPeriodId == null) throw new Error(t('errors.noSelectedPeriod'));
    if (recurringSchedule) {
      await db.createExpenseWithRecurrence(data, recurringSchedule, selectedPeriodId);
      await refresh();
    } else {
      await db.createExpense(data, selectedPeriodId);
      await refreshFinancialDomain();
    }
  }, [refresh, refreshFinancialDomain, selectedPeriodId]);

  const editExpense = useCallback(async (id: number, data: NewExpense) => {
    await db.updateExpense(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeExpense = useCallback(async (id: number) => {
    await db.deleteExpense(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const addIncome = useCallback(async (
    data: NewIncome,
    recurringSchedule?: NewRecurringSchedule
  ) => {
    if (selectedPeriodId == null) throw new Error(t('errors.noSelectedPeriod'));
    if (recurringSchedule) {
      await db.createIncomeWithRecurrence(data, recurringSchedule, selectedPeriodId);
      await refresh();
    } else {
      await db.createIncome(data, selectedPeriodId);
      await refreshFinancialDomain();
    }
  }, [refresh, refreshFinancialDomain, selectedPeriodId]);

  const editIncome = useCallback(async (id: number, data: NewIncome) => {
    await db.updateIncome(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeIncome = useCallback(async (id: number) => {
    await db.deleteIncome(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  return useMemo(() => ({
    addExpense,
    editExpense,
    removeExpense,
    addIncome,
    editIncome,
    removeIncome,
  }), [addExpense, addIncome, editExpense, editIncome, removeExpense, removeIncome]);
}
