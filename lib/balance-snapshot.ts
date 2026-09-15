export type BalanceSnapshotBoundary = {
  date: string;
  movementAnchorId: number;
} | null;

export function resolveBalanceTrackingStartDate(creationDate: string) {
  return creationDate;
}

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

export function paymentMethodAfterSnapshotSql(
  dateExpr: string,
  idExpr: string,
  anchorColumn: string
) {
  return `(method.balance_updated_at IS NULL
    OR ${dateExpr} > method.balance_updated_at
    OR (${dateExpr} = method.balance_updated_at AND ${idExpr} > method.${anchorColumn}))`;
}
