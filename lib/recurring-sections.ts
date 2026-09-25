import type { RecurringExpense } from './types';

type RecurringSavingsFields = Pick<RecurringExpense, 'savingsGoalId' | 'savingsKind'>;

export function isRecurringSavingsContribution(item: RecurringSavingsFields): boolean {
  return item.savingsGoalId != null && item.savingsKind === 'contribution';
}

export function getRecurringExpensesForSection(
  items: RecurringExpense[],
  section: 'expenses' | 'savings'
): RecurringExpense[] {
  return items.filter((item) =>
    section === 'savings'
      ? isRecurringSavingsContribution(item)
      : !isRecurringSavingsContribution(item)
  );
}
