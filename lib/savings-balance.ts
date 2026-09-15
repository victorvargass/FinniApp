export function resolveSavingsBalanceStartDate(
  registrationDate: string
) {
  return registrationDate;
}

export type SavingsBalanceBoundary = BalanceSnapshotBoundary;

export function isSavingsMovementCoveredByBalance(
  movementDate: string,
  movementId: number | undefined,
  boundary: SavingsBalanceBoundary
): boolean {
  return isMovementCoveredByBalanceSnapshot(movementDate, movementId, boundary);
}

export function getSavingsBalanceAdjustmentAmount(
  reportedBalance: number,
  balanceAtDate: number
) {
  return reportedBalance - balanceAtDate;
}
import {
  isMovementCoveredByBalanceSnapshot,
  type BalanceSnapshotBoundary,
} from './balance-snapshot.ts';
