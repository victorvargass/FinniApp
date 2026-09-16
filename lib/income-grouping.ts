import type { Income } from './types';

type GroupableIncome = Pick<Income,
  'categoryId' | 'categoryName' | 'categoryColor' | 'paymentMethodId' | 'paymentMethodColor'>;

export function getIncomeGroupIdentity(
  income: GroupableIncome,
  groupBy: 'category' | 'payment-method',
  paymentMethodLabel: string,
  unspecifiedName: string
) {
  return groupBy === 'category'
    ? {
        key: `category-${income.categoryId ?? 'none'}`,
        name: income.categoryName ?? unspecifiedName,
        color: income.categoryColor ?? '#60758E',
      }
    : {
        key: `payment-${income.paymentMethodId ?? 'none'}`,
        name: paymentMethodLabel,
        color: income.paymentMethodColor ?? '#60758E',
      };
}
