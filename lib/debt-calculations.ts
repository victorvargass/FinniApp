import { addIsoDays, addIsoMonths } from './recurrence-core.ts';
import type { DebtFrequency } from './types.ts';

export function getDebtBalanceAdjustmentAmount(
  reportedBalance: number,
  balanceAtDate: number
) {
  return reportedBalance - balanceAtDate;
}

export function isSinglePaymentDebt(
  initialAmount: number,
  installmentAmount: number | null
) {
  return installmentAmount != null && installmentAmount === initialAmount;
}

export function getNextDebtDueDate(
  firstDueDate: string | null,
  frequency: DebtFrequency | null,
  effectivePaymentCount: number,
  singlePayment = false
): string | null {
  if (!firstDueDate) return null;
  if (singlePayment) return firstDueDate;
  if (!frequency) return null;
  if (frequency === 'weekly') return addIsoDays(firstDueDate, effectivePaymentCount * 7);
  if (frequency === 'annual') return addIsoMonths(firstDueDate, effectivePaymentCount * 12);
  return addIsoMonths(firstDueDate, effectivePaymentCount);
}
