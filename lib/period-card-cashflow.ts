export type PeriodCardCashflow = {
  paymentsFromAccounts: number;
  internalAdjustments: number;
};

export const PERIOD_CARD_PAYMENTS_SQL = `
  SELECT period_id AS periodId, SUM(amount) AS total
  FROM expenses
  WHERE credit_payment_target_id IS NOT NULL
  GROUP BY period_id
`;

export const PERIOD_CARD_ADJUSTMENTS_SQL = `
  SELECT period.id AS periodId, SUM(adjustment.amount) AS total
  FROM credit_card_adjustments adjustment
  INNER JOIN periods period
    ON adjustment.date BETWEEN period.start_date AND period.end_date
  GROUP BY period.id
`;

export function calculatePeriodAvailable(
  incomes: number,
  expenses: number,
  releasedSavings: number,
  cardCashflow: PeriodCardCashflow
): number {
  return incomes + releasedSavings - expenses
    - cardCashflow.paymentsFromAccounts + cardCashflow.internalAdjustments;
}
