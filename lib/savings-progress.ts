import type { SavingsGoalMovement } from './types';

export type SavingsProgressPoint = {
  id: string;
  date: string;
  balance: number;
};

function movementOccursAfterSnapshot(
  movement: SavingsGoalMovement,
  balanceDate: string,
  balanceTime: string
) {
  return movement.date > balanceDate
    || (movement.date === balanceDate && movement.time > balanceTime);
}

export function buildSavingsProgressSeries(
  initialAmount: number,
  balanceDate: string,
  balanceTime: string | null | undefined,
  movements: SavingsGoalMovement[],
  currentAmount: number
): SavingsProgressPoint[] {
  const effectiveBalanceTime = balanceTime ?? '00:00';
  const chronological = movements
    .filter((movement) => movementOccursAfterSnapshot(
      movement,
      balanceDate,
      effectiveBalanceTime
    ))
    .sort((first, second) => first.date.localeCompare(second.date)
      || first.time.localeCompare(second.time)
      || Math.abs(first.id) - Math.abs(second.id));
  let balance = initialAmount;
  const points: SavingsProgressPoint[] = [{
    id: 'starting-balance',
    date: balanceDate,
    balance,
  }];

  for (const movement of chronological) {
    if (movement.kind === 'adjustment' && movement.reportedBalance != null) {
      balance = movement.reportedBalance;
    } else if (movement.kind === 'contribution') {
      balance += Math.abs(movement.amount);
    } else {
      balance -= Math.abs(movement.amount);
    }
    balance = Math.max(0, balance);
    points.push({
      id: `${movement.kind}-${movement.id}`,
      date: movement.date,
      balance,
    });
  }

  if (points.at(-1)?.balance !== currentAmount) {
    points.push({
      id: 'current-balance',
      date: chronological.at(-1)?.date ?? balanceDate,
      balance: currentAmount,
    });
  }
  return points;
}
