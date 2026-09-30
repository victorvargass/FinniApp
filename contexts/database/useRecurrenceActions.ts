import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import type {
  NewRecurringExpense,
  NewRecurringIncome,
  NewRecurringSchedule,
  RecurringMovementKind,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function useRecurrenceActions(refresh: Refresh) {
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

  const addRecurringIncomeFromSource = useCallback(async (
    sourceIncomeId: number,
    schedule: NewRecurringSchedule
  ) => {
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

  return useMemo(() => ({
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
  }), [
    addRecurringExpense,
    addRecurringIncome,
    addRecurringIncomeFromSource,
    approveRecurringOccurrence,
    dismissSkippedOccurrence,
    editRecurringExpense,
    editRecurringIncome,
    markRecurringOccurrencePending,
    removeRecurringExpense,
    removeRecurringIncome,
    retryRecurringOccurrence,
    setRecurringExpenseActive,
    setRecurringIncomeActive,
    skipRecurringOccurrence,
  ]);
}
