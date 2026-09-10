export type Period = {
  id: number;
  startDate: string;
  endDate: string;
}

export type CategoryPurpose = 'general' | 'savings';
export type CategorySystemKey = 'savings' | 'credit_payment';

export const VIRTUAL_SAVINGS_PAYMENT_METHOD_ID = -1;

export type Category = {
  id: number;
  name: string;
  color: string;
  periodLimit: number | null;
  purpose: CategoryPurpose;
  systemKey: CategorySystemKey | null;
};

export type SavingsGoalStatus = 'active' | 'archived';

export type SavingsGoalMovementKind = 'contribution' | 'withdrawal' | 'funded_expense' | 'adjustment';

export type SavingsExpenseKind = Extract<
  SavingsGoalMovementKind,
  'contribution' | 'funded_expense'
>;

export type NewSavingsGoal = {
  name: string;
  targetAmount: number;
  initialAmount: number;
  deadline: string;
  color: string;
};

export type NewSavingsGoalBalance = {
  balance: number;
  date: string;
  note: string | null;
};

export type SavingsGoal = NewSavingsGoal & {
  id: number;
  status: SavingsGoalStatus;
  currentAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type SavingsGoalMovement = {
  id: number;
  goalId: number;
  kind: SavingsGoalMovementKind;
  name: string;
  amount: number;
  date: string;
  expenseId: number | null;
  incomeId: number | null;
};

export type SavingsGoalPeriodActivity = {
  goalId: number;
  goalName: string;
  goalColor: string;
  targetAmount: number;
  initialAmount: number;
  deadline: string;
  status: SavingsGoalStatus;
  openingAmount: number;
  contributions: number;
  withdrawals: number;
  fundedExpenses: number;
  adjustments: number;
  closingAmount: number;
  // Explicit aliases kept for query/report consumers that prefer amount suffixes.
  balanceAtPeriodEnd: number;
  contributedAmount: number;
  withdrawnAmount: number;
  fundedExpenseAmount: number;
  adjustmentAmount: number;
  netActivity: number;
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
  debtId: number | null;
  debtEntryId: number | null;
  installmentNumber: number | null;
  totalInstallments: number | null;
  savingsGoalId: number | null;
  savingsKind: SavingsExpenseKind | null;
  creditPaymentTargetId: number | null;
};

export type Income = {
  id: number;
  name: string;
  amount: number;
  periodId: number;
  date: string;
  recurringIncomeId: number | null;
  savingsGoalId: number | null;
  savingsGoalName: string | null;
  savingsGoalColor: string | null;
};

export type ExpenseWithCategory = Expense & {
  categoryName: string | null;
  categoryColor: string | null;
  paymentMethodName: string | null;
  paymentMethodType: PaymentMethodType | null;
  paymentMethodColor: string | null;
  savingsGoalName: string | null;
  savingsGoalColor: string | null;
};

export type PaymentMethodType = 'cash' | 'debit' | 'prepaid' | 'credit';

export type PaymentMethod = {
  id: number;
  name: string;
  type: PaymentMethodType;
  billingDay: number | null;
  color: string;
  active: boolean;
  creditLimit: number | null;
  reportedBalance: number | null;
  balanceUpdatedAt: string | null;
  availableBalance: number | null;
  usedAmount: number | null;
  paymentDueDay: number | null;
  billedAmount: number;
  statementDate: string | null;
};

export type PaymentMethodMovement = {
  id: number;
  name: string;
  amount: number;
  date: string;
  kind: 'expense' | 'credit_payment';
  categoryName: string | null;
  relatedPaymentMethodName: string | null;
};

export type NewPaymentMethod = {
  name: string;
  type: PaymentMethodType;
  billingDay: number | null;
  color: string;
  creditLimit: number | null;
  reportedBalance: number | null;
  balanceDate: string | null;
  paymentDueDay: number | null;
};

export type NewPaymentMethodBalance = {
  balance: number;
  date: string;
};

export type PaymentMethodTotal = {
  paymentMethodId: number | null;
  paymentMethodName: string;
  paymentMethodType: PaymentMethodType | null;
  paymentMethodColor: string | null;
  total: number;
};

export type CreditCardCycleStatus = 'pending' | 'reconciled';

export type PaymentMethodDeletionInfo = {
  expenseCount: number;
  debtPlanCount: number;
  receivedPaymentCount: number;
};

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
  linkedExpenseCount: number;
  settlementExpenseId: number | null;
  remainingAmount: number;
  installments?: DebtInstallment[];
};

export type DebtType = 'fixed' | 'variable';
export type DebtStatus = 'active' | 'paid' | 'archived';
export type DebtFrequency = 'weekly' | 'monthly' | 'annual';

export type NewDebt = {
  type: DebtType;
  name: string;
  creditor: string | null;
  initialAmount: number;
  installmentAmount: number | null;
  frequency: DebtFrequency | null;
  firstDueDate: string | null;
  categoryId: number | null;
  paymentMethodId: number | null;
  notes: string | null;
};

