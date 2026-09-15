export function resolveSavingsBalanceStartDate(
  registrationDate: string
) {
  return registrationDate;
}

export type SavingsBalanceBoundary = {
  date: string;
  movementAnchorId: number;
} | null;

export function isSavingsMovementCoveredByBalance(
  movementDate: string,
  movementId: number | undefined,
  boundary: SavingsBalanceBoundary
): boolean {
  if (!boundary) return false;
  if (movementDate < boundary.date) return true;
  return movementDate === boundary.date
    && movementId != null
    && movementId <= boundary.movementAnchorId;
}

export function getSavingsBalanceAdjustmentAmount(
  reportedBalance: number,
  balanceAtDate: number
) {
  return reportedBalance - balanceAtDate;
}
