import type {
  PeriodHistory,
  PeriodHistoryCategory,
  PeriodHistoryPaymentMethod,
} from './types';

export type HistoricalReportPeriod = PeriodHistory & {
  expenseTotal: number;
  cashflow: number;
};

export type HistoricalReport = {
  periods: HistoricalReportPeriod[];
  incomeTotal: number;
  expenseTotal: number;
  cashflowTotal: number;
  averageExpense: number;
  savingsContributionTotal: number;
  savingsWithdrawalTotal: number;
  savingsRate: number | null;
  debtPaymentsTotal: number;
  debtCollectionsTotal: number;
  cardPaymentsTotal: number;
  categories: PeriodHistoryCategory[];
  paymentMethods: PeriodHistoryPaymentMethod[];
  topCategory: PeriodHistoryCategory | null;
  bestPeriod: HistoricalReportPeriod | null;
  latestExpenseChangePercent: number | null;
  latestIncomeChangePercent: number | null;
};

function percentageChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function getPeriodExpenseTotal(period: PeriodHistory): number {
  return period.categories.reduce((total, category) => total + category.total, 0);
}

export function getPeriodCashflow(period: PeriodHistory): number {
  return period.incomesTotal + period.savingsWithdrawalTotal - getPeriodExpenseTotal(period);
}

export function buildHistoricalReport(source: readonly PeriodHistory[]): HistoricalReport {
  const periods = [...source]
    .sort((first, second) => first.startDate.localeCompare(second.startDate))
    .map((period) => ({
      ...period,
      expenseTotal: getPeriodExpenseTotal(period),
      cashflow: getPeriodCashflow(period),
    }));

  const categoryMap = new Map<string, PeriodHistoryCategory>();
  const paymentMethodMap = new Map<string, PeriodHistoryPaymentMethod>();

  for (const period of periods) {
    for (const category of period.categories) {
      const key = category.categoryId == null ? 'none' : String(category.categoryId);
      const existing = categoryMap.get(key);
      categoryMap.set(key, {
        ...category,
        periodLimit: null,
        total: (existing?.total ?? 0) + category.total,
      });
    }
    for (const method of period.paymentMethods) {
      const key = method.paymentMethodId == null ? 'none' : String(method.paymentMethodId);
      const existing = paymentMethodMap.get(key);
      paymentMethodMap.set(key, {
        ...method,
        total: (existing?.total ?? 0) + method.total,
      });
    }
  }

  const categories = [...categoryMap.values()].sort((a, b) => b.total - a.total);
  const paymentMethods = [...paymentMethodMap.values()].sort((a, b) => b.total - a.total);
  const incomeTotal = periods.reduce((total, period) => total + period.incomesTotal, 0);
  const expenseTotal = periods.reduce((total, period) => total + period.expenseTotal, 0);
  const savingsContributionTotal = periods.reduce(
    (total, period) => total + period.savingsContributionTotal,
    0
  );
  const savingsWithdrawalTotal = periods.reduce(
    (total, period) => total + period.savingsWithdrawalTotal,
    0
  );
  const latest = periods.at(-1);
  const previous = periods.at(-2);

  return {
    periods,
    incomeTotal,
    expenseTotal,
    cashflowTotal: incomeTotal + savingsWithdrawalTotal - expenseTotal,
    averageExpense: periods.length > 0 ? Math.round(expenseTotal / periods.length) : 0,
    savingsContributionTotal,
    savingsWithdrawalTotal,
    savingsRate: incomeTotal > 0 ? Math.round((savingsContributionTotal / incomeTotal) * 100) : null,
    debtPaymentsTotal: periods.reduce((total, period) => total + period.debtPaymentsTotal, 0),
    debtCollectionsTotal: periods.reduce((total, period) => total + period.debtCollectionsTotal, 0),
    cardPaymentsTotal: periods.reduce(
      (total, period) => total + period.cardPaymentsFromAccountsTotal,
      0
    ),
    categories,
    paymentMethods,
    topCategory: categories[0] ?? null,
    bestPeriod: periods.reduce<HistoricalReportPeriod | null>(
      (best, period) => !best || period.cashflow > best.cashflow ? period : best,
      null
    ),
    latestExpenseChangePercent: latest && previous
      ? percentageChange(latest.expenseTotal, previous.expenseTotal)
      : null,
    latestIncomeChangePercent: latest && previous
      ? percentageChange(latest.incomesTotal, previous.incomesTotal)
      : null,
  };
}
