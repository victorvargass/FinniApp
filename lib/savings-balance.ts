import {
  isMovementCoveredByBalanceSnapshot,
  resolveBalanceTrackingStartDate,
  type BalanceSnapshotBoundary,
} from './balance-snapshot.ts';

export function resolveSavingsBalanceStartDate(
  creationDate: string
) {
  return resolveBalanceTrackingStartDate(creationDate);
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
