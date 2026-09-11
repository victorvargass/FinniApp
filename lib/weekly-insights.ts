import type { ExpenseWithCategory, Income, SavingsGoalPeriodActivity } from './types';

export type WeeklyInsight = {
  expenseTotal: number;
  incomeTotal: number;
  previousExpenseTotal: number;
  expenseChangePercent: number | null;
  topCategoryName: string | null;
  topCategoryAmount: number;
};

function addUtcDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isBetween(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

export function buildWeeklyInsight(
  expenses: ExpenseWithCategory[],
  incomes: Income[],
  referenceDate: string
): WeeklyInsight {
  const currentStart = addUtcDays(referenceDate, -6);
  const previousStart = addUtcDays(referenceDate, -13);
  const previousEnd = addUtcDays(referenceDate, -7);
  const currentExpenses = expenses.filter((item) => isBetween(item.date, currentStart, referenceDate));
  const currentIncomes = incomes.filter((item) => isBetween(item.date, currentStart, referenceDate));
  const previousExpenses = expenses.filter((item) => isBetween(item.date, previousStart, previousEnd));
  const expenseTotal = currentExpenses.reduce((sum, item) => sum + item.amount, 0);
  const incomeTotal = currentIncomes.reduce((sum, item) => sum + item.amount, 0);
  const previousExpenseTotal = previousExpenses.reduce((sum, item) => sum + item.amount, 0);
  const categories = new Map<string, number>();

  currentExpenses.forEach((item) => {
    const name = item.categoryName ?? '';
    if (!name) return;
    categories.set(name, (categories.get(name) ?? 0) + item.amount);
  });

  const [topCategoryName, topCategoryAmount] = [...categories.entries()]
    .sort((first, second) => second[1] - first[1])[0] ?? [null, 0];
  const expenseChangePercent = previousExpenseTotal > 0
    ? Math.round(((expenseTotal - previousExpenseTotal) / previousExpenseTotal) * 100)
    : null;

  return {
    expenseTotal,
    incomeTotal,
    previousExpenseTotal,
    expenseChangePercent,
    topCategoryName,
    topCategoryAmount,
  };
}

export function findSavingsMilestone(items: SavingsGoalPeriodActivity[]) {
  return items
    .filter((item) => item.targetAmount > 0)
    .map((item) => {
      const progress = Math.max(0, Math.min(100, (item.closingAmount / item.targetAmount) * 100));
      const milestone = [100, 75, 50, 25].find((value) => progress >= value) ?? 0;
      return { name: item.goalName, milestone, progress };
    })
    .filter((item) => item.milestone > 0)
    .sort((first, second) => second.milestone - first.milestone)[0] ?? null;
}
