type MigrationDatabase = {
  getAllAsync<T>(source: string): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: (string | number)[]): Promise<T | null>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<{ lastInsertRowId: number }>;
};

/** Rebalance automatic billing differences created before split purchases charged the full card amount. */
export async function reconcileLegacySplitCardCycles(
  database: MigrationDatabase,
  billingDifferenceName: string
): Promise<void> {
  const cycles = await database.getAllAsync<{
    id: number;
    payment_method_id: number;
    end_date: string;
    adjustment_expense_id: number | null;
    split_delta: number;
  }>(`
    SELECT cycle.id, cycle.payment_method_id, cycle.end_date, cycle.adjustment_expense_id,
      COALESCE((
        SELECT SUM(expense.original_amount - expense.amount)
        FROM expenses expense
        WHERE expense.payment_method_id = cycle.payment_method_id
          AND expense.date BETWEEN cycle.start_date AND cycle.end_date
          AND expense.original_amount IS NOT NULL
      ), 0) AS split_delta
    FROM credit_card_cycles cycle
    WHERE cycle.status = 'reconciled' AND cycle.statement_amount IS NOT NULL
  `);

  for (const cycle of cycles) {
    const difference = Number(cycle.split_delta);
    if (difference === 0) continue;

    if (cycle.adjustment_expense_id != null) {
      const adjustment = await database.getFirstAsync<{ amount: number }>(
        'SELECT amount FROM expenses WHERE id = ?', cycle.adjustment_expense_id
      );
      if (!adjustment) throw new Error('Missing reconciled card adjustment');
      const nextAmount = Number(adjustment.amount) - difference;
      if (nextAmount === 0) {
        await database.runAsync(
          'UPDATE credit_card_cycles SET adjustment_expense_id = NULL WHERE id = ?', cycle.id
        );
        await database.runAsync('DELETE FROM expenses WHERE id = ?', cycle.adjustment_expense_id);
      } else {
        await database.runAsync(
          'UPDATE expenses SET amount = ? WHERE id = ?', nextAmount, cycle.adjustment_expense_id
        );
      }
      continue;
    }

    const period = await database.getFirstAsync<{ id: number }>(
      'SELECT id FROM periods WHERE start_date <= ? AND end_date >= ? ORDER BY start_date DESC LIMIT 1',
      cycle.end_date, cycle.end_date
    );
    if (!period) throw new Error('Missing billing period for reconciled card cycle');
    const result = await database.runAsync(
      `INSERT INTO expenses
        (name, amount, category_id, period_id, date, original_amount, split_percentage,
         payment_method_id, recurring_expense_id)
       VALUES (?, ?, NULL, ?, ?, NULL, NULL, ?, NULL)`,
      billingDifferenceName, -difference, period.id, cycle.end_date, cycle.payment_method_id
    );
    await database.runAsync(
      'UPDATE credit_card_cycles SET adjustment_expense_id = ? WHERE id = ?', result.lastInsertRowId, cycle.id
    );
  }
}
