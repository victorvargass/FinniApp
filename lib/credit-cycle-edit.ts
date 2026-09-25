type ReconciledExpenseUpdate = {
  currentCycleId: number | null;
  nextCycleId: number | null;
  currentPaymentMethodId: number | null;
  nextPaymentMethodId: number | null;
  currentOutflow: number;
  nextOutflow: number;
};

export function canUpdateExpenseAcrossCreditCycles({
  currentCycleId,
  nextCycleId,
  currentPaymentMethodId,
  nextPaymentMethodId,
  currentOutflow,
  nextOutflow,
}: ReconciledExpenseUpdate): boolean {
  if (currentCycleId == null) return nextCycleId == null;

  return currentCycleId === nextCycleId
    && currentPaymentMethodId === nextPaymentMethodId
    && currentOutflow === nextOutflow;
}
