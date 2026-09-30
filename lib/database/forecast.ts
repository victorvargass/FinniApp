import { getDebts } from './debts';
import { getDatabase } from '@/lib/database/connection';
import { spendingExpenseSql } from '@/lib/movement-classification';
import { summarizeFinancialForecast } from '@/lib/financial-forecast';
import type { BudgetForecast, BudgetForecastCategory, FinancialForecastItem } from '@/lib/types';

type ForecastRow = {
  id: string;
  kind: FinancialForecastItem['kind'];
  name: string;
  amount: number;
  date: string;
};

export async function getBudgetForecast(periodId: number, referenceDate: string): Promise<BudgetForecast> {
  const database = await getDatabase();
  const period = await database.getFirstAsync<{ start_date: string; end_date: string }>(
    'SELECT start_date, end_date FROM periods WHERE id = ?', periodId
  );
  if (!period) return { categories: [], items: [], projectedIncome: 0, projectedOutflow: 0, projectedNet: 0 };

  const [categoryRows, forecastRows, debts] = await Promise.all([
    database.getAllAsync<BudgetForecastCategory>(
      `SELECT category.id AS categoryId, category.name, category.color,
              category.period_limit AS 'limit', COALESCE(SUM(expense.amount), 0) AS spent
       FROM categories category
       LEFT JOIN expenses expense ON expense.category_id = category.id
         AND expense.period_id = ? AND ${spendingExpenseSql('expense')}
       WHERE category.period_limit IS NOT NULL AND category.period_limit > 0
       GROUP BY category.id
       ORDER BY CAST(COALESCE(SUM(expense.amount), 0) AS REAL) / category.period_limit DESC,
                category.name COLLATE NOCASE`,
      periodId
    ),
    database.getAllAsync<ForecastRow>(
      `SELECT 'expense-' || occurrence.id AS id, 'expense' AS kind, recurring.name,
              recurring.amount, occurrence.scheduled_date AS date
       FROM recurring_expense_occurrences occurrence
       INNER JOIN recurring_expenses recurring ON recurring.id = occurrence.recurring_expense_id
       WHERE occurrence.status IN ('scheduled', 'pending')
         AND occurrence.scheduled_date > ? AND occurrence.scheduled_date <= ?
       UNION ALL
       SELECT 'income-' || occurrence.id, 'income', recurring.name,
              recurring.amount, occurrence.scheduled_date
       FROM recurring_income_occurrences occurrence
       INNER JOIN recurring_incomes recurring ON recurring.id = occurrence.recurring_income_id
       WHERE occurrence.status IN ('scheduled', 'pending')
         AND occurrence.scheduled_date > ? AND occurrence.scheduled_date <= ?
       UNION ALL
       SELECT 'installment-' || installment.id, 'installment', plan.name,
              installment.projected_amount, installment.due_date
       FROM debt_installments installment
       INNER JOIN debt_plans plan ON plan.id = installment.debt_plan_id
       WHERE installment.status = 'projected' AND plan.status IN ('projected', 'active')
         AND installment.due_date > ? AND installment.due_date <= ?
       ORDER BY date, kind, name COLLATE NOCASE`,
      referenceDate, period.end_date,
      referenceDate, period.end_date,
      referenceDate, period.end_date
    ),
    getDebts(),
  ]);

  const categories = categoryRows.map((row) => ({
    ...row,
    categoryId: Number(row.categoryId), limit: Number(row.limit), spent: Number(row.spent),
  }));
  const debtItems: FinancialForecastItem[] = debts
    .filter((debt) => debt.direction === 'payable' && debt.status === 'active'
      && debt.currentBalance > 0 && debt.nextDueDate != null
      && debt.nextDueDate > referenceDate && debt.nextDueDate <= period.end_date)
    .map((debt) => ({
      id: `debt-${debt.id}`, kind: 'debt', name: debt.name,
      amount: Math.min(debt.currentBalance, debt.installmentAmount ?? debt.currentBalance),
      date: debt.nextDueDate!,
    }));
  const items = [
    ...forecastRows.map((row) => ({ ...row, amount: Number(row.amount) })),
    ...debtItems,
  ].sort((first, second) => first.date.localeCompare(second.date) || first.name.localeCompare(second.name));
  return { categories, items, ...summarizeFinancialForecast(items) };
}
