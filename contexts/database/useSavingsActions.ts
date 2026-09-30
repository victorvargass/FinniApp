import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import type {
  NewSavingsGoal,
  NewSavingsGoalBalance,
  SavingsGoalStatus,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function useSavingsActions(refresh: Refresh, refreshFinancialDomain: Refresh) {
  const addSavingsGoal = useCallback(async (data: NewSavingsGoal) => {
    await db.createSavingsGoal(data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const editSavingsGoal = useCallback(async (id: number, data: NewSavingsGoal) => {
    await db.updateSavingsGoal(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const addSavingsGoalBalanceAdjustment = useCallback(async (
    id: number,
    data: NewSavingsGoalBalance
  ) => {
    await db.addSavingsGoalBalanceAdjustment(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeSavingsGoalBalanceAdjustment = useCallback(async (
    goalId: number,
    adjustmentId: number
  ) => {
    await db.deleteSavingsGoalBalanceAdjustment(goalId, adjustmentId);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const setSavingsGoalStatus = useCallback(async (id: number, status: SavingsGoalStatus) => {
    await db.setSavingsGoalArchived(id, status === 'archived');
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeSavingsGoal = useCallback(async (id: number) => {
    await db.deleteSavingsGoal(id);
    await refresh();
  }, [refresh]);

  const getSavingsGoalMovements = useCallback(
    (id: number) => db.getSavingsGoalMovements(id),
    []
  );

  return useMemo(() => ({
    addSavingsGoal,
    editSavingsGoal,
    addSavingsGoalBalanceAdjustment,
    removeSavingsGoalBalanceAdjustment,
    setSavingsGoalStatus,
    removeSavingsGoal,
    getSavingsGoalMovements,
  }), [
    addSavingsGoal,
    addSavingsGoalBalanceAdjustment,
    editSavingsGoal,
    getSavingsGoalMovements,
    removeSavingsGoal,
    removeSavingsGoalBalanceAdjustment,
    setSavingsGoalStatus,
  ]);
}
