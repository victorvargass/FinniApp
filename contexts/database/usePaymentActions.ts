import { useCallback, useMemo } from 'react';

import * as db from '@/repositories';
import type {
  CreditCardCycle,
  NewAccountTransfer,
  NewCreditCardAdjustment,
  NewCreditCardCycle,
  NewInstallmentPurchase,
  NewPaymentMethod,
  NewPaymentMethodBalance,
  PaymentMethodBalanceUpdate,
  ReconcileCreditCardCycle,
} from '@/lib/types';

type Refresh = () => Promise<void>;

export function usePaymentActions(refresh: Refresh, refreshFinancialDomain: Refresh) {
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
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const editCreditCardCycle = useCallback(async (
    id: number,
    statementAmount: number | null,
    status: CreditCardCycle['status']
  ) => {
    await db.updateCreditCardCycle(id, statementAmount, status);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const reconcileCreditCardCycle = useCallback(async (
    id: number,
    data: ReconcileCreditCardCycle
  ) => {
    await db.reconcileCreditCardCycle(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const unreconcileCreditCardCycle = useCallback(async (id: number) => {
    await db.unreconcileCreditCardCycle(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const getDebtPlans = useCallback(
    (paymentMethodId?: number) => db.getDebtPlans(paymentMethodId),
    []
  );
  const getDebtPlan = useCallback((id: number) => db.getDebtPlan(id), []);

  const addInstallmentPurchase = useCallback(async (data: NewInstallmentPurchase) => {
    const id = await db.createInstallmentPurchase(data);
    await refreshFinancialDomain();
    return id;
  }, [refreshFinancialDomain]);

  const activateInstallmentPlan = useCallback(async (
    id: number,
    periodId: number,
    actualAmount: number
  ) => {
    await db.activateInstallmentPlan(id, periodId, actualAmount);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const settleInstallmentPlan = useCallback(async (id: number, periodId: number) => {
    await db.settleInstallmentPlan(id, periodId);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const setDebtPlanShowOnHome = useCallback(async (id: number, showOnHome: boolean) => {
    await db.setDebtPlanShowOnHome(id, showOnHome);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const restoreRemovedInstallment = useCallback(async (installmentId: number, periodId: number) => {
    await db.restoreRemovedInstallment(installmentId, periodId);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeInstallmentPlan = useCallback(async (id: number) => {
    await db.deleteInstallmentPlan(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const getCreditCardAdjustment = useCallback(
    (id: number) => db.getCreditCardAdjustment(id),
    []
  );

  const addCreditCardAdjustment = useCallback(async (data: NewCreditCardAdjustment) => {
    const id = await db.createCreditCardAdjustment(data);
    await refreshFinancialDomain();
    return id;
  }, [refreshFinancialDomain]);

  const editCreditCardAdjustment = useCallback(async (
    id: number,
    data: NewCreditCardAdjustment
  ) => {
    await db.updateCreditCardAdjustment(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeCreditCardAdjustment = useCallback(async (id: number) => {
    await db.deleteCreditCardAdjustment(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const getAccountTransfer = useCallback((id: number) => db.getAccountTransfer(id), []);

  const addAccountTransfer = useCallback(async (data: NewAccountTransfer) => {
    const id = await db.createAccountTransfer(data);
    await refreshFinancialDomain();
    return id;
  }, [refreshFinancialDomain]);

  const editAccountTransfer = useCallback(async (id: number, data: NewAccountTransfer) => {
    await db.updateAccountTransfer(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const removeAccountTransfer = useCallback(async (id: number) => {
    await db.deleteAccountTransfer(id);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const updatePaymentMethodBalance = useCallback(async (
    id: number,
    data: NewPaymentMethodBalance
  ) => {
    await db.updatePaymentMethodBalance(id, data);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  const updatePaymentMethodBalances = useCallback(async (updates: PaymentMethodBalanceUpdate[]) => {
    await db.updatePaymentMethodBalances(updates);
    await refreshFinancialDomain();
  }, [refreshFinancialDomain]);

  return useMemo(() => ({
    addPaymentMethod,
    editPaymentMethod,
    setPaymentMethodActive,
    setDefaultPaymentMethod,
    getPaymentMethodDeletionInfo,
    removePaymentMethod,
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
    setDebtPlanShowOnHome,
    restoreRemovedInstallment,
    removeInstallmentPlan,
    getCreditCardAdjustment,
    addCreditCardAdjustment,
    editCreditCardAdjustment,
    removeCreditCardAdjustment,
    getAccountTransfer,
    addAccountTransfer,
    editAccountTransfer,
    removeAccountTransfer,
    updatePaymentMethodBalance,
    updatePaymentMethodBalances,
  }), [
    activateInstallmentPlan,
    addAccountTransfer,
    addCreditCardAdjustment,
    addCreditCardCycle,
    addInstallmentPurchase,
    addPaymentMethod,
    editAccountTransfer,
    editCreditCardAdjustment,
    editCreditCardCycle,
    editPaymentMethod,
    getAccountTransfer,
    getCreditCardAdjustment,
    getCreditCardCycles,
    getDebtPlan,
    getDebtPlans,
    getPaymentMethodDeletionInfo,
    reconcileCreditCardCycle,
    removeAccountTransfer,
    removeCreditCardAdjustment,
    removeInstallmentPlan,
    removePaymentMethod,
    restoreRemovedInstallment,
    setDebtPlanShowOnHome,
    setDefaultPaymentMethod,
    setPaymentMethodActive,
    settleInstallmentPlan,
    unreconcileCreditCardCycle,
    updatePaymentMethodBalance,
    updatePaymentMethodBalances,
  ]);
}
