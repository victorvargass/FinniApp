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
  recurringExpenseId: number | null;
  debtPlanId: number | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
};

export type Income = {
  id: number;
  name: string;
  amount: number;
  periodId: number;
  date: string;
  recurringIncomeId: number | null;
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
  bankChargeAmount: number;
  adjustmentAmount: number;
};

export type NewCreditCardCycle = {
  paymentMethodId: number;
  endDate: string;
  statementAmount: number | null;
  status: CreditCardCycleStatus;
};

export type ReconcileCreditCardCycle = {
  statementAmount: number;
  bankChargeAmount: number;
};

export type DebtPlanStatus = 'projected' | 'active' | 'completed' | 'cancelled';

export type InstallmentStatus = 'projected' | 'posted' | 'cancelled';

export type NewInstallmentPurchase = {
  name: string;
  totalAmount: number;
  categoryId: number | null;
  paymentMethodId: number;
  purchaseDate: string;
  firstDueDate: string;
  totalInstallments: number;
};

export type DebtInstallment = {
  id: number;
  number: number;
  dueDate: string;
  projectedAmount: number;
  expenseId: number | null;
  status: InstallmentStatus;
  manuallyRemoved: boolean;
};

export type DebtPlan = NewInstallmentPurchase & {
  id: number;
  kind: 'credit_installment';
  installmentAmount: number;
  status: DebtPlanStatus;
  paymentMethodName: string;
  paymentMethodColor: string;
  categoryName: string | null;
  categoryColor: string | null;
  postedInstallments: number;
  remainingAmount: number;
  installments?: DebtInstallment[];
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

export type RecurringFrequency = 'weekly' | 'monthly' | 'annual' | 'custom';

export type RecurringRegistrationMode = 'automatic' | 'confirmation';

export type RecurringOccurrenceStatus = 'scheduled' | 'pending' | 'generated' | 'skipped';

export type NewRecurringSchedule = {
  frequency: RecurringFrequency;
  intervalMonths: number;
  executionDay: number | null;
  registrationMode: RecurringRegistrationMode;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

export type NewRecurringExpense = NewRecurringSchedule & {
  name: string;
  amount: number;
  originalAmount: number | null;
  splitPercentage: number | null;
  categoryId: number | null;
  paymentMethodId: number | null;
  sourceExpenseId?: number | null;
};

export type RecurringExpense = NewRecurringExpense & {
  id: number;
  sourceExpenseId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  paymentMethodName: string | null;
  paymentMethodColor: string | null;
  nextDate: string | null;
  pendingCount: number;
};

export type RecurringOccurrence = {
  id: number;
  recurringExpenseId: number;
  scheduledDate: string;
  status: RecurringOccurrenceStatus;
  expenseId: number | null;
};

export type RecurringConfirmationSchedule = {
  recurringExpenseId: number;
  name: string;
  amount: number;
  scheduledDate: string;
};

export type GeneratedRecurringExpenseNotification = RecurringConfirmationSchedule;

export type RecurringDecisionItem = RecurringConfirmationSchedule & {
  status: 'pending' | 'skipped';
};

export type NewRecurringIncome = Omit<NewRecurringSchedule, 'registrationMode'> & {
  name: string;
  amount: number;
  sourceIncomeId?: number | null;
};

export type RecurringIncome = NewRecurringIncome & {
  id: number;
  sourceIncomeId: number | null;
  nextDate: string | null;
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
