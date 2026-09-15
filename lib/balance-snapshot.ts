export type BalanceSnapshotBoundary = {
  date: string;
  movementAnchorId: number;
} | null;

export function isMovementCoveredByBalanceSnapshot(
  movementDate: string,
  movementId: number | undefined,
  boundary: BalanceSnapshotBoundary
): boolean {
  if (!boundary) return false;
  if (movementDate < boundary.date) return true;
  return movementDate === boundary.date
    && movementId != null
    && movementId <= boundary.movementAnchorId;
}
