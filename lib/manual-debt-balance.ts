export const MANUAL_DEBT_BALANCE_AT_DATE_SQL = `WITH snapshot AS (
  SELECT * FROM manual_debt_entries
  WHERE debt_id = ? AND kind = 'adjustment' AND reported_balance IS NOT NULL AND date <= ?
    AND date >= COALESCE((
      SELECT balance_updated_at FROM manual_debts WHERE id = ?
    ), '0000-00-00')
  ORDER BY date DESC, id DESC LIMIT 1
)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM snapshot) THEN (SELECT reported_balance FROM snapshot)
    WHEN d.balance_updated_at IS NULL OR d.balance_updated_at <= ? THEN d.initial_amount
    ELSE 0
  END
  + CASE WHEN NOT EXISTS (SELECT 1 FROM snapshot) THEN COALESCE(SUM(CASE
      WHEN entry.kind = 'adjustment' AND entry.date <= ?
        AND (d.balance_updated_at IS NULL OR ? < d.balance_updated_at
          OR entry.date > d.balance_updated_at
          OR (entry.date = d.balance_updated_at AND entry.id > d.balance_payment_anchor_id))
      THEN entry.amount ELSE 0 END), 0) ELSE 0 END
  - COALESCE(SUM(CASE WHEN entry.kind = 'payment' AND entry.date <= ?
      AND (EXISTS (SELECT 1 FROM snapshot) AND (entry.date > (SELECT date FROM snapshot)
        OR (entry.date = (SELECT date FROM snapshot) AND entry.id > (SELECT payment_anchor_id FROM snapshot)))
        OR NOT EXISTS (SELECT 1 FROM snapshot) AND (d.balance_updated_at IS NULL OR ? < d.balance_updated_at
          OR entry.date > d.balance_updated_at
          OR (entry.date = d.balance_updated_at AND entry.id > d.balance_payment_anchor_id)))
      THEN entry.amount ELSE 0 END), 0) AS balance
FROM manual_debts d LEFT JOIN manual_debt_entries entry ON entry.debt_id = d.id
WHERE d.id = ? GROUP BY d.id`;

export function manualDebtBalanceAtDateParams(id: number, throughDate: string) {
  return [
    id,
    throughDate,
    id,
    throughDate,
    throughDate,
    throughDate,
    throughDate,
    throughDate,
    id,
  ] as const;
}
