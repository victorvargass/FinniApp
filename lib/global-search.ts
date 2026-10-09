import { matchesMovementSearchQuery, normalizeSearchText } from './search.ts';
import type {
  Contact,
  Debt,
  DebtPlan,
  ExpenseWithCategory,
  Income,
  PaymentMethod,
  SavingsGoal,
  CurrencyCode,
} from './types.ts';

export type GlobalSearchKind =
  | 'expense'
  | 'income'
  | 'contact'
  | 'debt'
  | 'installment'
  | 'payment-method'
  | 'savings-goal';

export type GlobalSearchResult = {
  key: string;
  id: number;
  kind: GlobalSearchKind;
  title: string;
  searchableText: string;
  amount?: number;
  currency?: CurrencyCode;
  date?: string;
  meta?: string | null;
};

export type GlobalSearchData = {
  expenses: ExpenseWithCategory[];
  incomes: Income[];
  contacts: Contact[];
  debts: Debt[];
  debtPlans: DebtPlan[];
  paymentMethods: PaymentMethod[];
  savingsGoals: SavingsGoal[];
};

function relevance(result: GlobalSearchResult, normalizedQuery: string) {
  const title = normalizeSearchText(result.title.trim());
  if (title === normalizedQuery) return 0;
  if (title.startsWith(normalizedQuery)) return 1;
  return 2;
}

export function buildGlobalSearchResults(
  query: string,
  data: GlobalSearchData,
  limit = 60
): GlobalSearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const candidates: GlobalSearchResult[] = [
    ...data.expenses.map((item) => ({
      key: `expense-${item.id}`,
      id: item.id,
      kind: 'expense' as const,
      title: item.name,
      searchableText: [item.name, item.categoryName, item.paymentMethodName, item.savingsGoalName].filter(Boolean).join(' '),
      amount: item.amount,
      currency: item.currency,
      date: item.date,
      meta: item.categoryName,
    })),
    ...data.incomes.map((item) => ({
      key: `income-${item.id}`,
      id: item.id,
      kind: 'income' as const,
      title: item.name,
      searchableText: [item.name, item.categoryName, item.paymentMethodName, item.savingsGoalName].filter(Boolean).join(' '),
      amount: item.amount,
      date: item.date,
      meta: item.categoryName,
    })),
    ...data.contacts.map((item) => ({
      key: `contact-${item.id}`,
      id: item.id,
      kind: 'contact' as const,
      title: item.name,
      searchableText: [item.name, item.nickname, item.relationshipTypeName, item.email, item.phone, ...item.bankAccounts.flatMap((account) => [account.bankName, account.rut, account.accountNumber])].filter(Boolean).join(' '),
      meta: item.nickname ?? item.relationshipTypeName,
    })),
    ...data.debts.map((item) => ({
      key: `debt-${item.id}`,
      id: item.id,
      kind: 'debt' as const,
      title: item.name,
      searchableText: [item.name, item.creditor, item.contactName, item.contactNickname, item.notes].filter(Boolean).join(' '),
      amount: item.currentBalance,
      date: item.nextDueDate ?? undefined,
      meta: item.contactName ?? item.creditor,
    })),
    ...data.debtPlans.map((item) => ({
      key: `installment-${item.id}`,
      id: item.id,
      kind: 'installment' as const,
      title: item.name,
      searchableText: [item.name, item.paymentMethodName, item.categoryName].filter(Boolean).join(' '),
      amount: item.remainingAmount,
      date: item.nextInstallmentDueDate ?? undefined,
      meta: item.paymentMethodName,
    })),
    ...data.paymentMethods.map((item) => ({
      key: `payment-method-${item.id}`,
      id: item.id,
      kind: 'payment-method' as const,
      title: item.name,
      searchableText: item.name,
      amount: item.availableBalance ?? undefined,
      meta: item.type,
    })),
    ...data.savingsGoals.map((item) => ({
      key: `savings-goal-${item.id}`,
      id: item.id,
      kind: 'savings-goal' as const,
      title: item.name,
      searchableText: item.name,
      amount: item.currentAmount,
      date: item.deadline,
      meta: item.status,
    })),
  ];

  const normalizedQuery = normalizeSearchText(trimmed);
  return candidates
    .filter((item) => item.amount == null
      ? normalizeSearchText(item.searchableText).includes(normalizedQuery)
      : matchesMovementSearchQuery(item.searchableText, item.amount, trimmed))
    .sort((first, second) =>
      relevance(first, normalizedQuery) - relevance(second, normalizedQuery)
      || (second.date ?? '').localeCompare(first.date ?? '')
      || first.title.localeCompare(second.title, 'es')
    )
    .slice(0, limit);
}
