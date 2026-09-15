export function resolveSavingsBalanceStartDate(
  initialAmount: number,
  creationDate: string,
  registrationDate: string
) {
  return initialAmount === 0 ? creationDate : registrationDate;
}
