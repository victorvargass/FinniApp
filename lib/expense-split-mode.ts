import type { ExpenseSplitMode } from './types';

// Older expenses only stored a derived percentage. The percentage input allowed
// six characters, while amounts were converted to a six-decimal percentage.
export function resolveExpenseSplitMode(
  savedMode: ExpenseSplitMode | null,
  splitPercentage: number | null
): ExpenseSplitMode {
  if (savedMode === 'amount' || savedMode === 'percentage') return savedMode;
  return splitPercentage != null && String(splitPercentage).length > 6 ? 'amount' : 'percentage';
}
