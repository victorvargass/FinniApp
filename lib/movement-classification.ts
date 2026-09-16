export function isSpendingExpense(expense: { creditPaymentTargetId: number | null }): boolean {
  return expense.creditPaymentTargetId == null;
}

export function spendingExpenseSql(tableAlias?: string): string {
  if (tableAlias && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableAlias)) {
    throw new Error('Invalid SQL table alias');
  }
  return `${tableAlias ? `${tableAlias}.` : ''}credit_payment_target_id IS NULL`;
}
