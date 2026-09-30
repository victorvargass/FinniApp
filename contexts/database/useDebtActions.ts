import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import type {
  NewDebt,
  NewDebtBalance,
  NewDebtPayment,
  NewDebtPaymentBatch,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function useDebtActions(refreshFinancialDomain: Refresh) {
  const getDebts = useCallback(() => db.getDebts(), []);
  const getDebt = useCallback((id: number) => db.getDebt(id), []);

  const addDebt = useCallback(async (data: NewDebt) => {
    const id = await db.createDebt(data);
    await refreshFinancialDomain();
    return id;
  }, [refreshFinancialDomain]);

  const editDebt = useCallback(async (id: number, data: NewDebt) => {
    await db.updateDebt(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const addDebtPayment = useCallback(async (debtId: number, data: NewDebtPayment) => {
    await db.createDebtPayment(debtId, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const addDebtPayments = useCallback(async (data: NewDebtPaymentBatch) => {
    await db.createDebtPayments(data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const editDebtPayment = useCallback(async (entryId: number, data: NewDebtPayment) => {
    await db.updateDebtPayment(entryId, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeDebtPayment = useCallback(async (entryId: number) => {
    await db.deleteDebtPayment(entryId);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const addDebtBalanceAdjustment = useCallback(async (debtId: number, data: NewDebtBalance) => {
    await db.addDebtBalanceAdjustment(debtId, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeDebtBalanceAdjustment = useCallback(async (debtId: number, entryId: number) => {
    await db.deleteDebtBalanceAdjustment(debtId, entryId);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const setDebtArchived = useCallback(async (id: number, archived: boolean) => {
    await db.setDebtArchived(id, archived);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeDebt = useCallback(async (id: number) => {
    await db.deleteDebt(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  return useMemo(() => ({
    getDebts,
    getDebt,
    addDebt,
    editDebt,
    addDebtPayment,
    addDebtPayments,
    editDebtPayment,
    removeDebtPayment,
    addDebtBalanceAdjustment,
    removeDebtBalanceAdjustment,
    setDebtArchived,
    removeDebt,
  }), [
    addDebt,
    addDebtBalanceAdjustment,
    addDebtPayment,
    addDebtPayments,
    editDebt,
    editDebtPayment,
    getDebt,
    getDebts,
    removeDebt,
    removeDebtBalanceAdjustment,
    removeDebtPayment,
    setDebtArchived,
  ]);
}
