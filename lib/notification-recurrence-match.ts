import type { RecurringDecisionItem, RecurringMovementKind } from '@/lib/types';

type DetectedMovementForMatching = {
  amount: number;
  occurredAt: number;
  suggestedType: 'expense' | 'income' | 'card-payment' | 'transfer';
};

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function candidateRecurringKind(
  candidate: DetectedMovementForMatching
): RecurringMovementKind | null {
  if (candidate.suggestedType === 'expense') return 'expense';
  if (candidate.suggestedType === 'income') return 'income';
  return null;
}

export function findPendingRecurringMatches(
  candidate: DetectedMovementForMatching,
  decisions: readonly RecurringDecisionItem[]
): RecurringDecisionItem[] {
  const kind = candidateRecurringKind(candidate);
  if (kind == null) return [];
  const occurredDate = localDateKey(candidate.occurredAt);
  return decisions.filter((decision) =>
    decision.status === 'pending'
      && decision.kind === kind
      && decision.scheduledDate === occurredDate
      && decision.amount === candidate.amount
  );
}
