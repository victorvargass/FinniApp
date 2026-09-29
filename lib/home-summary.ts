export const UNBILLED_CREDIT_CARD_TOTAL_SQL = `
  SELECT COALESCE(SUM(MAX(0,
    COALESCE((SELECT SUM(COALESCE(expense.original_amount, expense.amount))
      FROM expenses expense
      WHERE expense.payment_method_id = method.id
        AND expense.debt_plan_id IS NULL
        AND expense.credit_payment_target_id IS NULL
        AND expense.date <= DATE('now', 'localtime')
        AND expense.date > COALESCE((SELECT MAX(cycle.end_date)
          FROM credit_card_cycles cycle
          WHERE cycle.payment_method_id = method.id), '0000-01-01')), 0)
    - COALESCE((SELECT SUM(adjustment.amount)
      FROM credit_card_adjustments adjustment
      WHERE adjustment.payment_method_id = method.id
        AND adjustment.date <= DATE('now', 'localtime')
        AND adjustment.date > COALESCE((SELECT MAX(cycle.end_date)
          FROM credit_card_cycles cycle
          WHERE cycle.payment_method_id = method.id), '0000-01-01')), 0)
  )), 0) AS total
  FROM payment_methods method
  WHERE method.active = 1 AND method.show_on_home = 1 AND method.type = 'credit'
`;
