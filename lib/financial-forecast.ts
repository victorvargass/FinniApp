import type { FinancialForecastItem } from './types';

export function summarizeFinancialForecast(items: FinancialForecastItem[]): {
  projectedIncome: number;
  projectedOutflow: number;
  projectedNet: number;
} {
  const projectedIncome = items
    .filter((item) => item.kind === 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  const projectedOutflow = items
    .filter((item) => item.kind !== 'income')
    .reduce((sum, item) => sum + item.amount, 0);
  return { projectedIncome, projectedOutflow, projectedNet: projectedIncome - projectedOutflow };
}
