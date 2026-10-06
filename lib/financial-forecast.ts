import type { FinancialForecastItem } from './types';

export type FinancialForecastGroups = {
  overdue: FinancialForecastItem[];
  today: FinancialForecastItem[];
  soon: FinancialForecastItem[];
  later: FinancialForecastItem[];
};

export function getForecastMonthEnd(referenceDate: string): string {
  const [year, month] = referenceDate.split('-').map(Number);
  const lastDay = new Date(year, month, 0, 12).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

export function groupFinancialForecastItems(
  items: FinancialForecastItem[],
  referenceDate: string
): FinancialForecastGroups {
  const reference = new Date(`${referenceDate}T12:00:00`);
  reference.setDate(reference.getDate() + 7);
  const soonThrough = [
    reference.getFullYear(),
    String(reference.getMonth() + 1).padStart(2, '0'),
    String(reference.getDate()).padStart(2, '0'),
  ].join('-');
  return {
    overdue: items.filter((item) => item.date < referenceDate),
    today: items.filter((item) => item.date === referenceDate),
    soon: items.filter((item) => item.date > referenceDate && item.date <= soonThrough),
    later: items.filter((item) => item.date > soonThrough),
  };
}

export function summarizeFinancialForecast(items: FinancialForecastItem[]): {
  projectedIncome: number;
  projectedOutflow: number;
  projectedNet: number;
} {
  const projectedIncome = items
    .filter((item) => item.kind === 'income' || item.kind === 'receivable')
    .reduce((sum, item) => sum + item.amount, 0);
  const projectedOutflow = items
    .filter((item) => item.kind !== 'income' && item.kind !== 'receivable')
    .reduce((sum, item) => sum + item.amount, 0);
  return { projectedIncome, projectedOutflow, projectedNet: projectedIncome - projectedOutflow };
}
