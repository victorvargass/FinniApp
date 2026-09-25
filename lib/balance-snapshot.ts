export type BalanceSnapshotBoundary = {
  date: string;
  time?: string | null;
  movementAnchorId: number;
} | null;

export function resolveBalanceTrackingStartDate(balanceDate: string) {
  return balanceDate;
}

export function isMovementCoveredByBalanceSnapshot(
  movementDate: string,
  movementId: number | undefined,
  boundary: BalanceSnapshotBoundary,
  movementTime?: string
): boolean {
  if (!boundary) return false;
  if (movementDate < boundary.date) return true;
  if (movementDate > boundary.date) return false;
  if (boundary.time != null && movementTime != null) {
    if (movementTime < boundary.time) return true;
    if (movementTime > boundary.time) return false;
  }
  return movementId != null && movementId <= boundary.movementAnchorId;
}

export function paymentMethodAfterSnapshotSql(
  dateExpr: string,
  idExpr: string,
  anchorColumn: string,
  timeExpr?: string
) {
  const legacyBoundary = `${dateExpr} > method.balance_updated_at
    OR (${dateExpr} = method.balance_updated_at AND ${idExpr} > method.${anchorColumn})`;
  if (!timeExpr) {
    return `(method.balance_updated_at IS NULL OR ${legacyBoundary})`;
  }
  return `(method.balance_updated_at IS NULL
    OR (method.balance_updated_time IS NULL AND (${legacyBoundary}))
    OR (method.balance_updated_time IS NOT NULL AND (
      ${dateExpr} > method.balance_updated_at
      OR (${dateExpr} = method.balance_updated_at AND ${timeExpr} > method.balance_updated_time)
      OR (${dateExpr} = method.balance_updated_at AND ${timeExpr} = method.balance_updated_time
        AND ${idExpr} > method.${anchorColumn})
    )))`;
}
