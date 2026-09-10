export function calculateAvailableBalance(
  reportedBalance: number,
  chargesAfterSnapshot: number,
  paymentsAfterSnapshot: number,
  installmentPurchasesAfterSnapshot = 0
) {
  return reportedBalance
    - chargesAfterSnapshot
    - installmentPurchasesAfterSnapshot
    + paymentsAfterSnapshot;
}

export function getEstimatedPaymentDueDate(statementDate: string, dueDay: number) {
  const statement = new Date(`${statementDate}T12:00:00`);
  const year = statement.getFullYear();
  const statementMonth = statement.getMonth();
  const targetMonth = dueDay > statement.getDate() ? statementMonth : statementMonth + 1;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  return new Date(year, targetMonth, Math.min(dueDay, lastDay), 12);
}
