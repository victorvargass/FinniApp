export type Period = {
  id: number;
  startDate: string;
  endDate: string;
}

export type Category = {
  id: number;
  name: string;
  color: string;
  periodLimit: number | null;
};

export type Expense = {
  id: number;
  name: string;
  amount: number;
  categoryId: number | null;
  periodId: number;
  date: string;
  originalAmount: number | null;
  splitPercentage: number | null;
  paymentMethodId: number | null;
};

export type Income = {
  id: number;
  name: string;
  amount: number;
  periodId: number;
  date: string;
};

export type ExpenseWithCategory = Expense & {
  categoryName: string | null;
  categoryColor: string | null;
  paymentMethodName: string | null;
  paymentMethodType: PaymentMethodType | null;
  paymentMethodColor: string | null;
};

export type PaymentMethodType = 'cash' | 'debit' | 'prepaid' | 'credit';

export type PaymentMethod = {
  id: number;
  name: string;
  type: PaymentMethodType;
  billingDay: number | null;
  color: string;
  active: boolean;
};

export type NewPaymentMethod = {
  name: string;
  type: PaymentMethodType;
  billingDay: number | null;
  color: string;
};

export type PaymentMethodTotal = {
  paymentMethodId: number | null;
  paymentMethodName: string;
  paymentMethodType: PaymentMethodType | null;
  paymentMethodColor: string | null;
  total: number;
};

export type CreditCardCycleStatus = 'pending' | 'reconciled';

export type CreditCardCycle = {
  id: number;
  paymentMethodId: number;
  startDate: string;
  endDate: string;
  statementAmount: number | null;
  status: CreditCardCycleStatus;
  recordedTotal: number;
};

export type NewCreditCardCycle = {
  paymentMethodId: number;
  endDate: string;
  statementAmount: number | null;
  status: CreditCardCycleStatus;
};

// Ver, pensar en Periods
export type PeriodCategoryExpensesTotals = {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  periodLimit: number | null;
  total: number;
};

export type PeriodHistoryCategory = {
  categoryId: number | null;
  categoryName: string;
  categoryColor: string;
  periodLimit: number | null;
  total: number;
};

export type PeriodHistoryPaymentMethod = {
  paymentMethodId: number | null;
  paymentMethodName: string;
  paymentMethodColor: string;
  paymentMethodType: PaymentMethodType | null;
  billingDay: number | null;
  active: boolean | null;
  total: number;
};

export type PeriodHistory = {
  periodId: number;
  startDate: string;
  endDate: string;
  year: number;
  incomesTotal: number;
  categories: PeriodHistoryCategory[];
  paymentMethods: PeriodHistoryPaymentMethod[];
};

export type PeriodStatement = {
  expenses: ExpenseWithCategory[];
  incomes: Income[];
};


export type NewPeriod = {
  startDate: string;
  endDate: string;
}

export type NewCategory = {
  name: string;
  color: string;
  periodLimit: number | null;
};

export type NewExpense = {
  name: string;
  amount: number;
  originalAmount: number | null;
  splitPercentage: number | null;
  categoryId: number | null;
  date: string;
  paymentMethodId: number | null;
};

export type NewIncome = {
  name: string;
  amount: number;
  date: string;
};

export type Settings = {
  id: number;
  currentPeriodId: number | null;
  defaultPaymentMethodId: number | null;
  currentPeriod?: Period | null;
};
