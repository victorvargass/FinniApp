import { getDebts } from './debts';
import { getPaymentMethods } from './payment-methods';
import { getDatabase } from '@/lib/database/connection';
import { clpSpendingExpenseSql } from '@/lib/movement-classification';
import { getForecastMonthEnd, summarizeFinancialForecast } from '@/lib/financial-forecast';
import { getEstimatedPaymentDueDate } from '@/lib/payment-method-calculations';
import { getOccurrenceDates, toIsoDate } from '@/lib/recurrence';
import type { BudgetForecast, BudgetForecastCategory, FinancialForecastItem } from '@/lib/types';

type ForecastRow = {
  id: string;
  kind: FinancialForecastItem['kind'];
  name: string;
  amount: number;
  date: string;
};

type RecurringRuleRow = {
  id: number;
  name: string;
  amount: number;
  active: number;
  frequency: 'weekly' | 'monthly' | 'annual' | 'custom';
  interval_months: number;
  execution_day: number | null;
  start_date: string;
  end_date: string | null;
};

type OccurrenceRow = {
  recurring_id: number;
  scheduled_date: string;
  status: 'scheduled' | 'pending' | 'generated' | 'skipped';
};

function recurringForecastItems(
  kind: 'expense' | 'income',
  rules: RecurringRuleRow[],
  occurrences: OccurrenceRow[],
  referenceDate: string,
  monthEnd: string
): FinancialForecastItem[] {
  const items = new Map<string, FinancialForecastItem>();
  const statusesByRule = new Map<number, Map<string, OccurrenceRow['status']>>();
  for (const occurrence of occurrences) {
    const statuses = statusesByRule.get(occurrence.recurring_id) ?? new Map();
    statuses.set(occurrence.scheduled_date, occurrence.status);
    statusesByRule.set(occurrence.recurring_id, statuses);
  }

  for (const rule of rules) {
    const statuses = statusesByRule.get(rule.id) ?? new Map();
    for (const [scheduledDate, status] of statuses) {
      if ((status === 'scheduled' || status === 'pending') && scheduledDate <= monthEnd) {
        items.set(`${kind}-${rule.id}-${scheduledDate}`, {
          id: `${kind}-${rule.id}-${scheduledDate}`,
          kind,
          name: rule.name,
          amount: Number(rule.amount),
          date: scheduledDate,
        });
      }
    }
    if (Number(rule.active) !== 1) continue;
    for (const scheduledDate of getOccurrenceDates({
      frequency: rule.frequency,
      intervalMonths: Number(rule.interval_months),
      executionDay: rule.execution_day == null ? null : Number(rule.execution_day),
      startDate: rule.start_date,
      endDate: rule.end_date,
    }, referenceDate, monthEnd, 100)) {
      if (statuses.get(scheduledDate) === 'generated' || statuses.get(scheduledDate) === 'skipped') continue;
      items.set(`${kind}-${rule.id}-${scheduledDate}`, {
        id: `${kind}-${rule.id}-${scheduledDate}`,
        kind,
        name: rule.name,
        amount: Number(rule.amount),
        date: scheduledDate,
      });
    }
  }
  return [...items.values()];
}

