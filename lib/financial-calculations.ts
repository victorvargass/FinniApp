export function calculateInstallmentAmounts(totalAmount: number, count: number): number[] {
  if (!Number.isSafeInteger(totalAmount) || totalAmount <= 0) {
    throw new RangeError('totalAmount must be a positive safe integer');
  }
  if (!Number.isSafeInteger(count) || count <= 0) {
    throw new RangeError('count must be a positive safe integer');
  }

  const regularAmount = Math.floor(totalAmount / count);
  const values = Array.from({ length: count }, () => regularAmount);
  let remainder = totalAmount - regularAmount * count;
  for (let index = count - 1; index >= 0 && remainder > 0; index -= 1) {
    values[index] += 1;
    remainder -= 1;
  }
  return values;
}

export function calculateNextPeriodDates(currentEndDate: string): {
  startDate: string;
  endDate: string;
} {
  const currentEnd = new Date(`${currentEndDate}T12:00:00`);
  if (Number.isNaN(currentEnd.getTime())) throw new RangeError('Invalid period end date');

  const nextStart = new Date(currentEnd);
  nextStart.setDate(nextStart.getDate() + 1);
  const nextEnd = new Date(nextStart);
  nextEnd.setMonth(nextEnd.getMonth() + 1);

  return {
    startDate: nextStart.toISOString().split('T')[0],
    endDate: nextEnd.toISOString().split('T')[0],
  };
}