export type DebtEntry = {
  id: number;
  debtId: number;
  kind: 'payment' | 'adjustment';
  amount: number;
  date: string;
  periodId: number | null;
  expenseId: number | null;
  categoryId: number | null;
  categoryName: string | null;
  paymentMethodId: number | null;
  paymentMethodName: string | null;
  note: string | null;
};

export type Debt = NewDebt & {
  id: number;
  status: DebtStatus;
  currentBalance: number;
  paidAmount: number;
  paymentCount: number;
  entryCount: number;
  totalInstallments: number | null;
  nextDueDate: string | null;
  createdAt: string;
  updatedAt: string;
  entries?: DebtEntry[];
};

export type NewDebtPayment = {
  amount: number;
  date: string;
  periodId: number;
  categoryId: number | null;
  paymentMethodId: number | null;
  note: string | null;
};

export type NewDebtBalance = {
  balance: number;
  date: string;
  note: string | null;
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
  savingsWithdrawalTotal: number;
  savingsFundingTotal: number;
  categories: PeriodHistoryCategory[];
  paymentMethods: PeriodHistoryPaymentMethod[];
};

export type PeriodStatement = {
  expenses: ExpenseWithCategory[];
  incomes: Income[];
};

export type PeriodDebtSummary = {
  debtId: number;
  name: string;
  type: DebtType;
  creditor: string | null;
  status: DebtStatus;
  paymentMethodName: string | null;
  openingBalance: number;
  payments: number;
  adjustments: number;
  closingBalance: number;
};

export type PeriodInstallmentSummary = {
  planId: number;
  name: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  status: InstallmentStatus;
  categoryName: string | null;
  paymentMethodName: string;
};

export type PeriodCreditCycleSummary = {
  cycleId: number;
  paymentMethodName: string;
  startDate: string;
  endDate: string;
  statementAmount: number | null;
  recordedTotal: number;
  status: CreditCardCycleStatus;
};

export type PeriodRecurringSummary = {
  kind: RecurringMovementKind;
  name: string;
  amount: number;
  scheduledDate: string;
  status: RecurringOccurrenceStatus;
};

export type PeriodFinancialDetails = {
  debts: PeriodDebtSummary[];
  installments: PeriodInstallmentSummary[];
  creditCycles: PeriodCreditCycleSummary[];
  recurringMovements: PeriodRecurringSummary[];
};


export type NewPeriod = {
  startDate: string;
  endDate: string;
}

export type NewCategory = {
  name: string;
  color: string;
  periodLimit: number | null;
  purpose?: CategoryPurpose;
  systemKey?: CategorySystemKey | null;
};

export type NewExpense = {
  name: string;
  amount: number;
  originalAmount: number | null;
  splitPercentage: number | null;
  categoryId: number | null;
  date: string;
  paymentMethodId: number | null;
  savingsGoalId?: number | null;
  savingsKind?: SavingsExpenseKind | null;
  creditPaymentTargetId?: number | null;
};

export type RecurringFrequency = 'weekly' | 'monthly' | 'annual' | 'custom';

export type RecurringRegistrationMode = 'automatic' | 'confirmation';

export type RecurringMovementKind = 'expense' | 'income';

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
  savingsGoalId?: number | null;
  savingsKind?: Extract<SavingsExpenseKind, 'contribution'> | null;
};

export type RecurringExpense = NewRecurringExpense & {
  id: number;
  sourceExpenseId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  paymentMethodName: string | null;
  paymentMethodColor: string | null;
  savingsGoalId: number | null;
  savingsKind: Extract<SavingsExpenseKind, 'contribution'> | null;
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
  kind: RecurringMovementKind;
  recurringId: number;
  name: string;
  amount: number;
  scheduledDate: string;
};

export type GeneratedRecurringExpenseNotification = {
  recurringExpenseId: number;
  name: string;
  amount: number;
  scheduledDate: string;
};

export type RecurringDecisionItem = RecurringConfirmationSchedule & {
  status: 'pending' | 'skipped';
};

export type NewRecurringIncome = NewRecurringSchedule & {
  name: string;
  amount: number;
  sourceIncomeId?: number | null;
};

export type RecurringIncome = NewRecurringIncome & {
  id: number;
  sourceIncomeId: number | null;
  nextDate: string | null;
  pendingCount: number;
};

export type NewIncome = {
  name: string;
  amount: number;
  date: string;
  savingsGoalId?: number | null;
};

export type Settings = {
  id: number;
  currentPeriodId: number | null;
  defaultPaymentMethodId: number | null;
  currentPeriod?: Period | null;
  movementReminderEnabled: boolean;
  movementReminderFrequency: 'daily' | 'weekly';
  movementReminderWeekday: number;
  movementReminderHour: number;
  movementReminderMinute: number;
};

export type MovementReminderSettings = Pick<Settings,
  'movementReminderEnabled' | 'movementReminderFrequency' | 'movementReminderWeekday' |
  'movementReminderHour' | 'movementReminderMinute'>;