export async function getBudgetForecast(periodId: number, referenceDate: string): Promise<BudgetForecast> {
  const database = await getDatabase();
  const period = await database.getFirstAsync<{ start_date: string; end_date: string }>('SELECT start_date, end_date FROM periods WHERE id = ?', periodId);
  if (!period) return { categories: [], items: [], projectedIncome: 0, projectedOutflow: 0, projectedNet: 0 };
  const monthEnd = getForecastMonthEnd(referenceDate);

  const [categoryRows, installmentRows, expenseRules, incomeRules, expenseOccurrences, incomeOccurrences, debts, paymentMethods] = await Promise.all([
    database.getAllAsync<BudgetForecastCategory>(
      `SELECT category.id AS categoryId, category.name, category.color,
              category.period_limit AS 'limit', COALESCE(SUM(expense.amount), 0) AS spent
       FROM categories category
       LEFT JOIN expenses expense ON expense.category_id = category.id
         AND expense.period_id = ? AND ${clpSpendingExpenseSql('expense')}
       WHERE category.period_limit IS NOT NULL AND category.period_limit > 0
       GROUP BY category.id
       ORDER BY CAST(COALESCE(SUM(expense.amount), 0) AS REAL) / category.period_limit DESC,
                category.name COLLATE NOCASE`,
      periodId
    ),
    database.getAllAsync<ForecastRow>(
      `SELECT 'installment-' || installment.id AS id, 'installment' AS kind, plan.name,
              installment.projected_amount, installment.due_date
       FROM debt_installments installment
       INNER JOIN debt_plans plan ON plan.id = installment.debt_plan_id
       WHERE installment.status = 'projected' AND plan.status IN ('projected', 'active')
         AND installment.due_date <= ?
       ORDER BY date, kind, name COLLATE NOCASE`,
      monthEnd
    ),
    database.getAllAsync<RecurringRuleRow>(
      `SELECT id, name, amount, active, frequency, interval_months, execution_day, start_date, end_date
       FROM recurring_expenses`
    ),
    database.getAllAsync<RecurringRuleRow>(
      `SELECT id, name, amount, active, frequency, interval_months, execution_day, start_date, end_date
       FROM recurring_incomes`
    ),
    database.getAllAsync<OccurrenceRow>(
      `SELECT recurring_expense_id AS recurring_id, scheduled_date, status
       FROM recurring_expense_occurrences WHERE scheduled_date <= ?`, monthEnd
    ),
    database.getAllAsync<OccurrenceRow>(
      `SELECT recurring_income_id AS recurring_id, scheduled_date, status
       FROM recurring_income_occurrences WHERE scheduled_date <= ?`, monthEnd
    ),
    getDebts(),
    getPaymentMethods(true),
  ]);

  const categories = categoryRows.map((row) => ({
    ...row,
    categoryId: Number(row.categoryId), limit: Number(row.limit), spent: Number(row.spent),
  }));
  const debtItems: FinancialForecastItem[] = debts
    .filter((debt) => debt.status === 'active'
      && debt.currentBalance > 0 && debt.nextDueDate != null
      && debt.nextDueDate <= monthEnd)
    .map((debt) => ({
      id: `debt-${debt.id}`,
      kind: debt.direction === 'receivable' ? 'receivable' : 'debt',
      name: debt.name,
      amount: Math.min(debt.currentBalance, debt.installmentAmount ?? debt.currentBalance),
      date: debt.nextDueDate!,
    }));
  const billedItems: FinancialForecastItem[] = paymentMethods
    .filter((method) => method.type === 'credit' && method.billedAmount > 0
      && method.statementDate != null && method.paymentDueDay != null)
    .map((method) => ({
      method,
      dueDate: toIsoDate(getEstimatedPaymentDueDate(method.statementDate!, method.paymentDueDay!)),
    }))
    .filter(({ dueDate }) => dueDate <= monthEnd)
    .map(({ method, dueDate }) => ({
      id: `billed-${method.id}`,
      kind: 'billed',
      name: method.name,
      amount: method.billedAmount,
      date: dueDate,
    }));
  const items = [
    ...recurringForecastItems('expense', expenseRules, expenseOccurrences, referenceDate, monthEnd),
    ...recurringForecastItems('income', incomeRules, incomeOccurrences, referenceDate, monthEnd),
    ...installmentRows.map((row) => ({ ...row, amount: Number(row.amount) })),
    ...debtItems,
    ...billedItems,
  ].sort((first, second) => first.date.localeCompare(second.date) || first.name.localeCompare(second.name));
  return { categories, items, ...summarizeFinancialForecast(items) };
}
