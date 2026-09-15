export function resolveSavingsBalanceStartDate(
  registrationDate: string
) {
  return registrationDate;
}

export function getSavingsBalanceAdjustmentAmount(
  reportedBalance: number,
  balanceAtDate: number
) {
  return reportedBalance - balanceAtDate;
}
