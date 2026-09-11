import type { PeriodHistoryCategory } from './types';

export type PeriodCloseInsights = {
  balanceStatus: 'positive' | 'negative' | 'even';
  comparisonStatus: 'first' | 'less' | 'more' | 'same';
  comparisonPercent: number | null;
  topCategoryName: string | null;
  topCategoryAmount: number;
};

export function buildPeriodCloseInsights(
  balance: number,
  expenseTotal: number,
  categories: PeriodHistoryCategory[],
  previousExpenseTotal: number | null
): PeriodCloseInsights {
  const balanceStatus = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'even';
  const changePercent = previousExpenseTotal != null && previousExpenseTotal > 0
    ? Math.round(((expenseTotal - previousExpenseTotal) / previousExpenseTotal) * 100)
    : null;
  const comparisonStatus = changePercent == null
    ? 'first'
    : changePercent < 0
      ? 'less'
      : changePercent > 0
        ? 'more'
        : 'same';
  const topCategory = [...categories].sort((first, second) => second.total - first.total)[0];

  return {
    balanceStatus,
    comparisonStatus,
    comparisonPercent: changePercent == null ? null : Math.abs(changePercent),
    topCategoryName: topCategory?.categoryName ?? null,
    topCategoryAmount: topCategory?.total ?? 0,
  };
}
