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
  total: number;
};

export type PeriodHistory = {
  periodId: number;
  startDate: string;
  endDate: string;
  year: number;
  incomesTotal: number;
  categories: PeriodHistoryCategory[];
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
  categoryId: number | null;
  date: string;
};

export type NewIncome = {
  name: string;
  amount: number;
  date: string;
};

export type Settings = {
  id: number;
  currentPeriodId: number | null;
  currentPeriod?: Period | null;
};
